import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

import authMiddleware from "../middleware/auth.js"

import studentsModel from "../db/models/students.js"
import lecturersModel from '../db/models/lecturers.js'

const router = express.Router()

// Utility function to generate JWT token
const generateToken = (user) => {
    const payload = {
        id: user.student_id || user.lecturer_id, // Use the appropriate ID field (no admin_id)
        email: user.email,
        role: user.role, 
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};


// Helper to find user by email across all roles
const findUserByEmail = async (email) => {
    let user = await studentsModel.findByEmail(email);
    if (user) return { ...user, role: 'student' };

    user = await lecturersModel.findByEmail(email);

    if (user) {
        if (user.is_admin) {
            return { ...user, role: 'admin' };
        }
        return { ...user, role: 'lecturer' };
    }

    return null;
};


// POST /api/login, Authenticate user
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials: User not found." });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials: Incorrect password." });
        }

        // Generate JWT token including role and is_admin if applicable
        const token = generateToken(user);

        // Do not send password hash in response
        const { password_hash: _, ...userWithoutPassword } = user;

        res.json({ message: "Login successful", token, user: userWithoutPassword });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "An unexpected error occurred during login." });
    }
});


//POST /api/logout, logout user
router.post("/logout", authMiddleware.authenticateToken, (req, res) => {
    res.status(200).json({ message: "Logged out successfully."})
})


//GET /api/verify, frontend verification
router.get("/verify", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const user = await findUserByEmail(req.user.email)

        if (!user) {
            return res.status(404).json({ message: "User not found after token verification." })
        }

        const { password_hash: _, ...userWithoutPassword } = user

        res.status(200).json(userWithoutPassword)

    } catch (error) {
        console.error("Token verification error: ", error)
        res.status(500).json({ message: "Failed to verify token. "})
    }
})


export default router;