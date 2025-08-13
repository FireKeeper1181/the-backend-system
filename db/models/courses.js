import db from "../knex.js"

async function findAll() {
    return db("courses").select("course_code", "course_name", "created_at", "updated_at")
}


async function findByCode(course_code) {
    return db("courses").where({ course_code }).first()
}


async function add({ course_code, course_name}) {
    await db("courses").insert({
        course_code,
        course_name
    })

    return findByCode(course_code)
}


async function update(course_code, updates) {
    const affectedRows = await db("courses").where({ course_code}).update({ ...updates, updated_at: db.fn.now() })

    return affectedRows > 0
}


async function remove(course_code) {
    const deletedRows = await db("courses").where({ course_code}).del()

    return deletedRows > 0
}


export default {
    findAll,
    add,
    findByCode,
    update,
    remove
}