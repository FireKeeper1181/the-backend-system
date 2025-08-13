import db from "../knex.js"
import bcrypt from "bcrypt"

const SALT_ROUNDS = 10




//find all lecturers
async function findAll() {
    return db("lecturers").select("lecturer_id", "name", "email", "is_admin");
}

async function findById(lecturer_id) {
    return db("lecturers")
        .where("lecturer_id", lecturer_id)
        .first();
}

async function findByEmail(email) {
    return db("lecturers").where({ email }).first();
}

//add a new lecturer (admin only)
async function add({ name, email, password, is_admin = false }) {

    if (!password) {
        throw new Error("Password is required for adding a lecturer.");
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [insertedRowObject] = await db("lecturers")
        .insert({
            name,
            email,
            password_hash: hashedPassword,
            is_admin
        })
        .returning("lecturer_id"); // Returns [{ lecturer_id: NUMBER }] for SQLite

    // 'insertedRowObject' is now an object like { lecturer_id: 7 }
    // We need to extract the numerical ID from it.
    const lecturerId = insertedRowObject.lecturer_id; // This gets the actual number (e.g., 7)

    return findById(lecturerId); // Pass the simple number ID to findById
}


async function update(lecturer_id, updates) {
    const updateData = { ...updates }; // Create a mutable copy

    // 1. Handle password hashing if a new password is provided
    if (updateData.password) { // 'password' is the key for the plaintext password input from the route
        updateData.password_hash = await bcrypt.hash(updateData.password, SALT_ROUNDS); // Hash it
        delete updateData.password; // Remove plaintext password from updateData
    }

    // 2. Add or update the 'updated_at' timestamp
    updateData.updated_at = db.fn.now();

    const affectedRows = await db("lecturers")
        .where({ lecturer_id })
        .update(updateData);

    return affectedRows > 0;
}


async function remove(lecturer_id) {
    try {
        const deletedRows = await db("lecturers").where({ lecturer_id }).del()

        return deletedRows > 0
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_TRIGGER" || error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
            throw new Error("Lecturer cannot be deleted as they are assigned to sections or have other associated data.")
        }
        throw error
    }
}


const lecturersModel = {
    findAll,
    findById,
    findByEmail,
    add,
    update,
    remove,
}

export default lecturersModel