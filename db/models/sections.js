import db from "../knex.js"


async function findAll() {
    return db("sections")
        .select(
            "sections.section_id",
            "sections.section_name",
            "sections.course_code",
            "courses.course_name", // From courses table
            "sections.lecturer_id",
            "lecturers.name as lecturer_name", // From lecturers table
            "sections.created_at",
            "sections.updated_at"
        )
        .join("courses", "sections.course_code", "courses.course_code")
        .join("lecturers", "sections.lecturer_id", "lecturers.lecturer_id");
}


async function findById(section_id) {
    return db("sections")
        .select(
            "sections.section_id",
            "sections.section_name",
            "sections.course_code",
            "courses.course_name",
            "sections.lecturer_id",
            "lecturers.name as lecturer_name",
            "sections.created_at",
            "sections.updated_at"
        )
        .join("courses", "sections.course_code", "courses.course_code")
        .join("lecturers", "sections.lecturer_id", "lecturers.lecturer_id")
        .where("sections.section_id", section_id)
        .first();
}


async function add({ section_name, course_code, lecturer_id }) {
    const [section_id] = await db("sections").insert({
        section_name,
        course_code,
        lecturer_id,
    });
    return findById(section_id); 
}


async function update(section_id, updates) {
    const updateData = { ...updates, updated_at: db.fn.now() };
    const affectedRows = await db("sections")
        .where({ section_id })
        .update(updateData);
    
    return affectedRows > 0;
}


async function remove(section_id) {
    const deletedRows = await db("sections")
        .where({ section_id })
        .del();
    
    return deletedRows > 0; 
}


async function findSectionsByLecturerAndCourse(lecturer_id, course_code) {
    return db("sections")
        .where({ lecturer_id, course_code })
        .select("section_id", "section_name", "course_code", "lecturer_id");
}


async function findSectionsByLecturerId(lecturer_id) {
  return db("sections")
    .select(
      "sections.section_id", "sections.section_name", "sections.course_code", "courses.course_name"
    )
    .select(db.raw('(SELECT COUNT(*) FROM sections_students WHERE sections_students.section_id = sections.section_id) as student_count'))
    .join("courses", "sections.course_code", "courses.course_code")
    .where("sections.lecturer_id", lecturer_id);
}


//findSectionsByCourseCode(course_code), finds all sections for a given course code
async function findSectionsByCourseCode(course_code) {
    return db("sections")
        .select(
            "sections.section_id",
            "sections.section_name",
            "sections.course_code",
            "courses.course_name",      // Joined from courses
            "sections.lecturer_id",
            "lecturers.name as lecturer_name" // Joined from lecturers
        )
        .join("courses", "sections.course_code", "courses.course_code")
        .join("lecturers", "sections.lecturer_id", "lecturers.lecturer_id")
        .where("sections.course_code", course_code);
}











export default {
    findAll,
    findById,
    add,
    update,
    remove,
    findSectionsByLecturerAndCourse,
    findSectionsByLecturerId,
    findSectionsByCourseCode
};