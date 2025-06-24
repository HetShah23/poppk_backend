const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const util = require("util");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");

const errorResponse = require("../helper/error.helper");
const {
  asyncHandler,
  isAuthorized,
  makeid,
  decrypt_text,
  give_response,
} = require("../helper/common.helper");

const conn = require("../database/connection.db");
const query = util.promisify(conn.query).bind(conn);

const multer = require("multer");
const {
  setupEmailTemplateForVerification,
  send_email,
} = require("../helper/email.helper");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images/");
  },
  filename: function (req, file, cb) {
    let file_extention = file.originalname.split(".").pop();
    let file_name = `${
      req.user.id
    }-${Date.now()}-${makeid()}.${file_extention}`;
    cb(null, file_name);
  },
});
const fileFilter = function (req, file, cb) {
  if (file.mimetype.includes("image")) cb(null, true);
  else cb(null, false);
};
const multer_upload = multer({ storage, fileFilter });

router.get("/", (req, res) => {
  res.send("users route is active");
});

// Register New User
// 0 - free user, 1 - normal user, 2 - founder user, 3 - admin
router.post(
  "/new-user",
  [
    check("first_name").exists(),
    check("last_name").exists(),
    check("email").exists(),
    check("phone").exists(),
  ],
  asyncHandler(async (req, res) => {
    req.body.name = req.body.first_name + " " + req.body.last_name;
    delete req.body.first_name;
    delete req.body.last_name;

    const emailCheck = await query(`SELECT * FROM pp_users_master WHERE email="${req.body.email}";`);
    if (emailCheck.length > 0) {
      give_response(res, 410, false, "Email is already registered");
      throw new errorResponse("Email is already registered");
    }

    const data = await query(`INSERT INTO pp_users_master SET ? `, req.body);

    const { html, token } = await setupEmailTemplateForVerification(
      data.insertId,
      1440
    );
    const email_status = await send_email(req.body.email, html);
    if (email_status.failed) {
      give_response(res, 502, false, `EMAIL NOT SENT TO ${req.body.email}`);
    } else {
      console.log(`EMAIL SUCCESSFULLY SENT TO ${req.body.email}`);
    }

    res.status(200).json({
      success: true,
      message: "New user registered. Verification email sent",
      data: { token },
    });
  })
);

router.post(
  "/verify-user",
  [check("token").exists(), check("password").exists()],
  asyncHandler(async (req, res) => {
    const plainText = decrypt_text(req.body.token);
    let data = plainText.split("/");

    if (typeof data[0] === "undefined" || typeof data[1] === "undefined")
      throw new errorResponse("Invalid token!");

    let d1 = new Date();
    let d2 = new Date(data[1] + "+00");

    if (d1.getTime() > d2.getTime()) {
      give_response(
        res,
        410,
        false,
        "your magic link has expired, generate new one"
      );
    } else {
      if (req.body.password) req.body.password = bcrypt.hashSync(req.body.password, 10);
      
      let status = 1;

      let result = await query(
        `SELECT * FROM pp_users_master WHERE id=? LIMIT 1;`,
        [data[0]]
      );

      const user_info = {
        name: result[0].name,
        id: result[0].id,
        type: result[0].type,
        email: result[0].email,
      }

      let ref_code = "POP" + data[0];

      if(user_info.type === 2) {
        await query(
          `UPDATE pp_users_master SET password=?, ref_code=? WHERE id = ?`,
          [req.body.password, ref_code, data[0]]
        );
      } else {
        await query(
          `UPDATE pp_users_master SET status=?,password=?, ref_code=? WHERE id = ?`,
          [status, req.body.password, ref_code, data[0]]
        );
      }

      let token = jwt.sign(
        user_info,
        process.env.JWTSECRET,
        { expiresIn: "24h" },
        { algorithm: "HS256" }
      );

      res.status(200).json({
        success: true,
        message: "New user registered. Verification email sent",
        data: { token, user_info },
      });
    }
  })
);

const verification_pending = async (email, result, res) => {
  const { html, token } = await setupEmailTemplateForVerification(
    result[0].id,
    1440
  );
  const email_status = await send_email(email, html);
  if (email_status.failed) throw new errorResponse(response.err);

  res.status(202).json({
    success: false,
    message: "Verification is pending email sent",
    data: {
      token,
    },
  });
}

