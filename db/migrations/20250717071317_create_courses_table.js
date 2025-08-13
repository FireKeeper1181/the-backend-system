/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  return knex.schema.createTable("courses", (table) => {
    table.increments("course_id").primary()
    table.string("course_code", 20).notNullable().unique()
    table.string("course_name", 255).notNullable()
    table.timestamps(true, true)
  })
};



/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema.dropTable("courses")
}