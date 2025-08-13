/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('push_subscriptions', (table) => {
    // Auto-incrementing primary key
    table.increments('subscription_id').primary();

    // The type of user: 'lecturer' or 'student'
    table.string('user_type').notNullable();

    // The ID of the user. A string type works for both integer and string IDs.
    table.string('user_id').notNullable();

    // Field to store the subscription JSON object
    table.text('subscription_object').notNullable();
    
    // A composite index for faster lookups on both user_id and user_type
    table.index(['user_id', 'user_type']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('push_subscriptions');
}