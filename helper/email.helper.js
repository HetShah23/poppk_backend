const crypto = require("crypto");

exports.encrypt_text = function (text) {
    let iv = crypto.randomBytes(Number(process.env.CRYPTO_IV_LENGTH));
    let cipher = crypto.createCipheriv(process.env.CRYPTO_ALGORITHM, Buffer.from(process.env.CRYPTO_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

exports.setMagicLinkForAdmin = function (user_id, full_name, validity_time) {
    return new Promise(async (resolve, reject) => {
        const text = user_id + "/" + helpers.addMinutes(validity_time);
        const token = helpers.encrypt_text(text);
        const name = "./emailpages/magic-link.html";
        const link = `https://localhost:3007/verifyUser?token=${token}`; // to change when reciving final token verfication link
        // fs.readFile(name, { encoding: "utf-8" }, (err, html) => {
        //     if (err) {
        //         reject(err);
        //     } else {
        //         html = html.split("{{link}}").join(link);
        //         html = html.split("{{name}}").join(full_name);
        //         resolve({ html, token });
        //     }
        // });
    });
};

exports.send_email = (email, subject, html, extra_cc = []) => {
    return new Promise((resolve, reject) => {
        let mailOptions = {
            from: process.env.MAIL_FROM_ADDRESS,
            to: email,
            subject: subject,
            html: html,
            cc: [],
        };
        mailOptions["cc"] = mailOptions["cc"].concat(extra_cc);
        
        all_transporter.sendMail(mailOptions, (error, info) => {
            if (error) resolve({ failed: true, err: error });
            else resolve({ failed: false, data: info.response });
        });
    });
};