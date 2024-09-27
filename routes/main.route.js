const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const conn = require("../database/connection.db");

const util = require("util");
const errorResponse = require("../helper/error.helper");
const { asyncHandler } = require("../helper/common.helper");
const query = util.promisify(conn.query).bind(conn);

router.get("/", (req, res) => {
    res.send("welcome");
});

module.exports = router;