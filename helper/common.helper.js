const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { check, validationResult } = require("express-validator");

function replacer(i, val) {
    if (val == undefined || val == null) return "";
    else return val; // return unchanged
}

exports.give_response = (res, status_code, success, message, data = null) => {
    let data_to_send = data == null ? {} : data;
    if (Object.prototype.toString.call(data_to_send) != "[object Object]") {
        data_to_send = {};
        if (success) {
            data_to_send["data"] = data;
        }
    }
    data_to_send = JSON.parse(JSON.stringify(data_to_send, replacer));
    const json_to_send = {
        success: success,
        message: message,
        data: data_to_send,
    };
    try {
        return res.status(status_code).json(json_to_send);
    } catch (e) {}
}

exports.asyncHandler = (fn) => (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const err = errors.array().map((err) => ({ field: err.param, message: err.msg }));
        res.status(401).json({ success: false, message: `${err[0].field} is not valid` });
    } else {
        Promise.resolve(fn(req, res, next)).catch(next);
    }
};

exports.isAuthorized = function (req, res, next) {
    if (typeof req.headers.authorization != "undefined") {
        let token = req.headers.authorization.split(" ")[1];
        jwt.verify(token, process.env.JWTSECRET, { algorithm: "HS256" }, (err, user) => {
            if (err) {
                console.log(err);
                res.status(403).json({ success: false, message: "Not Authorized or invalid token.", data: [] });
            } else {
                req.user = user;
                return next();
            }
        });
    } else {
        res.status(403).json({ success: false, message: "please pass token.", data: [] });
    }
};

exports.check_role = function (...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return give_response(res, 201, false, `nice try`);
        }
        next();
    };
};

exports.makeid = (l) => {
    let length = l ?? 6;
    let result = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

exports.addMinutes = function (minutes) {
    let date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString().replace(/T/, " ").replace(/\..+/, "");
};

exports.encrypt_text = function (text) {
    let iv = crypto.randomBytes(Number(process.env.CRYPTO_IV_LENGTH));
    let cipher = crypto.createCipheriv(process.env.CRYPTO_ALGORITHM, Buffer.from(process.env.CRYPTO_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

exports.decrypt_text = function (text) {
    let textParts = text.split(":");
    let iv = Buffer.from(textParts.shift(), "hex");
    let encryptedText = Buffer.from(textParts.join(":"), "hex");
    let decipher = crypto.createDecipheriv(process.env.CRYPTO_ALGORITHM, Buffer.from(process.env.CRYPTO_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};