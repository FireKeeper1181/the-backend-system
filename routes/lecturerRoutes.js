import express from "express";
import authMiddleware from "../middleware/auth.js";
import reportsModel from "../db/models/reports.js";

const router = express.Router();


// GET /api/lecturers/:lecturer_id/dashboard-summary
router.get("/lecturers/:lecturer_id/dashboard-summary", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { lecturer_id } = req.params;

        // Authorization check: A lecturer can only view their own dashboard
        if (req.user.role === 'lecturer' && req.user.id !== parseInt(lecturer_id)) {
            return res.status(403).json({ message: "Forbidden: You can only view your own dashboard summary." });
        }

        const summaryData = await reportsModel.getLecturerDashboardSummary(parseInt(lecturer_id));
        res.json(summaryData);

    } catch (error) {
        console.error("Error fetching lecturer dashboard summary:", error);
        res.status(500).json({ message: "Failed to fetch dashboard summary." });
    }
});

export default router;