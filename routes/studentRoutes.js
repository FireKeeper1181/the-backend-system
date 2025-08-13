import express from "express";
import authMiddleware from "../middleware/auth.js";
import sectionsStudentsModel from "../db/models/sections_students.js";
import attendanceRecordsModel from "../db/models/attendance_records.js";

const router = express.Router();

// Middleware to ensure the user is a student for these routes
const isStudent = (req, res, next) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Forbidden: Student access only." });
    }
    next();
};

// GET /api/student/courses - Get all courses/sections the logged-in student is enrolled in
router.get("/student/courses", authMiddleware.authenticateToken, isStudent, async (req, res) => {
    try {
        const studentId = req.user.id; // Get student_id from the verified token
        const enrolledSections = await sectionsStudentsModel.findSectionsForAStudent(studentId);
        res.json(enrolledSections);
    } catch (error) {
        console.error("Error fetching student courses:", error);
        res.status(500).json({ message: "Failed to retrieve your courses." });
    }
});

// GET /api/student/attendance - Get all attendance records for the logged-in student
router.get("/student/attendance", authMiddleware.authenticateToken, isStudent, async (req, res) => {
    try {
        const studentId = req.user.id;
        const attendance = await attendanceRecordsModel.getStudentAttendanceHistory(studentId); // <-- NEW FUNCTION
        res.json(attendance);
    } catch (error) {
        console.error("Error fetching student attendance:", error);
        res.status(500).json({ message: "Failed to retrieve your attendance records." });
    }
});

// GET /api/student/attendance-history - Get a full history including absences
router.get("/student/attendance-history", authMiddleware.authenticateToken, isStudent, async (req, res) => {
    try {
        const studentId = req.user.id;
        const history = await attendanceRecordsModel.getStudentAttendanceHistory(studentId);
        res.json(history);
    } catch (error) {
        console.error("Error fetching student attendance history:", error);
        res.status(500).json({ message: "Failed to retrieve attendance history." });
    }
});

export default router;