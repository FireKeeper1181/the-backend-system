/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.dropTableIfExists("qrcodes"); // Drop the old table if it exists

  // Recreate the qrcodes table linked to course_code
  await knex.schema.createTable("qrcodes", (table) => {
    table.increments("qrcode_id").primary();
    table.string("qr_string").notNullable().unique(); // The unique string embedded in the QR
    table.string("course_code", 20).notNullable(); // <--- Changed from section_id to course_code
    table.foreign("course_code").references("course_code").inTable("courses").onDelete("CASCADE"); // <--- New foreign key
    table.timestamp("expires_at").notNullable(); // When the QR code becomes invalid
    table.string('session_id').notNullable();
    table.timestamps(true, true); // created_at, updated_at
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // In a real-world scenario, you might want a more complex down migration
  // that restores the old schema or alerts of data loss.
  // For this development context, we'll simply drop the new table.
  await knex.schema.dropTableIfExists("qrcodes");

  // Optional: Recreate the old table schema if needed for rollback, but typically not for dev
  // await knex.schema.createTable("qrcodes", (table) => {
  //     table.increments("qrcode_id").primary();
  //     table.string("qr_string").notNullable().unique();
  //     table.integer("section_id").unsigned().notNullable();
  //     table.foreign("section_id").references("section_id").inTable("sections").onDelete("CASCADE");
  //     table.timestamp("expires_at").notNullable();
  //     table.timestamps(true, true);
  // });
}