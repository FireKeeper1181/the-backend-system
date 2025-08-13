import express from 'express';
import bcrypt from 'bcrypt';

import studentsModel from '../db/models/students.js';
import lecturersModel from '../db/models/lecturers.js';
import sectionsModel from "../db/models/sections.js"
import attendanceRecordsModel from "../db/models/attendance_records.js"
import sectionsStudentsModel from "../db/models/sections_students.js"
import subscriptionsModel from '../db/models/subscriptions.js';

import authMiddleware from "../middleware/auth.js"
import pushService from '../services/push-service.js';
import attendanceChecker from '../services/attendance-checker.js';

const router = express.Router()





//GET /api/admin/users, get all users (Admin only)
router.get("/admin/users", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const students = await studentsModel.findAll();
        const lecturers = await lecturersModel.findAll();
        // REMOVE OR ADJUST THIS LINE IF YOU DON'T WANT TO LIST ADMINS OR ONLY WANT LECTURER-ADMINS:
        // const admins = await adminsModel.findAll();
        // If you want to show lecturers who are admins, you might add a filter to the lecturers query:
        // const admins = lecturers.filter(lec => lec.is_admin); // Assuming findAll fetches is_admin

        res.json({ students, lecturers /*, admins*/ }); // Adjust response based on above decision
    } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: "Failed to retrieve users." });
    }
});


// GET /api/students - Get all students (for populating lists)
router.get("/students", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const students = await studentsModel.findAll();
        res.json(students);
    } catch (error) {
        console.error("Error fetching all students:", error);
        res.status(500).json({ message: "Failed to retrieve students." });
    }
});


//GET /api/admin/lecturers, get all lecturers (Admin Only)
router.get("/admin/lecturers", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const lecturers = await lecturersModel.findAll();
        res.json(lecturers);
    } catch (error) {
        console.error("Error fetching lecturers:", error);
        res.status(500).json({ message: "Failed to retrieve lecturers." });
    }
});


//GET /api/admin/lecturers/:lecturer_id, get lecturer by ID (Admin only)
router.get("/admin/lecturers/:lecturer_id", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { lecturer_id } = req.params;
        const lecturer = await lecturersModel.findById(parseInt(lecturer_id));
        if (!lecturer) {
            return res.status(404).json({ message: "Lecturer not found." });
        }
        res.json(lecturer);
    } catch (error) {
        console.error("Error fetching lecturer by ID:", error);
        res.status(500).json({ message: "Failed to retrieve lecturer." });
    }
});


// GET /api/lecturers/:lecturer_id/sections - Get all sections assigned to a specific lecturer
router.get("/lecturers/:lecturer_id/sections", authMiddleware.authenticateToken, async (req, res) => {
    const { lecturer_id } = req.params;

    // Authorization: A lecturer can only see their own sections, Admin can see any.
    if (req.user.role === 'lecturer' && req.user.id !== parseInt(lecturer_id)) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own sections.' });
    }
    if (req.user.role !== 'lecturer' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only lecturers and admins can access sections.' });
    }

    try {
        const lecturerSections = await sectionsModel.findSectionsByLecturerId(parseInt(lecturer_id));

        if (!lecturerSections || lecturerSections.length === 0) {
            // Check if lecturer exists
            const lecturerExists = await lecturersModel.findById(parseInt(lecturer_id));
            if (!lecturerExists) {
                return res.status(404).json({ message: 'Lecturer not found.' });
            }
            // Lecturer exists but has no assigned sections
            return res.status(200).json([]);
        }

        res.status(200).json(lecturerSections);
    } catch (error) {
        console.error('Error fetching lecturer sections:', error);
        res.status(500).json({ message: 'Internal server error while fetching lecturer sections.' });
    }
});


