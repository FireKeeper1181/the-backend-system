import express from "express";
import authMiddleware from "../middleware/auth.js";
import reportsModel from "../db/models/reports.js";

const router = express.Router();


router.get("/reports/dashboard-summary", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const summaryData = await reportsModel.getDashboardSummary();
        res.json(summaryData);
    } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        res.status(500).json({ message: "Failed to fetch dashboard summary data." });
    }
});


// GET /api/reports/attendance - Generate a comprehensive attendance report
// Accessible only by Admins for a full system-wide report
router.get("/reports/attendance", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        // We get the filters from the query parameters sent by the frontend
        const { startDate, endDate, course_code, lecturer_id } = req.query;

        const filters = {
            startDate,
            endDate,
            course_code,
            lecturer_id
        };

        const reportData = await reportsModel.generateAttendanceReport(filters);

        // We will fake the "is_present: false" records for now as the table only stores presence.
        // A more advanced implementation would involve calendar tables.
        // For now, this is a placeholder to make the frontend summary cards work.
        // We will assume all records returned are "present". We can add absent logic later if needed.

        res.json(reportData);

    } catch (error) {
        console.error("Error generating attendance report:", error);
        res.status(500).json({ message: "Failed to generate attendance report." });
    }
});

// Endpoint to get audit logs for different tables
router.get("/reports/logs/:logType", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { logType } = req.params;
        const validTypes = ['students', 'lecturers', 'courses', 'sections'];
        if (!validTypes.includes(logType)) {
            return res.status(400).json({ message: "Invalid log type specified." });
        }
        const logData = await reportsModel.getAuditLogs(logType);
        res.json(logData);
    } catch (error) {
        console.error(`Error fetching ${req.params.logType} logs:`, error);
        res.status(500).json({ message: "Failed to fetch audit logs." });
    }
});

// Endpoint to get the list of at-risk students
router.get("/reports/at-risk-students", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const students = await reportsModel.getAtRiskStudents();
        res.json(students);
    } catch (error) {
        console.error("Error fetching at-risk students:", error);
        res.status(500).json({ message: "Failed to fetch at-risk students." });
    }
});

// Endpoint to get details for a specific course
router.get("/reports/course-details/:courseCode", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { courseCode } = req.params;
        const details = await reportsModel.getCourseDetails(courseCode);
        res.json(details);
    } catch (error) {
        console.error(`Error fetching details for course ${req.params.courseCode}:`, error);
        res.status(500).json({ message: "Failed to fetch course details." });
    }
});

export default router;