import db from "../knex.js"
import { v4 as uuidv4 } from 'uuid'; 


// Helper to format date for consistency (YYYY-MM-DD)
function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    let d = new Date(date);
    // Ensure that d is a valid date before proceeding
    if (isNaN(d.getTime())) {
        console.error("Invalid date passed to formatDateToYYYYMMDD:", date);
        return null;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to record attendance, primarily for QR scans but can be used for initial manual if needed
async function recordAttendance(student_id, section_id, qrcode_id = null, session_id) {
    try {
        const [record_id] = await db('attendance_records').insert({
            student_id,
            section_id,
            qrcode_id,
            session_id,
            attended_at: db.fn.now(),
        });
        return db("attendance_records").where({ record_id }).first()

    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('SQLITE_CONSTRAINT_UNIQUE'))) {
            console.warn(`Duplicate attendance attempt for student ${student_id} in section ${section_id} via QR code ${qrcode_id}.`);
            return { success: false, message: "Attendance already recorded for this session." };
        }
        console.error("Error recording attendance:", err);
        throw err;
    }
}


async function getAttendanceByStudentSectionDate(student_id, section_id, date) {
    const dateString = formatDateToYYYYMMDD(date);
    if (!dateString) {
        throw new Error("Invalid date provided for attendance lookup.");
    }
    return db('attendance_records')
        .where({ student_id, section_id })
        .andWhere(db.raw("STRFTIME('%Y-%m-%d', attended_at)"), '=', dateString) // Using STRFTIME for SQLite
        .first();
}

async function getDetailedAttendanceForSectionByDate(section_id, date) {
    const dateString = formatDateToYYYYMMDD(date);
    if (!dateString) {
        throw new Error("Invalid date provided for detailed attendance.");
    }

    try {
        // 1. Get ALL students enrolled in this section
        const allEnrolledStudents = await db("sections_students as ss")
            .join("students as s", "ss.student_id", "s.student_id")
            .where("ss.section_id", section_id)
            .select("s.student_id", "s.name as student_name");

        if (allEnrolledStudents.length === 0) {
            return []; // No students enrolled, so no report to show
        }

        // 2. Get the records of students who were PRESENT on that date
        const presentRecords = await db('attendance_records as ar')
            .where('ar.section_id', section_id)
            .andWhere(db.raw("strftime('%Y-%m-%d', ar.attended_at) = ?", [dateString]))
            .select('ar.student_id', 'ar.qrcode_id');

        const presentStudentIds = new Map(presentRecords.map(r => [r.student_id, r.qrcode_id]));

        // 3. Merge the two lists to create a complete report
        const detailedReport = allEnrolledStudents.map(student => {
            const isPresent = presentStudentIds.has(student.student_id);
            const qrCodeId = isPresent ? presentStudentIds.get(student.student_id) : null;
            
            return {
                student_id: student.student_id,
                student_name: student.student_name,
                is_present: isPresent,
                // A manual override is when they are present but there was no QR code
                is_manual_override: isPresent && qrCodeId === null,
            };
        });

        return detailedReport;

    } catch (error) {
        console.error("Error in getDetailedAttendanceForSectionByDate:", error);
        throw error;
    }
}


async function findById(record_id) {
    return db("attendance_records")
        .select(
            "attendance_records.record_id",
            "attendance_records.section_id",
            "sections.section_name",
            "sections.course_code",
            "courses.course_name",
            "sections.lecturer_id",
            "lecturers.name as lecturer_name",
            "attendance_records.student_id",
            "students.name as student_name",
            "attendance_records.qrcode_id",
            "qrcodes.qr_string", // This will be null if qrcode_id is null
            "attendance_records.attended_at"
        )
        .join("sections", "attendance_records.section_id", "sections.section_id")
        .join("courses", "sections.course_code", "courses.course_code")
        .join("lecturers", "sections.lecturer_id", "lecturers.lecturer_id")
        .join("students", "attendance_records.student_id", "students.student_id")
        .leftJoin("qrcodes", "attendance_records.qrcode_id", "qrcodes.qrcode_id") // <--- CHANGED TO LEFT JOIN
        .where("attendance_records.record_id", record_id)
        .first();
}


