import express from "express"

import sectionsModel from '../db/models/sections.js';
import coursesModel from '../db/models/courses.js';
import sectionsStudentsModel from '../db/models/sections_students.js';
import studentsModel from '../db/models/students.js';
import lecturersModel from '../db/models/lecturers.js'; 

import authMiddleware from "../middleware/auth.js"

const router = express.Router()



//GET /api/sections, get all sections (Admin only)
router.get("/sections", authMiddleware.authenticateAdmin, async (req, res) => {
    try {
        const sections = await sectionsModel.findAll();
        res.json(sections);
    } catch (error) {
        console.error("Error fetching all sections:", error);
        res.status(500).json({ message: "Failed to retrieve sections." });
    }
});


//GET /api/sections/:section_id, get section by ID
router.get("/sections/:section_id", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        const section = await sectionsModel.findById(parseInt(section_id));
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only view their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only view your assigned sections." });
        }

        res.json(section);
    } catch (error) {
        console.error("Error fetching section by ID:", error);
        res.status(500).json({ message: "Failed to retrieve section." });
    }
});

//GET /api/courses/:course_code/enrolled-students, gets all students enrolled in any section of a specific courses
router.get("/courses/:course_code/enrolled-students", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { course_code } = req.params;
        const students = await sectionsStudentsModel.findStudentsByCourse(course_code);
        res.json(students);
    } catch (error) {
        console.error("Error fetching students by course:", error);
        res.status(500).json({ message: "Failed to retrieve students for the course." });
    }
});


//GET /api/lecturers/:lecturer_id/sections, get sections assigned to a lecturer
router.get("/lecturers/:lecturer_id/sections", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { lecturer_id } = req.params;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        // Authorization: Lecturer can only view their own sections, Admin can view any
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && requestingUserId !== parseInt(lecturer_id)) {
            return res.status(403).json({ message: "Forbidden: You can only view sections assigned to yourself." });
        }

        const sections = await sectionsModel.findSectionsByLecturerId(parseInt(lecturer_id));
        res.json(sections);
    } catch (error) {
        console.error("Error fetching sections by lecturer ID:", error);
        res.status(500).json({ message: "Failed to retrieve sections." });
    }
});


//POST /api/section, create a new section
router.post("/sections", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_name, course_code, lecturer_id } = req.body;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id; // lecturer_id or admin_id from token

        if (!section_name || !course_code || !lecturer_id) {
            return res.status(400).json({ message: "Section name, course code, and lecturer ID are required." });
        }

        // Admin can assign any lecturer. Lecturer can only create sections for themselves.
        if (requestingUserRole === "lecturer" && requestingUserId !== lecturer_id) {
            // If the lecturer who is requesting is NOT an admin, they can only create a section for themselves.
            // If they ARE an admin, they can assign to others (handled by authMiddleware.authenticateLecturerOrAdmin allowing admins)
            const lecturerFromToken = await lecturersModel.findById(requestingUserId);
            if (!lecturerFromToken || !lecturerFromToken.is_admin) { // If not an admin lecturer
                return res.status(403).json({ message: "Forbidden: Lecturers can only create sections for themselves." });
            }
        }


        // Verify course exists
        const course = await coursesModel.findByCode(course_code);
        if (!course) {
            return res.status(404).json({ message: "Course not found." });
        }

        // Verify assigned lecturer exists
        const assignedLecturer = await lecturersModel.findById(lecturer_id);
        if (!assignedLecturer) {
            return res.status(404).json({ message: "Assigned lecturer not found." });
        }

        const section = await sectionsModel.add({ section_name, course_code, lecturer_id });
        res.status(201).json({ message: "Section created successfully.", section });
    } catch (error) {
        console.error("Error creating section:", error);
        res.status(500).json({ message: "Failed to create section." });
    }
});


//PUT /api/sections/:section_id, update section details
router.put("/sections/:section_id", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const { section_name, course_code, lecturer_id } = req.body;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        const updates = {};
        if (section_name) updates.section_name = section_name;
        if (course_code) updates.course_code = course_code;
        if (lecturer_id) updates.lecturer_id = lecturer_id;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No update data provided." });
        }

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only update their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only update your assigned sections." });
        }

        // If updating course_code, verify it exists
        if (course_code) {
            const course = await coursesModel.findByCode(course_code);
            if (!course) {
                return res.status(404).json({ message: "New course code not found." });
            }
        }

        // If updating lecturer_id, verify new lecturer exists (Admin only can reassign)
        if (lecturer_id) {
            // Only Admins can reassign a section to a different lecturer.
            if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && lecturer_id !== requestingUserId) {
                return res.status(403).json({ message: "Forbidden: Lecturers cannot reassign sections to other lecturers." });
            }

            // Verify new lecturer exists if provided
            const newLecturer = await lecturersModel.findById(lecturer_id);
            if (!newLecturer) {
                return res.status(404).json({ message: "New lecturer not found." });
            }
        }


        const updated = await sectionsModel.update(parseInt(section_id), updates);
        if (!updated) {
            return res.status(404).json({ message: "Section not found or no changes made." });
        }
        res.status(200).json({ message: "Section updated successfully." });
    } catch (error) {
        console.error("Error updating section:", error);
        res.status(500).json({ message: "Failed to update section." });
    }
});


