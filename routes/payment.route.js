const express = require("express");
const router = express.Router();

const { check } = require("express-validator");
const { asyncHandler } = require("../helper/common.helper");
const { randomUUID } = require("crypto");
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require("pg-sdk-node");

const clientId = process.env.LIVE === 1 ? process.env.PHONEPE_CLIENT_ID : process.env.PHONEPE_CLIENT_ID_TEST;
const clientSecret = process.env.LIVE === 1 ? process.env.PHONEPE_SECRET : process.env.PHONEPE_SECRET_TEST;
const clientVersion = 1;
const env = Env.SANDBOX;

const client = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env);

router.post(
    "/init-payment",
    [
        check("amount").exists(),
        check("user_id").exists(),
    ],
    asyncHandler(async (req, res) => {
        req.body.PostOfficeName = req.body.LocalityName;
        delete req.body.LocalityName;

        const amount = Number(req.body.amount ?? 0) * 100; //converted to paisa

        if(amount < 1) throw new errorResponse("Amount can not be less than 1");

        const merchantOrderId = randomUUID();
        const redirectUrl = `https://www.poppk.in/redirect/successful_payment?merchantOrderId=${merchantOrderId}`;

        const request = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(amount)
            .redirectUrl(redirectUrl)
            .build();
  
        client.pay(request).then((response)=> {
            const checkoutPageUrl = response.redirectUrl;
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
        client.getOrderStatus(req.body.merchantOrderId).then((response) => {
            const state = response.state;
            if(state === "COMPLETED") {
                res.status(200).json({
                    success: true,
                    message: `Payment Success`,
                    data: { state, oder_info: response },
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: `Payment ${state}`,
                    data: { state, oder_info: response },
                });
            }
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