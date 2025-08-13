import db from "../knex.js";

// Helper to format date for consistency (YYYY-MM-DD)
function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    let d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


async function getAuditLogs(tableName) {
    // A simple query to get the last 10 updated records from a table.
    // NOTE: In a real-world scenario, you'd have a dedicated 'audit_logs' table.
    // This is a simplified stand-in.
    const columns = {
        students: ['student_id as entity_id', 'name', 'email'],
        lecturers: ['lecturer_id as entity_id', 'name', 'email'],
        courses: ['course_code as entity_id', 'course_name as name'],
        sections: ['section_id as entity_id', 'section_name as name']
    };

    return db(tableName)
        .select(...columns[tableName], 'created_at as timestamp', 'updated_at')
        .orderBy('updated_at', 'desc')
        .limit(20);
}

async function getAtRiskStudents() {
    // This query finds students whose attendance rate is below 80%.
    // It calculates the rate by dividing recorded attendances by total enrollments.
    const subquery = db('sections_students as ss')
        .join('attendance_records as ar', 'ss.student_id', '=', 'ar.student_id')
        .select('ss.student_id')
        .groupBy('ss.student_id')
        .having(db.raw('CAST(COUNT(ar.record_id) AS REAL) / COUNT(DISTINCT ss.section_id) < 0.8'));

    return db('students as s')
        .join(subquery.as('at_risk'), 's.student_id', '=', 'at_risk.student_id')
        .select('s.student_id', 's.name', 's.email'); // Add any other student details you need
}

async function getCourseDetails(courseCode) {
    // Finds all sections and their assigned lecturers for a given course.
    return db('sections as s')
        .join('lecturers as l', 's.lecturer_id', '=', 'l.lecturer_id')
        .where('s.course_code', courseCode)
        .select(
            's.section_id as id',
            's.section_name as section',
            'l.name as lecturer'
        );
}

async function getDashboardSummary() {
    // --- 1. Get Simple Counts (Run in parallel for efficiency) ---
    const [totalStudentsResult, totalLecturersResult, totalCoursesResult, totalSectionsResult] = await Promise.all([
        db("students").count({ count: '*' }).first(),
        db("lecturers").count({ count: '*' }).first(),
        db("courses").count({ count: '*' }).first(),
        db("sections").count({ count: '*' }).first(),
    ]);

    // --- 2. Get Historical Attendance Percentages ---
    // This helper function calculates the average attendance rate for a given day
    const getAttendanceRateForDate = async (dateString) => {
        const records = await db('attendance_records as ar')
            .join('sections_students as ss', function() {
                this.on('ar.section_id', '=', 'ss.section_id').andOn('ar.student_id', '=', 'ss.student_id');
            })
            .whereRaw("strftime('%Y-%m-%d', ar.attended_at) = ?", [dateString]);
        
        const presentCount = new Set(records.map(r => r.student_id)).size;
        const totalEnrolled = new Set(records.map(r => r.section_id + '-' + r.student_id)).size;

        return totalEnrolled > 0 ? (presentCount / totalEnrolled) * 100 : 0;
    };

    const today = new Date();
    const todayStr = formatDateToYYYYMMDD(today);
    const yesterdayStr = formatDateToYYYYMMDD(new Date(new Date().setDate(today.getDate() - 1)));
    
    const [todayRate, yesterdayRate] = await Promise.all([
        getAttendanceRateForDate(todayStr),
        getAttendanceRateForDate(yesterdayStr),
    ]);

    // --- 3. Get Chart & At-Risk Data (Queries from before, now run in parallel) ---
    const sevenDaysAgo = formatDateToYYYYMMDD(new Date(new Date().setDate(today.getDate() - 7)));

    const [atRiskStudentsResult, overview7d, lowestAttendanceCourses] = await Promise.all([
        db('students as s').join('sections_students as ss', 's.student_id', 'ss.student_id').leftJoin('attendance_records as ar', 'ss.student_id', 'ar.student_id').groupBy('s.student_id').having(db.raw('CAST(COUNT(ar.record_id) AS REAL) / COUNT(DISTINCT ss.section_id) < 0.8')).count('s.student_id as count').first(),
        db('attendance_records').select(db.raw("strftime('%Y-%m-%d', attended_at) as date"), db.raw('COUNT(record_id) as count')).where('attended_at', '>=', sevenDaysAgo).groupBy('date').orderBy('date', 'asc'),
        db('courses as c').select('c.course_code', 'c.course_name').leftJoin('sections as s', 'c.course_code', 's.course_code').leftJoin('sections_students as ss', 's.section_id', 'ss.section_id').leftJoin('attendance_records as ar', 'ss.student_id', 'ar.student_id').groupBy('c.course_code', 'c.course_name').select(db.raw('(CAST(COUNT(ar.record_id) AS REAL) / COUNT(DISTINCT ss.student_id)) * 100 as attendance_percentage')).whereNotNull('ss.student_id').orderBy('attendance_percentage', 'asc').limit(5)
    ]);

    // --- 4. Assemble the final JSON object ---
    return {
        totalStudents: totalStudentsResult.count,
        totalLecturers: totalLecturersResult.count,
        totalCourses: totalCoursesResult.count,
        totalSections: totalSectionsResult.count,
        todayAttendance: {
            percentage: parseFloat(todayRate.toFixed(1)),
            vsYesterday: parseFloat(yesterdayRate.toFixed(1)),
        },
        atRiskStudentCount: atRiskStudentsResult ? atRiskStudentsResult.count : 0,
        charts: {
            overview7d: overview7d,
            lowestAttendanceCourses: lowestAttendanceCourses,
        }
    };
}