async function findAttendanceBySection(section_id) {
    return db("attendance_records")
        .select(
            "attendance_records.record_id",
            "attendance_records.student_id",
            "students.name as student_name",
            "students.email as student_email",
            "attendance_records.qrcode_id",
            "qrcodes.qr_string", // This will be null if qrcode_id is null
            "attendance_records.attended_at"
        )
        .join("students", "attendance_records.student_id", "students.student_id")
        .leftJoin("qrcodes", "attendance_records.qrcode_id", "qrcodes.qrcode_id") // <--- CHANGED TO LEFT JOIN
        .where("attendance_records.section_id", section_id)
        .orderBy("attendance_records.attended_at", "desc"); // Order by newest first
}


async function findAttendanceByStudent(student_id) {
    return db("attendance_records")
        .select(
            "attendance_records.record_id",
            "attendance_records.section_id",
            "sections.section_name",
            "sections.course_code",
            "courses.course_name",
            "sections.lecturer_id",
            "lecturers.name as lecturer_name",
            "attendance_records.attended_at"
        )
        .join("sections", "attendance_records.section_id", "sections.section_id")
        .join("courses", "sections.course_code", "courses.course_code")
        .join("lecturers", "sections.lecturer_id", "lecturers.lecturer_id")
        .where("attendance_records.student_id", student_id)
        .orderBy("attendance_records.attended_at", "desc"); // Order by newest first
}

async function findAttendanceBySessionId(session_id) {
    return db("attendance_records")
        .join("students", "attendance_records.student_id", "students.student_id")
        .join("sections", "attendance_records.section_id", "sections.section_id")
        .select(
            "attendance_records.record_id",
            "attendance_records.student_id",
            "students.name as student_name",
            "sections.section_name",
            "attendance_records.attended_at"
        )
        .where("attendance_records.session_id", session_id)
        .orderBy("attendance_records.attended_at", "asc"); // Order by when they attended
}


async function hasStudentAttendedSession(student_id, session_id) {
    if (!session_id) return false; // Don't block if there's no session ID
    const record = await db("attendance_records")
        .where({ student_id, session_id })
        .first();
    return !!record; // Returns true if a record exists, false otherwise
}


// Optional: Check if a student has already attended for a given QR code (to prevent multiple attendance records for one scan)
async function hasStudentAttendedWithQr(student_id, qrcode_id) {
    const record = await db("attendance_records")
        .where({ student_id, qrcode_id })
        .first();
    return !!record;
}


//findAttendanceForSections(section_ids, startDate, endDate), gets attendance for a list of sections within a date range
async function findAttendanceForSections(section_ids, startDate = null, endDate = null, courseCode = null) {
    if (!section_ids || section_ids.length === 0) {
        return [];
    }

    // Step 1: Get aggregated attendance counts per day per section
    let aggregatedQuery = db("attendance_records as ar")
        .select(
            db.raw("STRFTIME('%Y-%m-%d', ar.attended_at) as report_date"), // <--- CHANGED TO STRFTIME
            "s.section_id",
            "s.section_name",
            "c.course_code",
            "c.course_name",
            db.raw("COUNT(DISTINCT ar.student_id) as present_students") // Count unique present students
        )
        .join("sections as s", "ar.section_id", "s.section_id")
        .join("courses as c", "s.course_code", "c.course_code")
        .whereIn("ar.section_id", section_ids);

    // Apply date filters to the aggregation
    if (startDate) {
        aggregatedQuery = aggregatedQuery.andWhere(db.raw("STRFTIME('%Y-%m-%d', ar.attended_at)"), ">=", startDate);
    }
    if (endDate) {
        aggregatedQuery = aggregatedQuery.andWhere(db.raw("STRFTIME('%Y-%m-%d', ar.attended_at)"), "<=", endDate);
    }

    // Apply courseCode filter
    if (courseCode) {
        aggregatedQuery = aggregatedQuery.andWhere("c.course_code", courseCode);
    }

    aggregatedQuery = aggregatedQuery.groupBy(
        db.raw("STRFTIME('%Y-%m-%d', ar.attended_at)"), // <--- CHANGED TO STRFTIME
        "s.section_id",
        "s.section_name",
        "c.course_code",
        "c.course_name"
    )
    .orderBy(db.raw("STRFTIME('%Y-%m-%d', ar.attended_at)"), "desc") // <--- CHANGED TO STRFTIME
    .orderBy("c.course_code")
    .orderBy("s.section_name");

    const aggregatedReports = await aggregatedQuery;

    // Step 2: For each aggregated report, find the total number of students enrolled in that section
    const finalReports = [];
    for (const report of aggregatedReports) {
        const totalStudentsResult = await db("sections_students")
            .where("section_id", report.section_id)
            .countDistinct("student_id as total_students")
            .first();

        const totalStudents = totalStudentsResult ? parseInt(totalStudentsResult.total_students) : 0;
        const attendancePercentage = totalStudents > 0
            ? (report.present_students / totalStudents) * 100
            : 0; // Avoid division by zero

        finalReports.push({
            report_id: `${report.section_id}-${report.report_date}`,
            report_date: report.report_date, // This will be a 'YYYY-MM-DD' string
            course_code: report.course_code,
            course_name: report.course_name,
            section_id: report.section_id,
            section_name: report.section_name,
            present_students: report.present_students,
            total_students: totalStudents,
            attendance_percentage: attendancePercentage
        });
    }

    return finalReports;
}


