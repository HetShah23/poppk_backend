let mysql = require("mysql");
let pool;
let DB_USER = process.env.DB_USER;
let DB_HOSTNAME = process.env.DB_HOSTNAME;
let DB_PASSWORD = process.env.DB_PASSWORD;
let DB_DATABASE = process.env.DB_DATABASE;
let DB_PORT = process.env.DB_PORT

pool = mysql.createPool({
    // connectionLimit: 50,
    host: DB_HOSTNAME,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    // multipleStatements: true,
    // connectTimeout: 60 * 60 * 1000,
    // acquireTimeout: 60 * 60 * 1000,
    // timeout: 60 * 60 * 1000,
});

module.exports = pool;