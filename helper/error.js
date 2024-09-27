const { give_response } = require("./common.helper");

const errorHandler = (err, req, res, next) => {
    let message;

    try {
        if (err.name === "CastError") {
            message = `Resourse not found`;
        } else if (err.code === 11000) {
            message = `Duplicate found`;
        } else if (err.name === "ValidationError") {
            message = Object.values(err.errors).map((val) => val.message)[0];
        } else {
            message = err.message;
        }
        console.log(err);
        console.log(err.message);
        if (err.message == "jwt expired") {
            return give_response(res, 401, false, "Not Authorized or invalid token.");
        }
        return give_response(res, 400, false, message);
    } catch (e) {
        return give_response(res, 400, false, e);
    }
};

module.exports = errorHandler;