//Manually Update (or create) a student's attendance record
async function updateStudentAttendance(section_id, student_id, report_date, is_present) {
    console.log(`[MODEL] Entering updateStudentAttendance for Student: ${student_id}, Section: ${section_id}, Date: ${report_date}, Present: ${is_present}`);

    const dateString = formatDateToYYYYMMDD(report_date); 
    if (!dateString) {
        console.error(`[MODEL] Invalid report_date provided: ${report_date}`);
        return { success: false, message: "Invalid date provided." };
    }

    console.log(`[MODEL] Formatted dateString for query: ${dateString}`);

    // Check for existing attendance record for this student/section/date
    const existingRecord = await db("attendance_records")
        .where({ section_id, student_id })
        .andWhere(db.raw("STRFTIME('%Y-%m-%d', attended_at)"), '=', dateString) // <--- USING STRFTIME HERE
        .first();

    console.log(`[MODEL] Existing record found:`, existingRecord);
    if (existingRecord) {
        console.log(`[MODEL] Existing record attended_at: ${existingRecord.attended_at}, qrcode_id: ${existingRecord.qrcode_id}`);
    }


    if (is_present) {
        // If student should be marked present
        if (!existingRecord) {
            console.log(`[MODEL] No existing record found for ${student_id}. Attempting to INSERT new attendance.`);
            try {
                const existingSession = await db("attendance_records")
                    .where({ section_id })
                    .andWhere(db.raw("STRFTIME('%Y-%m-%d', attended_at)"), '=', dateString)
                    .select("session_id")
                    .first();

                const sessionIdToUse = existingSession ? existingSession.session_id : uuidv4();

                const manualTimestamp = `${dateString} 12:00:00`;

                const [record_id] = await db("attendance_records").insert({
                    section_id,
                    student_id,
                    qrcode_id: null, // Always NULL for manual 'Mark Present'
                    attended_at: manualTimestamp, // Use current time for manual entry
                    session_id: sessionIdToUse,
                });
                console.log(`[MODEL] Successfully INSERTED new record with ID: ${record_id} for student ${student_id}.`);
                return { success: true, message: "Attendance marked as present.", record_id };
            } catch (insertErr) {
                console.error(`[MODEL ERROR] Error inserting new attendance for ${student_id}:`, insertErr);
                if (insertErr.code === 'SQLITE_CONSTRAINT_UNIQUE' || (insertErr.message && insertErr.message.includes('SQLITE_CONSTRAINT_UNIQUE'))) {
                     return { success: false, message: "Attendance already recorded for this student on this date." };
                }
                throw insertErr; // Re-throw for generic errors
            }
        } else {
            console.log(`[MODEL] Record already exists for Student: ${student_id}. Marking present skipped as they are already recorded.`);
            return { success: true, message: "Student already marked present.", record_id: existingRecord.record_id };
        }
    } else {
        // If student should be marked absent (i.e., remove existing record)
        if (!existingRecord) {
            console.log(`[MODEL] No existing record found to mark absent for Student: ${student_id}.`);
            return { success: true, message: "Student already marked absent." }; // Return success as they are effectively absent
        }

        // Check if it's a QR-scanned attendance (qrcode_id is NOT NULL)
        if (existingRecord.qrcode_id !== null) {
            console.log(`[MODEL] Attempt to mark absent for QR-scanned attendance (qrcode_id: ${existingRecord.qrcode_id}). Preventing deletion.`);
            return { success: false, message: "Cannot mark QR-scanned attendance as absent." };
        }

        // If it's a manual override (qrcode_id IS NULL), then allow deletion
        console.log(`[MODEL] Marking absent: Deleting manual record for Student: ${student_id} with record_id: ${existingRecord.record_id}`);
        try {
            await db("attendance_records")
                .where({ record_id: existingRecord.record_id })
                .del();
            console.log(`[MODEL] Successfully DELETED record for Student: ${student_id}.`);
            return { success: true, message: "Attendance marked as absent (manual record removed)." };
        } catch (deleteErr) {
            console.error(`[MODEL ERROR] Error deleting attendance for ${student_id}:`, deleteErr);
            throw deleteErr; // Re-throw for generic errors
        }
    }
}

