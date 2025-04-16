const { FRONTEND_URL } = require("../const");
const nodemailer = require("nodemailer");
const fs = require("fs");
const { addMinutes, encrypt_text } = require("./common.helper");

exports.setupEmailTemplateForVerification = function (user_id, validity_time) {
    return new Promise(async (resolve, reject) => {
        const text = user_id + "/" + addMinutes(validity_time);
        const token = encrypt_text(text);
        const name = "./emailpages/magic-link.html";
        const link = `${FRONTEND_URL}/verifyUser?token=${token}`; // to change when reciving final token verfication link
        fs.readFile(name, { encoding: "utf-8" }, (err, html) => {
            if (err) {
                reject(err);
            } else {
                html = html.split("{{link}}").join(link);
                resolve({ html, token });
            }
        });
    });
};

exports.send_email = function (email, html) {
    return new Promise((resolve, reject) => {

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.MAIL_USER,
            to: email,
            subject: "Verification for Poppk.in",
            html: html,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                reject({ failed: true, err: error });
            } else {
                console.log(info);
                resolve({ failed: false, data: info.response });
            }
        });
    });
};