//GET /api/lecturers/:lecturer_id/attendance-reports, get attendance reports for lecturer's sections
router.get("/lecturers/:lecturer_id/attendance-reports", authMiddleware.authenticateToken, async (req, res) => {
    const { lecturer_id } = req.params;
    const { startDate, endDate, course_code, section_id } = req.query;

    if (req.user.role === "lecturer" && req.user.id !== parseInt(lecturer_id)) {
        return res.status(403).json({ message: "Forbidden: You can only view your own attendance reports." });
    }
    if (req.user.role !== "lecturer" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Only lecturers and admins can access attendance reports." });
    }

    try {
        const lecturerSections = await sectionsModel.findSectionsByLecturerId(parseInt(lecturer_id));
        if (!lecturerSections || lecturerSections.length === 0) {
            return res.json([]); // Return empty array if no sections
        }

        let sectionIdsToQuery = lecturerSections.map(section => section.section_id);

        // Filter by course if provided
        if (course_code) {
            sectionIdsToQuery = lecturerSections
                .filter(s => s.course_code === course_code)
                .map(s => s.section_id);
        }
        
        // Filter by a specific section if provided
        if (section_id) {
            const parsedSectionId = parseInt(section_id);
            if (sectionIdsToQuery.includes(parsedSectionId)) {
                sectionIdsToQuery = [parsedSectionId];
            } else {
                return res.json([]); // Section not taught by this lecturer
            }
        }

        if (sectionIdsToQuery.length === 0) {
            return res.json([]); // No matching sections after filtering
        }
        
        const attendanceReports = await attendanceRecordsModel.findAttendanceForSections(
            sectionIdsToQuery,
            startDate, // Pass the string directly
            endDate,   // Pass the string directly
            course_code
        );

        res.status(200).json(attendanceReports); // <-- SIMPLIFIED: Just send the data from the model

    } catch (error) {
        console.error("Error fetching lecturer attendance reports:", error);
        res.status(500).json({ message: "Internal server error while fetching attendance reports." });
    }
});


//POST /api/admin/lecturers, create new lecturer (Admin only)
router.post("/admin/lecturers", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { name, email, password, is_admin } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required for lecturer registration." });
        }

        const lecturer = await lecturersModel.add({ name, email, password, is_admin });

        // Do not send password hash in response
        const { password: _, ...lecturerWithoutPassword } = lecturer;
        res.status(201).json({ message: "Lecturer registered successfully.", lecturer: lecturerWithoutPassword });
        
    } catch (error) {
        console.error("Error registering lecturer:", error);
        if (error.message.includes("SQLITE_CONSTRAINT: UNIQUE")) {
            return res.status(409).json({ message: "Email already registered for a lecturer." });
        }
        res.status(500).json({ message: "Failed to register lecturer." });
    }
});


//POST /api/attendance/update, update or create student attendance (manual override)
router.post("/attendance/update", authMiddleware.authenticateToken, async (req, res) => {
    const { section_id, student_id, report_date, is_present } = req.body;

    console.log(`[ROUTE] Received attendance update for Student: ${student_id}, Section: ${section_id}, Date: ${report_date}, Present: ${is_present}`);

    const lecturer_id_from_token = req.user.id;
    const role = req.user.role;

    

    if (!section_id || !student_id || !report_date || typeof is_present !== 'boolean') {
        return res.status(400).json({ message: "Missing required fields: section_id, student_id, report_date, is_present." });
    }

    try {
        // Security Check: Ensure the requesting lecturer is assigned to this section, or is an admin
        if (role === 'lecturer') {
            const section = await sectionsModel.findById(parseInt(section_id)); // Assuming findById exists in sectionsModel
            if (!section || section.lecturer_id !== lecturer_id_from_token) {
                return res.status(403).json({ message: 'Forbidden: You are not assigned to manage attendance for this section.' });
            }
        } else if (role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only lecturers and admins can update attendance.' });
        }

        console.log(`[ROUTE] Calling updateStudentAttendance model with Section ID: ${parseInt(section_id)}, Student ID: ${parseInt(student_id)}, Report Date: ${report_date}, Is Present: ${is_present}`);

        const result = await attendanceRecordsModel.updateStudentAttendance(
            parseInt(section_id),
            student_id,
            report_date, // Date will be passed as YYYY-MM-DD string
            is_present
            // lecturer_id_from_token // No need to pass this directly if not used in model logic
        );

        // --- ADD THESE LOGS ---
        console.log(`[ROUTE] Update model returned:`, result);

        if (!result.success) {
            // Return specific error message from model if operation failed or was not allowed
            return res.status(400).json({ message: result.message });
        }

        res.status(200).json({ message: result.message || "Attendance updated successfully." });

    } catch (error) {
        console.error(`[ROUTE ERROR] Error updating student attendance for ${student_id} in section ${section_id} on ${report_date}:`, error);
        console.error("Error updating student attendance:", error);
        res.status(500).json({ message: "Internal server error while updating attendance." });
    }
});


