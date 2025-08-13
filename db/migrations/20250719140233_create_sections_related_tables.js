/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Sections table
  await knex.schema.createTable("sections", (table) => {
    table.increments("section_id").primary()
    table.string("section_name", 100).notNullable()

    //course_code foreign key
    table.string("course_code", 40).notNullable()
    table.foreign("course_code").references("course_code").inTable("courses").onDelete("CASCADE")

    //lecturer_id foreign key
    table.integer("lecturer_id").unsigned().notNullable()
    table.foreign("lecturer_id").references("lecturer_id").inTable("lecturers").onDelete("RESTRICT")

    table.timestamps(true, true)
  })

  // Section_students table
  await knex.schema.createTable("sections_students", (table) =>  {

    //section_id foreign key
    table.integer("section_id").unsigned().notNullable()
    table.foreign("section_id").references("section_id").inTable("sections").onDelete("CASCADE")
    
    table.string("student_id", 40).notNullable()
    table.foreign("student_id").references("student_id").inTable("students").onDelete("CASCADE")

    table.primary(["section_id", "student_id"])
    table.timestamps(true, true)
  })

}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists("sections_students"),
    await knex.schema.dropTableIfExists("sections")
}
