/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    //Attendance_Records table
    await knex.schema.createTable("attendance_records", (table) => {
        table.increments("record_id").primary()
    
        //student_id foreign key
        table.string("student_id", 40).notNullable()
        table.foreign("student_id").references("student_id").inTable("students").onDelete("CASCADE")

        //section_id foreign key
        table.integer("section_id").unsigned().notNullable()
        table.foreign("section_id").references("section_id").inTable("sections").onDelete("CASCADE")

        //qrcode_id foreign key
        table.integer("qrcode_id").unsigned().notNullable()
        table.foreign("qrcode_id").references("qrcode_id").inTable("qrcodes").onDelete("CASCADE")

        table.string("session_id").notNullable()

        table.datetime("attended_at").notNullable()
        table.timestamps(true, true)
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists("attendance_records")
}