router.post(
  "/user-login",
  [check("email").exists(), check("password").exists()],
  asyncHandler(async (req, res) => {
    let { email, password, type } = req.body;

    let selecter_type = "ref_code";
    if (email.includes("@")) selecter_type = "email";

    let result = await query(
      `SELECT * FROM pp_users_master WHERE ${selecter_type} = ? && type IN (0,1,2) LIMIT 1;`,
      [email]
    );

    if (result.length === 0) {
      give_response(res, 410, false, "User Not Found");
      throw new errorResponse("User Not Found");
    }

    if (
      result[0].password === null ||
      result[0].password === "" ||
      result[0].password === undefined
    ) {
      await verification_pending(email, result, res);
    } else if(result[0].status === 0 ) {
      await verification_pending(email, result, res);
    } else {
      let result2 = await bcrypt.compare(password, result[0].password);
      if (!result2) throw new errorResponse("Unauthorized Login!!!");

      const token_exp = req.body.rm === true ? "7d" : "24h";

      let token = jwt.sign(
        {
          name: result[0].name,
          id: result[0].id,
          type: result[0].type,
          email: result[0].email,
        },
        process.env.JWTSECRET,
        { expiresIn: token_exp },
        { algorithm: "HS256" }
      );

      res.status(200).json({
        success: true,
        message: "User Login",
        data: {
          token,
        },
      });
    }
  })
);

router.post(
  "/admin-login",
  [check("email").exists(), check("password").exists()],
  asyncHandler(async (req, res) => {
    let { email, password } = req.body;
    if (email.includes("@"))
      query_setup = "SELECT * FROM pp_users_master WHERE email = ? LIMIT 1;";

    let result = await query(
      "SELECT * FROM pp_users_master WHERE email = ? && type = 3 LIMIT 1;",
      [email]
    );

    if (result.length === 0) {
      give_response(res, 410, false, "User Not Found");
      throw new errorResponse("User Not Found");
    }

    let result2 = await bcrypt.compare(password, result[0].password);
    if (!result2) throw new errorResponse("Unauthorized Login!!!");

    const token_exp = req.body.rm === true ? "7d" : "24h";

    let token = jwt.sign(
      {
        name: result[0].name,
        id: result[0].id,
        type: result[0].type,
        email: result[0].email,
      },
      process.env.JWTSECRET,
      { expiresIn: token_exp },
      { algorithm: "HS256" }
    );

    res.status(200).json({
      success: true,
      message: "User Login",
      data: {
        token,
      },
    });
  })
);

router.post(
  "/image-upload",
  [isAuthorized],
  multer_upload.single("public_image"),
  asyncHandler(async (req, res) => {
    console.log("here", req.file);
    let file = req.file ?? false;
    if (file && req.file.mimetype.includes("image")) {
      let { originalname } = req.file;
      let file_extention = originalname.split(".").pop();
      let file_name = `${
        req.user.id
      }-${Date.now()}-${makeid()}.${file_extention}`;

      res.status(200).json({
        success: true,
        message: "Image Uploaded Successfully",
        data: {
          image_path: `images/${file_name}`,
        },
      });
    } else
      res
        .status(403)
        .json({ success: false, message: "Upload images only", data: {} });
  })
);

router.post(
  "/adv-upload",
  [check("name").exists(), check("image_path").exists()],
  isAuthorized,
  asyncHandler(async (req, res) => {
    req.body.user_id = req.user.id;
    req.body.slug = req.body.name.toLowerCase().replace(" ", "-");
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

router.post(
  "/get-inquiries",
  asyncHandler(async (req, res) => {
    const { page, sizePerPage, sortBy, order, type } = req.body;
    const start = page * sizePerPage - sizePerPage;
    const length = sizePerPage;
  
    const inquiries_fetched = await query(`SELECT * FROM pp_inquiries ORDER BY created_at DESC;`);
    res.status(200).json({
      success: true,
      message: "Inquiries fetched successfully",
      data: {inquiries_fetched},
    });
  })
);

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const stats = await query(
      `SELECT (select count(*) from pp_advs)as advs, (select count(*) from pp_users) as users, (select count(*) from pp_free_users) as free_users, (select count(*) from pp_founders) as founders`
    );
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

    const sqlQuery = `
      SELECT pp_advs.*, pp_locations.City, pp_locations.State, pp_cities.name as City2, pp_locals.name as loc, adv_analytics.click, adv_analytics.view, adv_analytics.site_visit FROM pp_advs 
      LEFT JOIN pp_locations on pp_advs.location_id = pp_locations.id 
      LEFT JOIN pp_locals on pp_locals.id = pp_advs.location
      LEFT JOIN adv_analytics on adv_analytics.adv_id = pp_advs._id
      RIGHT JOIN pp_cities on pp_locals.city_id = pp_cities.id
      WHERE pp_advs.locale_brand='${type}'
      ORDER BY RAND() LIMIT ${start},${length};
    `;

    const advs = await query(sqlQuery);

    res.status(200).json({
      success: true,
      message: "Adv fetched successfully",
      data: { advs },
    });
  })
);

