const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const util = require("util");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");

const errorResponse = require("../helper/error.helper");
const { asyncHandler, isAuthorized, makeid } = require("../helper/common.helper");

const conn = require("../database/connection.db");
const query = util.promisify(conn.query).bind(conn);

const multer = require("multer");
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/images/");
    },
    filename: function (req, file, cb) {
        let file_extention = file.originalname.split(".").pop();
        let file_name = `${req.user.id}-${Date.now()}-${makeid()}.${file_extention}`;
        cb(null, file_name);
    }
});
const fileFilter = function(req, file, cb) {
    if(file.mimetype.includes("image")) cb(null, true);
    else cb(null, false);
}
const multer_upload = multer({storage, fileFilter});

router.get("/", (req, res) => {
    res.send("users route is active");
});


// Register New User
// 0 - role not defined 1 - free users 2 - paid users 3 - founders 4 - admin
router.post(
    "/new-user",
    [
        check("first_name").exists(), 
        check("last_name").exists(), 
        check("email").exists(), 
        check("phone").exists(), 
        check("password").exists(),
        check("role").exists()
    ],
    asyncHandler(async (req, res) => {
        if (req.body.password) req.body.password = bcrypt.hashSync(req.body.password, 10);
        await query(`INSERT INTO users SET ? `, req.body);

        

        res.status(200).json({
            success: true,
            message: "Verification link sent to your mail",
            data: {},
        });
    })
);

router.post(
    "/user-login",
    [
        check("email").exists(),
        check("password").exists(),
        check("role").exists()
    ],
    asyncHandler(async (req, res) => {
        let { email, role, password } = req.body;
        let result = await query(`SELECT * FROM users WHERE email = ? && role = ? LIMIT 1;`, [email, role]);
        
        let result2 = await bcrypt.compare(password, result[0].password);
        if (!result2) throw new errorResponse("Unauthorized Login!!!");

        let token = jwt.sign(
            {
                name: result[0].first_name + result[0].last_name,
                id: result[0].id,
                role: result[0].role,
                email: result[0].email,
            },
            process.env.JWTSECRET,
            { expiresIn: "24h" },
            { algorithm: "HS256" }
        );
        
        res.status(200).json({
            success: true,
            message: "User Login",
            data: {
                token
            },
        });
    })
);

router.post(
    "/image-upload",
    [isAuthorized],
    multer_upload.single("public_image"),
    asyncHandler(async (req, res) => {
        let file = req.file ?? false
        if(file && req.file.mimetype.includes("image")){
            let { originalname } = req.file;
            let file_extention = originalname.split(".").pop();
            let file_name = `${req.user.id}-${Date.now()}-${makeid()}.${file_extention}`;

            res.status(200).json({
                success: true,
                message: "Image Uploaded Successfully",
                data: {
                    image_path: `/public/images/${file_name}`
                },
            });
        } else res.status(403).json({ success: false, message: "Upload images only", data: {} });
    })
);

router.post(
    "/adv-upload",
    [
        check("name").exists(), 
        check("image_path").exists()
    ],
    isAuthorized,
    asyncHandler(async (req, res) => {
        req.body.user_id = req.user.id;
        await query(`INSERT INTO pp_advs SET ? `, req.body);
        res.status(200).json({
            success: true,
            message: "Adv uploaded successfully",
            data: {},
        });
    })
);

router.post(
    "/new-inquiry",
    [check("email").exists()],
    asyncHandler(async (req, res) => {
        await query(`INSERT INTO pp_inquiries SET ? `, req.body);
        res.status(200).json({
            success: true,
            message: "Inquiry uploaded successfully",
            data: {},
        });
    })
);

router.get(
    "/stats",
    asyncHandler(async (req, res) => {
        const stats = await query(`SELECT (select count(*) from pp_advs)as advs, (select count(*) from pp_users) as users, (select count(*) from pp_free_users) as free_users, (select count(*) from pp_founders) as founders`);
        res.status(200).json({
            success: true,
            message: "Stats fetched",
            data: stats[0],
        });
    })
);

router.post(
    "/get-advs",
    asyncHandler(async (req, res) => {
        const { page, sizePerPage, sortBy, order, type } = req.body;
        const start = page * sizePerPage - sizePerPage;
        const length = sizePerPage;

        const sqlQuery = `SELECT pp_advs.name, pp_advs.details, pp_advs._id, pp_advs.slug, pp_advs.url, pp_advs.image_path, pp_advs.view, pp_locations.City, pp_locations.State FROM pp_advs JOIN pp_locations on pp_advs.location_id = pp_locations.id WHERE pp_advs.locale_brand='${type}' ORDER BY RAND() LIMIT ${start},${length};`;

        const advs = await query(sqlQuery);

        res.status(200).json({
            success: true,
            message: "Adv fetched successfully",
            data: {advs},
        });
    })
);

router.post(
    "/get-adv-by-user",
    isAuthorized,
    asyncHandler(async (req, res) => {
        const { page, sizePerPage, sortBy, order } = req.body;
        const start = page * sizePerPage - sizePerPage;
        const length = sizePerPage;

        const sqlQuery = `SELECT * FROM pp_advs WHERE user_id=${req.user.id} ORDER BY ${sortBy} ${order} LIMIT ${start},${length};`;

        const advs = await query(sqlQuery);

        res.status(200).json({
            success: true,
            message: "Adv uploaded successfully",
            data: {advs},
        });
    })
);

router.post(
    "/search-adv",
    asyncHandler(async (req, res) => {
        const sqlQuery = `SELECT * FROM pp_advs WHERE name LIKE '%${req.body.searchparams}%' ORDER BY created_at DESC LIMIT 1,10;`;
        const advs = await query(sqlQuery);

        res.status(200).json({
            success: true,
            message: "Adv uploaded successfully",
            data: {advs},
        });
    })
);

router.post(
    "/search-city",
    asyncHandler(async (req, res) => {
        const sqlQuery = `SELECT * FROM pp_locations WHERE City LIKE '%${req.body.searchparams}%' DESC LIMIT 1,10;`;
        const advs = await query(sqlQuery);

        res.status(200).json({
            success: true,
            message: "Cities Fetched successfully",
            data: {advs},
        });
    })
);

router.post(
    "/add-new-city",
    [
        check("LocalityName").exists(),
        check("Pincode").exists(),
        check("City").exists(),
        check("District").exists(),
        check("State").exists(),
    ],
    asyncHandler(async (req, res) => {

        req.body.PostOfficeName = req.body.LocalityName;
        delete req.body.LocalityName;
        
        await query(`INSERT INTO users SET ? `, req.body);

        res.status(200).json({
            success: true,
            message: "New city added",
            data: {advs},
        });
    })
);



module.exports = router;