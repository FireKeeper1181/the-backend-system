import db from "../knex.js";


async function addStudentToSection(section_id, student_id) {
    // Check if the record already exists to prevent duplicates
    const existing = await db("sections_students")
        .where({ section_id, student_id })
        .first();

    if (existing) {
        // You might want to throw an error or return a specific status here
        // For now, we'll just indicate it wasn't a *new* addition
        console.warn(`Student ${student_id} is already enrolled in section ${section_id}.`);
        return existing; // Return the existing record
    }

    await db("sections_students").insert({
        section_id,
        student_id,
    });
    // Return the newly created association
    return { section_id, student_id, message: "Enrollment successful" };
}


async function addStudentsToSection(section_id, student_ids) {
    // student_ids should be an array of student_id strings
    const inserts = student_ids.map(student_id => ({
        section_id,
        student_id
    }));
    // Use .insert with an array to perform a batch insert
    // .onConflict('student_id', 'section_id').ignore() is for PostgreSQL/MySQL
    // For SQLite, we just rely on unique constraint and ignore errors if they exist.
    // Knex's default behavior for insert with array might just try to insert all
    // and fail on first unique constraint violation if not handled.
    // For simplicity, we'll try to insert all and let Knex handle potential unique constraint errors,
    // which would result in a failed batch if any student is already enrolled.
    // A more robust solution for SQLite would be to filter out existing enrollments first.
    // For now, we'll assume the frontend (or calling logic) ensures non-duplicates or handles the error.
    try {
        await db("sections_students").insert(inserts);
        return true;
    } catch (error) {
        // Log the error for debugging purposes
        console.error("Error adding students to section in batch:", error);
        // If an error occurs (e.g., duplicate entry), we might return false or throw a specific error
        return false;
    }
}


async function removeStudentFromSection(section_id, student_id) {
    const deletedRows = await db("sections_students")
        .where({ section_id, student_id })
        .del();
    
    return deletedRows > 0; // Returns true if a row was deleted, false otherwise
}


async function removeStudentsFromSection(section_id, student_ids) {
    // student_ids should be an array of student_id strings
    const affectedRows = await db("sections_students")
        .whereIn("student_id", student_ids) // Match any student_id in the array
        .andWhere({ section_id })           // And for the specific section
        .del();                             // Delete them
    return affectedRows; // Returns the number of rows deleted
}


async function findStudentsInASection(section_id) {
    return db("sections_students")
        .select(
            "students.student_id",
            "students.name as student_name",
            "students.email"
        )
        .join("students", "sections_students.student_id", "students.student_id")
        .where("sections_students.section_id", section_id);
}


async function findSectionsForAStudent(student_id) {
    return db("sections_students")
        .select(
            "sections.section_id",
            "sections.section_name",
            "sections.course_code",
            "courses.course_name",
            "lecturers.lecturer_id",
            "lecturers.name as lecturer_name"
        )
        .join("sections", "sections_students.section_id", "sections.section_id")
        .join("courses", "sections.course_code", "courses.course_code")
        .join("lecturers", "sections.lecturer_id", "lecturers.lecturer_id")
        .where("sections_students.student_id", student_id);
}


async function findStudentsByCourse(course_code) {
  return db("students")
    .select(
      "students.student_id",
      "sections.section_id as enrolled_section_id",
      "sections.section_name as enrolled_section_name"
    )
    .join("sections_students", "students.student_id", "sections_students.student_id")
    .join("sections", "sections_students.section_id", "sections.section_id")
    .where("sections.course_code", course_code);
}


async function isStudentEnrolled(section_id, student_id) {
    const result = await db("sections_students")
        .where({ section_id, student_id })
        .first();
    return !!result; // Returns true if found, false otherwise
}


export default {
    addStudentToSection,
    removeStudentFromSection,
    findStudentsInASection,
    findSectionsForAStudent,
    isStudentEnrolled,
    addStudentsToSection,
    removeStudentsFromSection,
    findStudentsByCourse,
};