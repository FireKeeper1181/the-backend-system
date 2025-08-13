import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)



export default {
    development: {

        client: "better-sqlite3",

        connection: {
            // The filename for the SQLite database, its inside /db
            filename: path.join(__dirname, "db", "the-database-system-new.sqlite3")
        },
        migrations: {
            //The directory for Knex to look for the migration files
            directory: path.join(__dirname, "db", "migrations")
        },
        seeds: {
            //The directory for Knex to look for the seed files (for initial data)
            directory: path.join(__dirname, "db", "seeds")
        },
        useNullAsDefault: true, //To handle default values correctly, especially for booleans
    },
}