router.post(
  "/get-advs-by-id",
  asyncHandler(async (req, res) => {
    const adv = await query(
      `SELECT * FROM pp_advs WHERE pp_advs._id = ${req.body.adv_id};`
    );

    if (
      adv[0].location_id !== null &&
      adv[0].location_id !== undefined &&
      adv[0].location_id > 0
    ) {
      const location = await query(
        `SELECT * FROM pp_locations WHERE id = ${adv[0].pp_locations} LIMIT 0,1;`
      );
      adv[0].city_name = location[0].City ?? "";
      adv[0].local_name = location[0].PostOfficeName ?? "";
    } else {
      if (
        adv[0].location !== null &&
        adv[0].location !== undefined &&
        adv[0].location > 0
      ) {
        const city = await query(
          `SELECT pp_cities.name as city_name, pp_locals.name as local_name FROM pp_locals JOIN pp_cities on pp_locals.city_id = pp_cities.id WHERE pp_locals.id = ${adv[0].location} LIMIT 0,1;`
        );
        adv[0].city_name = city[0].city_name ?? "";
        adv[0].local_name = city[0].local_name ?? "";
      } else {
        const city = await query(
          `SELECT pp_cities.name as city_name, pp_locals.name as local_name FROM pp_locals JOIN pp_cities on pp_locals.city_id = pp_cities.id WHERE pp_locals.id = ${adv[0].locals} LIMIT 0,1;`
        );
        adv[0].city_name = city[0].city_name ?? "";
        adv[0].local_name = city[0].local_name ?? "";
      }
    }

    if (adv.length > 0) {
      res.status(200).json({
        success: true,
        message: "Adv fetched successfully",
        data: { adv },
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Adv not found",
        data: {},
      });
    }
  })
);

router.post(
  "/get-adv-by-user",
  isAuthorized,
  asyncHandler(async (req, res) => {
    const { page, sizePerPage, sortBy, order } = req.body;
    
    const start = page * sizePerPage - sizePerPage;
    const length = sizePerPage;

    const sqlQuery = req.user.type === 3 ?
    `SELECT pp_advs.*, pp_locations.City, pp_locations.State FROM pp_advs JOIN pp_locations on pp_advs.location_id = pp_locations.id ORDER BY created_at LIMIT ${start},${length};` 
    : `SELECT pp_advs.*, pp_locations.City, pp_locations.State FROM pp_advs JOIN pp_locations on pp_advs.location_id = pp_locations.id WHERE user_id=${req.user.id} ORDER BY created_at LIMIT ${start},${length};`;

    const advs = await query(sqlQuery);

    res.status(200).json({
      success: true,
      message: "Adv uploaded successfully",
      data: { advs },
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
      data: { advs },
    });
  })
);

router.post(
  "/search-location",
  asyncHandler(async (req, res) => {

    const page = req.body.page ?? 1
    const sizePerPage = req.body.sizePerPage ?? 5
    const sortBy = req.body.sortBy ?? "location"
    const order = req.body.order ?? "ASC"
    const searchBy = req.body.searchBy ?? "location"
    const searchparams = req.body.searchparams ?? ""

    const start = page * sizePerPage - sizePerPage;
    const length = sizePerPage;

    
    const sqlQuery = `SELECT * FROM pp_locations WHERE ${searchBy} LIKE '%${searchparams}%' ORDER BY ${sortBy} ${order} LIMIT ${start},${length};`;
    const locations = await query(sqlQuery);

    res.status(200).json({
      success: true,
      message: "Cities Fetched successfully",
      data: { locations },
    });
  })
);

router.post(
  "/add-new-location",
  [
    check("LocalityName").exists(),
    check("Pincode").exists(),
    check("City").exists(),
    check("District").exists(),
    check("State").exists(),
  ],
  asyncHandler(async (req, res) => {
    req.body.PostOfficeName = req.body.LocalityName;
    req.body.location = `${req.body.PostOfficeName}, ${req.body.City}, ${req.body.District}, ${req.body.State}, ${req.body.Pincode}`;
    delete req.body.LocalityName;

    await query(`INSERT INTO pp_locations SET ? `, req.body);

    res.status(200).json({
      success: true,
      message: "New city added",
      data: {},
    });
  })
);

router.post(
  "/get-users",
  // isAuthorized,
  asyncHandler(async (req, res) => {
    const { page, sizePerPage, sortBy, order } = req.body;
    const start = page * sizePerPage - sizePerPage;
    const length = sizePerPage;

    const sqlQuery = `SELECT id, name, ref_code, type, phone, balance, email FROM pp_users_master WHERE type IN (0,1,2) ORDER BY created_at DESC LIMIT ${start},${length};`;

    const advs = await query(sqlQuery);

    res.status(200).json({
      success: true,
      message: "Adv uploaded successfully",
      data: { advs },
    });
  })
);

router.post(
  "/capture",
  asyncHandler(async (req, res) => {
    const { type, count, adv_id } = req.body;

    const sqlQuery = `
      UPDATE adv_analytics
      SET ${type} = ${type} + ${count ?? 1}
      WHERE adv_id  = ${adv_id};
    `;

    const capture_query = await query(sqlQuery);
    console.log(capture_query);

    res.status(200).json({
      success: true,
      message: "analytics captured successfully",
      data: {},
    });
  })
);

module.exports = router;
