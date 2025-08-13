/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.table('lecturers', (table) => {
    table.boolean('is_admin').defaultTo(false); // Add the new column, default to false
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.table('lecturers', (table) => {
    table.dropColumn('is_admin'); // Revert the change if rolling back
  });
}