//PUT /api/admin/lecturers/:lecturer_id, update lecturer details
router.put("/admin/lecturers/:lecturer_id", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { lecturer_id } = req.params;
        const { name, email, password, is_admin } = req.body; // <-- ADD is_admin here
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (password) updates.password = password; // Pass plaintext password to model for hashing
        if (is_admin !== undefined) updates.is_admin = is_admin; // <-- ADD this line

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No update data provided." });
        }

        const updated = await lecturersModel.update(parseInt(lecturer_id), updates); // Model handles hashing
        if (!updated) {
            return res.status(404).json({ message: "Lecturer not found or no changes made." });
        }
        res.status(200).json({ message: "Lecturer updated successfully." });
    } catch (error) {
        console.error("Error updating lecturer:", error);
        if (error.message.includes("SQLITE_CONSTRAINT: UNIQUE")) {
            return res.status(409).json({ message: "Email already registered for another lecturer." });
        }
        res.status(500).json({ message: "Failed to update lecturer." });
    }
});


//DEL /api/admin/lecturers/:lecturer_id, delete a lecturer (Admin only)
router.delete("/admin/lecturers/:lecturer_id", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { lecturer_id } = req.params;
        const deleted = await lecturersModel.remove(parseInt(lecturer_id));

        if (!deleted) {
            return res.status(404).json({ message: "Lecturer not found." });
        }

        res.status(200).json({ message: "Lecturer deleted successfully." });
        
    } catch (error) {
        console.error("Error deleting lecturer:", error);

        if (error.message === "Lecturer cannot be deleted as they are assigned to section or have associated data.") {
            return res.status(409).json({ message: error.message })
        }
        res.status(500).json({ message: "Failed to delete lecturer." });
    }
});





//GET /api/admin/students, get all students (Admin only)
router.get("/admin/students", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const students = await studentsModel.findAll();
        res.json(students);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Failed to retrieve students." });
    }
});


//GET /api/admin/students/:student_id, get student by ID
router.get("/admin/students/:student_id", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { student_id } = req.params;
        const student = await studentsModel.findById(student_id);
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }
        res.json(student);
    } catch (error) {
        console.error("Error fetching student by ID:", error);
        res.status(500).json({ message: "Failed to retrieve student." });
    }
});


//GET /api/students/:student_id/courses, get courses a student is enrolled in
router.get("/students/:student_id/courses", authMiddleware.authenticateToken, async (req, res) => {
    const { student_id } = req.params;

    // Authorization: A student can only see their own courses, Admin can see any.
    if (req.user.role === 'student' && req.user.id !== student_id) {
         return res.status(403).json({ message: 'Forbidden: You can only view your own courses.' });
    }
    
    if (req.user.role !== 'student' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only students and admins can access student courses.' });
    }

    try {
        // Find all sections the student is enrolled in
        const enrolledSections = await sectionsStudentsModel.findSectionsForAStudent(student_id);

        if (!enrolledSections || enrolledSections.length === 0) {
            // Check if the student_id itself is valid before returning 404 for no enrollments
            const studentExists = await studentsModel.findById(student_id);
            if (!studentExists) {
                return res.status(404).json({ message: 'Student not found.' });
            }
            return res.status(200).json([]); // Student exists but is not enrolled in any courses
        }


        res.status(200).json(enrolledSections);

    } catch (error) {
        console.error('Error fetching student courses:', error);
        res.status(500).json({ message: 'Internal server error while fetching student courses.' });
    }
});


