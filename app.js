require("dotenv").config(); // import all constiables from env file
// import libraries
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
// const logger = require("morgan");
const cors = require("cors");
const compression = require("compression");

const app = express();

// file upload logic
app.use(fileUpload());
app.use(cors());
// app.use(logger("dev"));

// serving files through backend
app.use("/", express.static(__dirname + "/upload"));
app.use("/public", express.static(__dirname + "/public"));
app.use("/frontend/src/static", express.static(__dirname + "/frontend/src/static"));

// increase file upload size
app.use(bodyParser.json({ limit: "50mb", extended: false }));
app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));
app.use(cookieParser());
app.use(compression());

// import all the routes in this file
const mainRouter = require("./routes/main.route");

// all the routes
app.use("/", mainRouter);

// listen on port 3001
const server = http.createServer(app);
server.listen(3001);

// middleware error handler
const errorHandler = require("./helper/error");
app.use(errorHandler);