async function generateAttendanceReport(filters = {}) {
    const { startDate, endDate, course_code, section_id, lecturer_id } = filters;

    let query = db("attendance_records as ar")
        .select(
            "ar.record_id",
            "ar.attended_at",
            "s.student_id",
            "s.name as student_name",
            "sec.section_id",
            "sec.section_name",
            "c.course_code",
            "c.course_name",
            "l.lecturer_id",
            "l.name as lecturer_name",
            db.raw("CASE WHEN ar.record_id IS NOT NULL THEN 1 ELSE 0 END as is_present")
        )
        .join("students as s", "ar.student_id", "s.student_id")
        .join("sections as sec", "ar.section_id", "sec.section_id")
        .join("courses as c", "sec.course_code", "c.course_code")
        .join("lecturers as l", "sec.lecturer_id", "l.lecturer_id")
        .orderBy("ar.attended_at", "desc");

    // Apply filters
    if (startDate && !endDate) {
        // Case 1: Only a start date is provided (query for a single day)
        query.whereRaw("strftime('%Y-%m-%d', ar.attended_at) = ?", [startDate]);
    } else if (startDate && endDate) {
        // Case 2: Both start and end dates are provided (query for a range)
        query.whereRaw("strftime('%Y-%m-%d', ar.attended_at) >= ?", [startDate]);
        query.whereRaw("strftime('%Y-%m-%d', ar.attended_at) <= ?", [endDate]);
    }

    if (course_code) {
        query.where("c.course_code", course_code);
    }

    const parsedLecturerId = parseInt(lecturer_id);

    if (!isNaN(parsedLecturerId)) {
        query.where("l.lecturer_id", parsedLecturerId);
    }
    
    const parsedSectionId = parseInt(section_id);

    if (!isNaN(parsedSectionId)) {
        query.where("sec.section_id", parsedSectionId);
    }

    // --- ADD THESE TWO LINES FOR DEBUGGING ---
    console.log("Final SQL Query:", query.toSQL().sql);
    console.log("Bindings:", query.toSQL().bindings);

    return await query;
}

async function getLecturerDashboardSummary(lecturerId) {
    // 1. Get sections assigned to the lecturer
    const lecturerSections = await db('sections').where({ lecturer_id: lecturerId });
    const sectionIds = lecturerSections.map(s => s.section_id);

    if (sectionIds.length === 0) {
        return {
            totalSections: 0,
            totalEnrolledStudents: 0,
            todayAttendanceRate: 0,
            recentAttendance: []
        };
    }

    // 2. Get total enrolled students across those sections
    const totalEnrolledResult = await db('sections_students')
        .whereIn('section_id', sectionIds)
        .countDistinct('student_id as count')
        .first();

    // 3. Get today's attendance rate for those sections
    const todayStr = formatDateToYYYYMMDD(new Date());
    const todayAttendanceRecords = await db('attendance_records')
        .whereIn('section_id', sectionIds)
        .andWhere(db.raw("strftime('%Y-%m-%d', attended_at) = ?", [todayStr]));
    
    const presentCount = new Set(todayAttendanceRecords.map(r => r.student_id)).size;
    const todayAttendanceRate = totalEnrolledResult.count > 0 ? (presentCount / totalEnrolledResult.count) * 100 : 0;
    
    // 4. Get 5 most recent attendance records
    const recentAttendance = await db('attendance_records as ar')
        .join('sections as s', 'ar.section_id', 's.section_id')
        .whereIn('ar.section_id', sectionIds)
        .select('s.section_name', 'ar.attended_at')
        .orderBy('ar.attended_at', 'desc')
        .limit(5);

    return {
        totalSections: sectionIds.length,
        totalEnrolledStudents: totalEnrolledResult.count,
        todayAttendanceRate: parseFloat(todayAttendanceRate.toFixed(1)),
        recentAttendance: recentAttendance,
    };
}



export default {
    getAuditLogs,          
    getAtRiskStudents,    
    getCourseDetails,      
    getDashboardSummary,
    generateAttendanceReport,
    getLecturerDashboardSummary,
};