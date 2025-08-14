const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('lecturers').del()
  
  const hashedPassword = await bcrypt.hash("unitaradmin", SALT_ROUNDS)

  await knex("lecturers").insert([
    {
      name: "admin",
      email: "admin@unitar.edu",
      password_hash: hashedPassword,
      is_admin: true
    }
  ])
};