async function getAllAttendanceRecords() {
    return db('attendance_records')
        .select('*')
        .orderBy('attended_at', 'desc');
}

async function getStudentAttendanceHistory(studentId) {
    // 1. Get all sections the student is enrolled in
    const enrolledSections = await db('sections_students as ss')
        .join('sections as s', 'ss.section_id', 's.section_id')
        .join('courses as c', 's.course_code', 'c.course_code')
        .where('ss.student_id', studentId)
        .select('s.section_id', 's.section_name', 'c.course_code', 'c.course_name');

    if (enrolledSections.length === 0) {
        return [];
    }
    const enrolledSectionIds = enrolledSections.map(s => s.section_id);

    // 2. In a SINGLE query, find all dates that a class was held for ANY of those sections
    const allClassSessions = await db('attendance_records')
        .whereIn('section_id', enrolledSectionIds)
        .groupBy(db.raw("strftime('%Y-%m-%d', attended_at)"), 'section_id')
        .select(db.raw("strftime('%Y-%m-%d', attended_at) as session_date"), 'section_id');

    // 3. In a SINGLE query, get the student's personal attendance records for those sections
    const studentAttendance = await db('attendance_records')
        .where('student_id', studentId)
        .whereIn('section_id', enrolledSectionIds)
        .select(db.raw("strftime('%Y-%m-%d', attended_at) as attendance_date"), 'section_id', 'attended_at');

    // Create a fast lookup set of the student's presence
    const studentPresenceSet = new Set(studentAttendance.map(att => `${att.attendance_date}|${att.section_id}`));

    // 4. Merge the data in memory (which is extremely fast)
    const history = allClassSessions.map(session => {
        const sectionInfo = enrolledSections.find(s => s.section_id === session.section_id);
        const isPresent = studentPresenceSet.has(`${session.session_date}|${session.section_id}`);
        const attendanceRecord = isPresent
            ? studentAttendance.find(att => att.attendance_date === session.session_date && att.section_id === session.section_id)
            : null;
        
        return {
            course_code: sectionInfo.course_code,
            course_name: sectionInfo.course_name,
            section_name: sectionInfo.section_name,
            date: session.session_date,
            status: isPresent ? 'Present' : 'Absent',
            attended_at: attendanceRecord ? attendanceRecord.attended_at : null
        };
    });

    // Sort by date descending
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
}


export default {
    recordAttendance,
    getAttendanceByStudentSectionDate,
    getDetailedAttendanceForSectionByDate,
    updateStudentAttendance,
    getAllAttendanceRecords,
    findById,
    findAttendanceBySection,
    findAttendanceByStudent,
    hasStudentAttendedWithQr,
    findAttendanceForSections,
    getStudentAttendanceHistory,
    hasStudentAttendedSession,
    findAttendanceBySessionId,
};