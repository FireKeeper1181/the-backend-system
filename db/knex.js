import knex from "knex"
import config from "../knexfile.js"


//Determine environment, default is "development" if there's no NODE_ENV
const environment = process.env.NODE_ENV || "development"

//Get configuration for the current environment
const knexConfig = config[environment]



const db = knex(knexConfig)

export default db
