require("dotenv").config(); // import all constiables from env file
// import libraries
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
// const logger = require("morgan");
const cors = require("cors");
const compression = require("compression");

const app = express();

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
const usersRouter = require("./routes/users.route");
const paymentRouter = require("./routes/payment.route");

// all the routes
app.use("/", mainRouter);
app.use("/users", usersRouter);
app.use("/payment", paymentRouter);

// listen on port 3002
const server = http.createServer(app);
server.listen(3002);

// middleware error handler
const errorHandler = require("./helper/error");
app.use(errorHandler);