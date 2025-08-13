import express from "express"

import qrcodesModel from "../db/models/qrcodes.js"
import attendanceRecordsModel from "../db/models/attendance_records.js"
import sectionsModel from "../db/models/sections.js"
import studentsModel from "../db/models/students.js"
import sectionsStudentsModel from "../db/models/sections_students.js"

import authMiddleware from "../middleware/auth.js"

const createAttendanceRoutes = (io) => {
    const router = express.Router()


    //GET /api/qrcodes/:qrcode_id, get QR code details
    router.get("/qrcodes/:qrcode_id", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
        try {
            const { qrcode_id } = req.params;
            const requestingUserRole = req.user.role;
            const requestingUserId = req.user.id;
            const requestingUserIsAdmin = req.user.is_admin;

            const qrcode = await qrcodesModel.findById(parseInt(qrcode_id));
            if (!qrcode) {
                return res.status(404).json({ message: "QR Code not found." });
            }

            // Authorization: Lecturer can only view QR codes for courses they teach
            if (requestingUserRole === "lecturer" && !requestingUserIsAdmin) { // If not an admin lecturer
                const lecturerSectionsForCourse = await sectionsModel.findSectionsByLecturerAndCourse(requestingUserId, qrcode.course_code);
                if (lecturerSectionsForCourse.length === 0) {
                    return res.status(403).json({ message: "Forbidden: You can only view QR codes for courses you are assigned to teach." });
                }
            }

            res.json(qrcode);

        } catch (error) {
            console.error("Error fetching QR code: ", error);
            res.status(500).json({ message: "Failed to retrieve QR code." });
        }
    });


    //POST /api/qrcodes, generate QR code for a course
     router.post("/qrcodes", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
        try {
            const { course_code, expires_in_minutes, session_id } = req.body;
            const requestingUserRole = req.user.role;
            const requestingUserId = req.user.id;
            const requestingUserIsAdmin = req.user.is_admin;

            if (!course_code) {
                return res.status(400).json({ message: "Course code is required to generate a QR code." });
            }

            // Verify the course exists (assuming coursesModel is imported where needed, e.g. in server.js or a central model import)
            // For this module, we'd need to import it too if course details are needed directly.
            // For now, relying on qrcodesModel itself to handle foreign key constraint
            // Or you can add:
            // import coursesModel from '../db/models/courses.js';
            // const course = await coursesModel.findByCode(course_code);
            // if (!course) { return res.status(404).json({ message: "Course not found." }); }

            // Authorization: Lecturer can only generate QR codes for courses they teach in *any* of their sections
            if (requestingUserRole === "lecturer" && !requestingUserIsAdmin) { // If not an admin lecturer
                const lecturerSectionsForCourse = await sectionsModel.findSectionsByLecturerAndCourse(requestingUserId, course_code);
                if (lecturerSectionsForCourse.length === 0) {
                    return res.status(403).json({ message: "Forbidden: Lecturers can only generate QR codes for courses they are assigned to teach." });
                }
            }

            const qrcode = await qrcodesModel.generateQrCode(course_code, expires_in_minutes, session_id);

            res.status(201).json({ message: "QR Code generated successfully.", qrcode: qrcode });

        } catch (error) {
            console.error("Error generating QR code: ", error);
            res.status(500).json({ message: "Failed to generate QR code." });
        }
    });


    //DEL /api/qrcodes/:qrcode_id, invalidate/delete a QR code
    router.delete("/qrcodes/:qrcode_id", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
        try {
            const { qrcode_id } = req.params;
            const requestingUserRole = req.user.role;
            const requestingUserId = req.user.id;
            const requestingUserIsAdmin = req.user.is_admin;

            const qrcode = await qrcodesModel.findById(parseInt(qrcode_id));
            if (!qrcode) {
                return res.status(404).json({ message: "QR Code not found." });
            }

            // Authorization: Lecturer can only invalidate QR codes for courses they teach
            if (requestingUserRole === "lecturer" && !requestingUserIsAdmin) { // If not an admin lecturer
                const lecturerSectionsForCourse = await sectionsModel.findSectionsByLecturerAndCourse(requestingUserId, qrcode.course_code);
                if (lecturerSectionsForCourse.length === 0) {
                    return res.status(403).json({ message: "Forbidden: You can only invalidate QR codes for courses you are assigned to teach." });
                }
            }

            const invalidated = await qrcodesModel.invalidateQrCode(parseInt(qrcode_id));

            if (!invalidated) {
                return res.status(404).json({ message: "QR Code not found or could not be invalidated." });
            }
            res.status(200).json({ message: "QR Code invalidated successfully." });

        } catch (error) {
            console.error("Error invalidating QR code: ", error);
            res.status(500).json({ message: "Failed to invalidate QR code." });
        }
    });




    //GET /api/sections/:section_id/attendance, get all attendance records for a section
    router.get("/sections/:section_id/attendance", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
        try {
            const { section_id } = req.params;
            const requestingUserRole = req.user.role;
            const requestingUserId = req.user.id;
            const requestingUserIsAdmin = req.user.is_admin;

            const section = await sectionsModel.findById(section_id);
            if (!section) {
                return res.status(404).json({ message: "Section not found." });
            }

            // Authorization: Lecturer can only view attendance for their own sections
            if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
                return res.status(403).json({ message: "Forbidden: You can only view attendance for your assigned sections." });
            }

            const attendance = await attendanceRecordsModel.findAttendanceBySection(parseInt(section_id));
            res.json(attendance);

        } catch (error) {
            console.error("Error fetching attendance for section: ", error);
            res.status(500).json({ message: "Failed to retrieve attendance for section." });
        }
    });

    //GET /api/attendance/session/:sessionId, get all enriched attendance records for a session
    router.get("/attendance/session/:sessionId", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
        try {
            const { sessionId } = req.params;

            if (!sessionId) {
                return res.status(400).json({ message: "Session ID is required." })
            }

            const attendance = await attendanceRecordsModel.findAttendanceBySessionId(sessionId)

            res.json(attendance)

        } catch (error) {
            console.error("Error fetching attendance for session: ", error);
            res.status(500).json({ message: "Failed to retrieve attendance for session." });  
        }
    })


    //GET /api/students/:student_id/attendance, get all attendance records for a specific student
    router.get("/students/:student_id/attendance", authMiddleware.authenticateToken, async (req, res) => {
        try {
            const { student_id } = req.params;
            const requestingUserRole = req.user.role;
            const requestingUserId = req.user.id;
            const requestingUserIsAdmin = req.user.is_admin;

            // Authorization:
            // Student can only view their own attendance
            // Lecturers and Admins can view any student's attendance
            if (requestingUserRole === "student" && requestingUserId !== student_id) {
                return res.status(403).json({ message: "Forbidden: Students can only view their own attendance records." });
            } else if (requestingUserRole === "lecturer" && !requestingUserIsAdmin) {
                // For a non-admin lecturer, they should only see attendance for students in sections they teach.
                // This check is more complex and might involve querying sections_students
                // For simplicity, we'll allow all lecturers to view any student's attendance for now,
                // or you can implement a more granular check here if needed.
                // Example of a more granular check (might be too complex for this route):
                // const studentSections = await sectionsStudentsModel.findSectionsForAStudent(student_id);
                // const lecturerSections = await sectionsModel.findSectionsByLecturerId(requestingUserId);
                // const canView = studentSections.some(sS => lecturerSections.some(lS => lS.section_id === sS.section_id));
                // if (!canView) {
                //     return res.status(403).json({ message: "Forbidden: You can only view attendance for students in your assigned sections." });
                // }
            }

            const student = await studentsModel.findById(student_id);
            if (!student) {
                return res.status(404).json({ message: "Student not found." });
            }

            const attendance = await attendanceRecordsModel.findAttendanceByStudent(student_id);
            res.json(attendance);

        } catch (error) {
            console.error("Error fetching attendance for student: ", error);
            res.status(500).json({ message: "Failed to retrieve attendance for student." });
        }
    });





    //POST /api/attendance/record, student records attendance by scanning QR code (Student only)
    router.post("/attendance/record", authMiddleware.authenticateToken, async (req, res) => {
        try {
            const { qr_string, section_id } = req.body;
            const requestingUserRole = req.user.role;
            const requestingUserId = req.user.id; // This will be the student_id

            if (requestingUserRole !== "student") {
                return res.status(403).json({ message: "Forbidden: Only students can record attendance via QR code." });
            }

            if (!qr_string || !section_id) {
                return res.status(400).json({ message: "QR string and student's section ID are required to record attendance." });
            }

            const validationResult = await qrcodesModel.validateQrCode(qr_string);

            if (!validationResult.isValid) {
                return res.status(400).json({ message: validationResult.message });
            }

            const qrcode = validationResult.qrcode;
            const course_code_from_qr = qrcode.course_code;
            const student_id = requestingUserId;
            const session_id = qrcode.session_id; 

            const section = await sectionsModel.findById(section_id);

            if (!section) {
                return res.status(404).json({ message: "Provided section not found." });
            }

            if (section.course_code !== course_code_from_qr) {
                return res.status(400).json({ message: "Provided section does not belong to the QR code's course." });
            }

            const isEnrolledInCourse = await studentsModel.isStudentInCourse(student_id, course_code_from_qr);
             
            if (!isEnrolledInCourse) {
                return res.status(403).json({ message: `Forbidden: You are not enrolled in the course associated with this QR code.`});
            }

            const hasAttendedSession = await attendanceRecordsModel.hasStudentAttendedSession(student_id, session_id);
            if (hasAttendedSession) {
                // It's not an error, just an acknowledged duplicate scan.
                return res.status(200).json({ message: "Attendance already recorded for this session." });
            }

            const newRecord = await attendanceRecordsModel.recordAttendance(
                student_id, 
                section_id, 
                qrcode.qrcode_id,
                session_id
            );

            if (newRecord) {
                // Fetch student name and potentially other details for the real-time update
                const studentDetails = await studentsModel.findById(student_id);

                // Emit real-time update to the specific section's room
                io.to(`section_${section_id}`).emit("attendance_update", {
                    record_id: newRecord.record_id,
                    student_id: studentDetails.student_id,
                    student_name: studentDetails.name,
                    section_id: section_id,
                    section_name: section.section_name,
                    session_id: session_id,
                    course_code: course_code_from_qr,
                    attended_at: new Date().toISOString(),
                });

                res.status(201).json({ message: "Attendance recorded successfully.", record: newRecord });
            } else {
                res.status(500).json({ message: "Failed to record attendance: No record created." });
            }

        } catch (error) {
            console.error("Error recording attendance: ", error);
            res.status(500).json({ message: "Failed to record attendance." });
        }
    });



    //GET /api/lecturers/:lecturer_id/attendance_reports, get attendance reports for sections taught by a specific lecturer
    router.get("/lecturers/:lecturer_id/attendance-reports", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
        try {
            const { lecturer_id } = req.params;
            const { startDate, endDate, section_id, course_code } = req.query; // Allow filtering

            // 1. Get all sections taught by this lecturer
            let sections = await sectionsModel.findSectionsByLecturerId(lecturer_id);
            if (!sections || sections.length === 0) {
                return res.status(404).json({ message: "No sections found for this lecturer." });
            }

            let filteredSectionIds = sections.map(s => s.section_id);

            // Apply filters if provided
            if (section_id) {
             filteredSectionIds = filteredSectionIds.filter(id => id == section_id);
                if (filteredSectionIds.length === 0) {
                    return res.status(404).json({ message: "Specified section not found or not taught by this lecturer." });
                }
            }
            if (course_code) {
                const sectionsForCourse = sections.filter(s => s.course_code === course_code).map(s => s.section_id);
                filteredSectionIds = filteredSectionIds.filter(id => sectionsForCourse.includes(id));
                if (filteredSectionIds.length === 0) {
                    return res.status(404).json({ message: "No sections found for this course taught by this lecturer." });
                }
            }

            // Convert date strings to Date objects if they exist
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            // 2. Get attendance records for these sections within the date range
            const attendanceRecords = await attendanceModel.findAttendanceForSections(filteredSectionIds, start, end);

            // 3. (Optional but recommended for reports): Enrich data with student/section/course details
            const detailedRecords = await Promise.all(attendanceRecords.map(async (record) => {
                const student = await usersModel.findByStudentId(record.student_id); // Assuming findByStudentId exists
                const section = sections.find(s => s.section_id === record.section_id);
                // You might need to fetch course details here too if not already in section object
                return {
                    ...record,
                    student_name: student ? student.user_name : 'Unknown Student',
                    section_name: section ? section.section_name : 'Unknown Section',
                    course_code: section ? section.course_code : 'Unknown Course'
                };
            }));


            res.json(detailedRecords);

        } catch (error) {
            console.error("Error fetching lecturer attendance reports:", error);
            res.status(500).json({ message: "Failed to retrieve attendance reports." });
        }
    });

    return router
}


export default createAttendanceRoutes