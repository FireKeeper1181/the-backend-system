/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

//up is called when running migration, it defines the changes to apply
export async function up (knex) {

  // Lecturers table
  await knex.schema.createTable("lecturers", (table) => {
    table.increments("lecturer_id").primary().notNullable()
    table.string("name", 255).notNullable()
    table.string("email", 255).notNullable()
    table.string("password_hash", 255).notNullable()
    table.timestamps(true, true)
  })

  // Students table
  await knex.schema.createTable("students", (table) => {
    table.string("student_id", 40).primary().notNullable().unique()
    table.string("name", 255).notNullable()
    table.string("email", 255).notNullable().unique()
    table.string("password_hash", 255).notNullable()
    table.timestamps(true, true)
  })

  //Admin table
  await knex.schema.createTable("administrators", (table) => {
    table.increments("id").primary()
    table.string("username", 50).notNullable().unique()
    table.string("password_hash", 255).notNullable()
    table.string("email", 255).unique()
    table.timestamps(true, true)
  })
};




/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

//down when deciding to roll back the migration, undoing the changes made by up
export async function down(knex) {
    await knex.schema.dropTableIfExists("lecturers"),
    await knex.schema.dropTableIfExists("students"),
    await knex.schema.dropTableIfExists("administrators")
}
