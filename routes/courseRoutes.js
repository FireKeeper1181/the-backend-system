import express from "express"
import authMiddleware from "../middleware/auth.js"

import coursesModel from "../db/models/courses.js"
import sectionsStudentsModel from "../db/models/sections_students.js"
import sectionsModel from "../db/models/sections.js"

const router = express.Router()



//GET /api/admin/courses, get all courses (Admin only)
router.get("/admin/courses", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const courses = await coursesModel.findAll();
        res.json(courses);
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({ message: "Failed to retrieve courses." });
    }
});


//GET /api/admin/courses/:course_code, get course by code
router.get("/admin/courses/:course_code", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { course_code } = req.params;
        const course = await coursesModel.findByCode(course_code);
        if (!course) {
            return res.status(404).json({ message: "Course not found." });
        }
        res.json(course);
    } catch (error) {
        console.error("Error fetching course by code:", error);
        res.status(500).json({ message: "Failed to retrieve course." });
    }
});


//GET /api/courses/:course_code/sections, get all sections that belong to a course
router.get("/courses/:course_code/sections", authMiddleware.authenticateToken, async (req, res) => {

    // Roles like lecturer or student might need access to view sections for a course they are part of.
    // You'd check req.user.role and potentially verify enrollment/assignment.
    if (req.user.role !== 'admin' && req.user.role !== 'lecturer' && req.user.role !== 'student') {
        return res.status(403).json({ message: 'Forbidden.' });
    }

    const { course_code } = req.params;

    try {
        const sections = await sectionsModel.findSectionsByCourseCode(course_code);

        if (!sections || sections.length === 0) {
            // Check if the course itself is valid before returning 404 for no sections
            const courseExists = await coursesModel.findByCode(course_code);
            if (!courseExists) {
                return res.status(404).json({ message: `Course not found: ${course_code}.` });
            }
            return res.status(200).json([]); // Course exists but has no sections
        }

        res.status(200).json(sections);

    } catch (error) {
        console.error('Error fetching sections by course code:', error);
        res.status(500).json({ message: 'Internal server error while fetching sections.' });
    }
});


//GET /api/courses/:course_code/enrollments, get all unique students enrolled across all sections of a given course
router.get("/courses/:course_code/enrollments", authMiddleware.authenticateToken, async (req, res) => {

    //roles like lecturer (for courses they teach) or admin should have access.
    if (req.user.role !== 'admin' && req.user.role !== 'lecturer') { // Assuming students shouldn't see all enrollments for a course
        return res.status(403).json({ message: 'Forbidden.' });
    }

    const { course_code } = req.params;

    try {
        const sections = await sectionsModel.findSectionsByCourseCode(course_code);

        if (!sections || sections.length === 0) {
            // Check if the course itself is valid before returning 404 for no sections
            const courseExists = await coursesModel.findByCode(course_code);
            if (!courseExists) {
                return res.status(404).json({ message: `Course not found: ${course_code}.` });
            }
            return res.status(200).json([]); // Course exists but has no sections (and thus no enrollments)
        }

        const uniqueStudents = new Map(); // Using a Map to store unique students by student_id

        // For each section, find the enrolled students
        for (const section of sections) {
            const studentsInSection = await sectionsStudentsModel.findStudentsInASection(section.section_id);

            // Add unique students to our map
            studentsInSection.forEach(student => {
                if (!uniqueStudents.has(student.student_id)) {
                    uniqueStudents.set(student.student_id, {
                        student_id: student.student_id,
                        student_name: student.student_name,
                        student_email: student.student_email
                    });
                }
            });
        }

        // Convert Map values to an array for the response
        const enrolledStudents = Array.from(uniqueStudents.values());

        res.status(200).json(enrolledStudents);

    } catch (error) {
        console.error('Error fetching course enrollments:', error);
        res.status(500).json({ message: 'Internal server error while fetching course enrollments.' });
    }
});


//GET /api/courses/:course_code/sections, fetch all sections for a given course, regardless of the lecturer
router.get("/courses/:course_code/sections", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { course_code } = req.params
        const sections = await sectionsModel.findSectionsByCourseCode(course_code)

        if (!sections || sections.length === 0) {
            return res.status(404).json({ message: "No sections found for this course." })
        }

        res.json(sections)

    } catch (error) {
        console.error("Error fetching sections for course: ", error)
        res.status(500).json({ message: "Failed to retrieve sections."})
    }
})


//POST /api/admin/courses, create a new course (Admin only)
router.post("/admin/courses", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { course_code, course_name } = req.body;
        if (!course_code || !course_name) {
            return res.status(400).json({ message: "Course code and course name are required." });
        }

        const course = await coursesModel.add({ course_code, course_name });
        res.status(201).json({ message: "Course created successfully.", course });
    } catch (error) {
        console.error("Error creating course:", error);
        if (error.message.includes("SQLITE_CONSTRAINT: UNIQUE")) {
            return res.status(409).json({ message: "Course code already exists." });
        }
        res.status(500).json({ message: "Failed to create course." });
    }
});


//PUT /api/admin/courses/:course_code, update course details
router.put("/admin/courses/:course_code", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { course_code } = req.params;
        const { course_name } = req.body;
        if (!course_name) {
            return res.status(400).json({ message: "Course name is required for update." });
        }

        const updated = await coursesModel.update(course_code, { course_name });
        if (!updated) {
            return res.status(404).json({ message: "Course not found or no changes made." });
        }
        res.status(200).json({ message: "Course updated successfully." });
    } catch (error) {
        console.error("Error updating course:", error);
        res.status(500).json({ message: "Failed to update course." });
    }
});


//DEL /api/admin/courses/:course_code, delete a course
router.delete("/admin/courses/:course_code", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const { course_code } = req.params;
        const deleted = await coursesModel.remove(course_code);
        if (!deleted) {
            return res.status(404).json({ message: "Course not found." });
        }
        res.status(200).json({ message: "Course deleted successfully." });
    } catch (error) {
        console.error("Error deleting course:", error);
        res.status(500).json({ message: "Failed to delete course." });
    }
});

// GET /api/courses - Get all courses (for populating dropdowns for Lecturers/Admins)
router.get("/courses", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const courses = await coursesModel.findAll();
        res.json(courses);
    } catch (error) {
        console.error("Error fetching all courses:", error);
        res.status(500).json({ message: "Failed to retrieve courses." });
    }
});


export default router;