//DEL /api/sections/:section_id, delete a section
router.delete("/sections/:section_id", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only delete their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only delete your assigned sections." });
        }

        const deleted = await sectionsModel.remove(parseInt(section_id));
        if (!deleted) {
            return res.status(404).json({ message: "Section not found." });
        }
        res.status(200).json({ message: "Section deleted successfully." });
    } catch (error) {
        console.error("Error deleting section:", error);
        res.status(500).json({ message: "Failed to delete section." });
    }
});


//GET /api/sections/:section_id/student, get all students in a section
router.get("/sections/:section_id/students", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only view students in their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only view students in your assigned sections." });
        }

        const students = await sectionsStudentsModel.findStudentsInASection(parseInt(section_id));
        res.json(students);
    } catch (error) {
        console.error("Error fetching students in section:", error);
        res.status(500).json({ message: "Failed to retrieve students in section." });
    }
});


//POST /api/sections/:section_id/students, add a student to a section
router.post("/sections/:section_id/students", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const { student_id } = req.body;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        if (!student_id) {
            return res.status(400).json({ message: "Student ID is required." });
        }

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only manage students in their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only add students to your assigned sections." });
        }

        // Verify student exists
        const student = await studentsModel.findById(student_id);
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }

        const isEnrolled = await sectionsStudentsModel.isStudentEnrolled(parseInt(section_id), student_id);
        if (isEnrolled) {
            return res.status(409).json({ message: "Student already enrolled in this section." });
        }

        const enrollment = await sectionsStudentsModel.addStudentToSection(parseInt(section_id), student_id);
        res.status(201).json({ message: "Student added to section successfully.", enrollment });
    } catch (error) {
        console.error("Error adding student to section:", error);
        res.status(500).json({ message: "Failed to add student to section." });
    }
});


//POST /api/sections/:section_id/students/batch-add, add multiple students to a section
router.post("/sections/:section_id/students/batch-add", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const { student_ids } = req.body; // Expect an array of student_ids
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ message: "An array of student_ids is required." });
        }

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only manage students in their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only add students to your assigned sections." });
        }

        // Validate that all student_ids exist before attempting to add
        const existingStudents = await studentsModel.findByIds(student_ids);
        if (existingStudents.length !== student_ids.length) {
            const foundIds = existingStudents.map(s => s.student_id);
            const notFoundIds = student_ids.filter(id => !foundIds.includes(id));
            return res.status(400).json({ message: `One or more student IDs not found: ${notFoundIds.join(", ")}` });
        }

        const success = await sectionsStudentsModel.addStudentsToSection(parseInt(section_id), student_ids);

        if (success) {
            res.status(200).json({ message: "Students added to section in batch successfully." });
        } else {
            // This case might hit if there's a unique constraint violation on a batch insert for SQLite
            res.status(409).json({ message: "Some students might already be enrolled or an error occurred during batch add." });
        }

    } catch (error) {
        console.error("Error adding students to section in batch: ", error);
        res.status(500).json({ message: "Failed to add students to section in batch." });
    }
});


//POST /api/sections/:section_id/students/batch-remove, remove multiple students from a section
router.post("/sections/:section_id/students/batch-remove", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id } = req.params;
        const { student_ids } = req.body; // Expect an array of student_ids
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ message: "An array of student_ids is required." });
        }

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only manage students in their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only remove students from your assigned sections." });
        }

        const affectedRows = await sectionsStudentsModel.removeStudentsFromSection(parseInt(section_id), student_ids);

        if (affectedRows > 0) {
            res.status(200).json({ message: `${affectedRows} student(s) removed from section in batch successfully.` });
        } else {
            res.status(404).json({ message: "No matching students found in this section to remove." });
        }

    } catch (error) {
        console.error("Error removing students from section in batch: ", error);
        res.status(500).json({ message: "Failed to remove students from section in batch." });
    }
});


//DEL /api/sections/:section_id/students/:student_id, remove a student from a section
router.delete("/sections/:section_id/students/:student_id", authMiddleware.authenticateLecturerOrAdmin, async (req, res) => {
    try {
        const { section_id, student_id } = req.params;
        const requestingUserRole = req.user.role;
        const requestingUserId = req.user.id;
        const requestingUserIsAdmin = req.user.is_admin;

        const section = await sectionsModel.findById(section_id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Authorization: Lecturer can only manage students in their own sections
        if (requestingUserRole === "lecturer" && !requestingUserIsAdmin && section.lecturer_id !== requestingUserId) {
            return res.status(403).json({ message: "Forbidden: You can only remove students from your assigned sections." });
        }

        const removed = await sectionsStudentsModel.removeStudentFromSection(parseInt(section_id), student_id);
        if (!removed) {
            return res.status(404).json({ message: "Student not found in this section." });
        }
        res.status(200).json({ message: "Student removed from section successfully." });
    } catch (error) {
        console.error("Error removing student from section:", error);
        res.status(500).json({ message: "Failed to remove student from section." });
    }
});


export default router;