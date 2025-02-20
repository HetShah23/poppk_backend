require("dotenv").config(); 
const conn = require("./database/connection.db");
const util = require("util");
const query = util.promisify(conn.query).bind(conn);

async function manage_users_master() {
    return new Promise(async (resolve, reject) => {
        let all_apps = await query(`select * from pp_founders`);
        console.log(all_apps[0]);
        for (let each_app of all_apps) {
            let user = {
                id: each_app.id,
                name: `${each_app.first_name} ${each_app.last_name}`,
                email: each_app.email,
                password: null,
                phone: each_app.phone,
                balance: each_app.balance ?? null,
                aadhar_no: each_app.aadhar_no ?? null,
                pan_no: each_app.pan_no ?? null,
                bank_name: each_app.bank_name ?? null,
                bank_acc: each_app.bank_acc ?? null,
                ifsc: each_app.ifsc ?? null,
                ref_code: each_app.reffereal ?? null,
                type: 2,
                status: 1,
                city_id: null
            };
            
            let result = await query(`INSERT INTO pp_users_master SET ? `, user);

            console.log(result);
        }
    });
}

manage_users_master();