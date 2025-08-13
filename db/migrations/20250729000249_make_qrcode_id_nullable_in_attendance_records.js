// YYYYMMDDHHMMSS_make_qrcode_id_nullable_in_attendance_records.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Alter the attendance_records table to make qrcode_id nullable
  return knex.schema.alterTable('attendance_records', function(table) {
    // For SQLite, integer().nullable().alter() works for changing nullability.
    // Ensure the column type matches its current type (likely integer).
    table.integer('qrcode_id').nullable().alter();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Revert the change: make qrcode_id not nullable again (if needed for rollback)
  return knex.schema.alterTable('attendance_records', function(table) {
    table.integer('qrcode_id').notNullable().alter();
  });
}