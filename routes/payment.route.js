const express = require("express");
const router = express.Router();
const util = require("util");

const { check } = require("express-validator");
const { asyncHandler } = require("../helper/common.helper");
const { randomUUID } = require("crypto");
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require("pg-sdk-node");
const { FRONTEND_URL } = require("../const");

const clientId = Number(process.env.LIVE) === 1 ? process.env.PHONEPE_CLIENT_ID : process.env.PHONEPE_CLIENT_ID_TEST;
const clientSecret = Number(process.env.LIVE) === 1 ? process.env.PHONEPE_SECRET : process.env.PHONEPE_SECRET_TEST;
const clientVersion = 1;
const env = Env.SANDBOX;

const client = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env);
const conn = require("../database/connection.db");
const query = util.promisify(conn.query).bind(conn);

const payemnt_entry_in_db = async (data) => {
    const test = await query(`INSERT INTO pp_payment_master SET ? `, data);
    console.log(test)
}
const update_payment_in_db = async (status, merchantOrderId) => await query(`UPDATE pp_payment_master SET status=? WHERE merchantOrderId=?`,[status, merchantOrderId]);
const user_update_in_db = async (user_id, status=1) => await query(`UPDATE pp_users_master SET status=? WHERE id=?`,[status,user_id]);

router.post(
    "/init-payment",
    [
        check("amount").exists(),
        check("user_id").exists(),
        check("reason").exists(),
    ],
    asyncHandler(async (req, res) => {
        req.body.PostOfficeName = req.body.LocalityName;
        delete req.body.LocalityName;

        const amount = Number(req.body.amount ?? 0) * 100; //converted to paisa

        if(amount < 1) throw new errorResponse("Amount can not be less than 1");

        const merchantOrderId = randomUUID();
        const redirectUrl = `${FRONTEND_URL}/verify_payment?merchantOrderId=${merchantOrderId}`;

        const request = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(amount)
            .redirectUrl(redirectUrl)
            .build();
  
        client.pay(request).then(async (response)=> {

            const checkoutPageUrl = response.redirectUrl;
            
            await payemnt_entry_in_db({
                merchantOrderId,
                user_id: req.body.user_id,
                amount: req.body.amount,
                reason: req.body.reason,
                status: "INIT"
            });

            res.status(200).json({
                success: true,
                message: "Checkout URL Generated",
                data: { checkoutPageUrl, merchantOrderId },
            });

        }, (reject) => {
            console.log(reject);
            res.status(500).json({
                success: false,
                message: "Could not process payment",
                data: {},
            });
        })
    })
);

router.post(
    "/verify-payment",
    [check("merchantOrderId").exists()],
    asyncHandler(async (req, res) => {
        client.getOrderStatus(req.body.merchantOrderId).then(async(response) => {
            const state = response.state;
            await update_payment_in_db(state, req.body.merchantOrderId);
            const payment_info = await query(`SELECT * FROM pp_payment_master WHERE merchantOrderId="${req.body.merchantOrderId}" LIMIT 1;`);
            
            if(payment_info.length > 0 && state === "COMPLETED") await user_update_in_db(payment_info[0].user_id);

            res.status(state === "COMPLETED" ? 200 : 400).json({
                success: true,
                message: state,
                data: { state, oder_info: response },
            });
        }, (reject) => {
            console.log(reject);
            res.status(500).json({
                success: false,
                message: "Could not process payment",
                data: {},
            });
        });
    })
);

module.exports = router;