//GET /api/attendance-reports/details/:section_id/:report_date, get detailed attendance for a specific section and date
router.get("/attendance-reports/details/:section_id/:report_date", authMiddleware.authenticateToken, async (req, res) => {
    const { section_id, report_date } = req.params;
    const lecturer_id_from_token = req.user.id;
    const role = req.user.role;

    try {
        // Security Check: Ensure the requesting lecturer is assigned to this section, or is an admin
        if (role === 'lecturer') {
            const section = await sectionsModel.findById(parseInt(section_id)); // Assuming findById exists in sectionsModel
            if (!section || section.lecturer_id !== lecturer_id_from_token) {
                return res.status(403).json({ message: 'Forbidden: You are not assigned to this section.' });
            }
        } else if (role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only lecturers and admins can view detailed attendance.' });
        }

        const details = await attendanceRecordsModel.getDetailedAttendanceForSectionByDate(
            parseInt(section_id),
            report_date // Date will be passed as YYYY-MM-DD string
        );

        res.status(200).json(details);
    } catch (error) {
        console.error("Error fetching detailed attendance report:", error);
        res.status(500).json({ message: "Internal server error while fetching detailed attendance report." });
    }
});



//POST /api/admin/students, create a new student (Admin only)
router.post("/admin/students", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { student_id, name, email, password } = req.body;

        if (!student_id || !name || !email || !password) {
            return res.status(400).json({ message: "Student ID, name, email, and password are required for student registration." });
        }

        const student = await studentsModel.add({ student_id, name, email, password });

        const { password: _, ...studentWithoutPassword } = student;
        res.status(201).json({ message: "Student registered successfully.", student: studentWithoutPassword });
        
    } catch (error) {
        console.error("Error registering student:", error);
        if (error.message.includes("SQLITE_CONSTRAINT: UNIQUE")) {
            return res.status(409).json({ message: "Student ID or email already registered." });
        }
        res.status(500).json({ message: "Failed to register student." });
    }
});


//PUT /api/admin/students/:student_id, update student details
router.put("/admin/students/:student_id", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { student_id } = req.params;
        const { name, email, password } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (password) updates.password = await bcrypt.hash(password, 10); // Re-hash password if updated

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No update data provided." });
        }

        const updated = await studentsModel.update(student_id, updates);
        if (!updated) {
            return res.status(404).json({ message: "Student not found or no changes made." });
        }
        res.status(200).json({ message: "Student updated successfully." });
    } catch (error) {
        console.error("Error updating student:", error);
        if (error.message.includes("SQLITE_CONSTRAINT: UNIQUE")) {
            return res.status(409).json({ message: "Email or Student ID already registered for another student." });
        }
        res.status(500).json({ message: "Failed to update student." });
    }
});


//DEL /api/admin/students/:student_id, delete a student
router.delete("/admin/students/:student_id", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { student_id } = req.params;
        const deleted = await studentsModel.remove(student_id);
        if (!deleted) {
            return res.status(404).json({ message: "Student not found." });
        }
        res.status(200).json({ message: "Student deleted successfully." });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({ message: "Failed to delete student." });
    }
});

//POST /api/subscribe
router.post('/subscribe', authMiddleware.authenticateToken, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id;
  const userType = req.user.role; // Assuming 'role' is 'lecturer' or 'student'
  
  await subscriptionsModel.savePushSubscription(userId, userType, subscription);
  
  res.status(201).json({ message: 'Subscription saved.' });
});

//POST /api/notifications/send-test, a simple test route to send a notification to the logged-in user
router.post('/notifications/send-test', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { id, role } = req.user; // Get user info from the JWT

    const payload = {
      title: 'Hello from your Attendance App!',
      body: 'This is a test notification.',
    };

    await pushService.sendNotificationToUser(id, role, payload);
    
    res.status(200).json({ message: 'Test notification sent successfully.' });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: 'Failed to send test notification.' });
  }
});


//POST /api/admin/run-attendance-check, manually trigger the attendance check for testing
router.post('/admin/run-attendance-check', authMiddleware.authenticateAdmin, async (req, res) => {
  // Run the check but don't wait for it to finish
  attendanceChecker.runDailyCheck();
  // Immediately respond to the admin
  res.status(202).json({ message: 'Daily attendance check has been triggered. Check server logs for progress.' });
});




export default router
