import db from "../knex.js"
import bcrypt from "bcrypt"

const SALT_ROUNDS = 10


//find all students
async function findAll() {
    return db("students").select("student_id", "name", "email", "created_at", "updated_at")
}


//get student by Id
async function findById(student_id) {
    return db("students").where({ student_id }).first();
}

async function findByEmail(email) {
    return db("students").where({ email }).first();
}

//add a new student (admin only)
async function add({ student_id, name, email, password }) {

    if (!password) {
        throw new Error("Password is required for adding a student.");
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    await db("students").insert({ 
        student_id,
        name,
        email,
        password_hash,
    });
    return findById(student_id); 
}


//update student
async function update(student_id, updates) {
    const updateData = { ...updates, updated_at: db.fn.now() };

    if (updateData.password) {
        updateData.password_hash = await bcrypt.hash(updateData.password, SALT_ROUNDS);
        delete updateData.password;
    }

    const affectedRows = await db("students")
        .where({ student_id })
        .update(updateData);
    
    return affectedRows > 0;
}
    

//remove student
async function remove(student_id) {
    const deletedRows = await db("students")
        .where({ student_id })
        .del();
    
    return deletedRows > 0; // Return true if deleted, false otherwise
}


async function findByIds(student_ids) {
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
        return [];
    }
    return db("students")
        .whereIn("student_id", student_ids)
        .select("student_id", "name", "email");
}

async function isStudentInCourse(student_id, course_code) {
    try {
        const result = await db("sections_students").join("sections", "sections_students.section_id", "sections.section_id").where("sections_students.student_id", student_id).andWhere("sections.course_code", course_code).first()

        return !!result;

    } catch (error) {
        console.error(`Error checking student ${student_id} enrollment in course ${course_code}`, error)
        return false;
    }
}


//findCoursesForStudent(student_id), Finds courses a student is enrolled in for a specific semester/year


//findStudentsInSection(section_id), a broader query of sections/:section_id/students


//findStudentsByCe), find students enrolled across all sections of a given course






const studentsModel = {
    findAll,
    findById,
    findByEmail,
    add,
    update,
    remove,
    findByIds,
    isStudentInCourse
};

export default studentsModel; 