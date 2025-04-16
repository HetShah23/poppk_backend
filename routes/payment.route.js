const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { check } = require("express-validator");
const { asyncHandler } = require("../helper/common.helper");
const { FRONTEND_URL } = require("../const");
const axios = require("axios");

const merchantId = process.env.LIVE === 1 ? process.env.MERCHANT_ID_LIVE : process.env.MERCHANT_ID_TEST
const saltKey = process.env.LIVE === 1 ? process.env.SALT_KEY_LIVE : process.env.SALT_KEY_TEST

router.post(
    "/transction-founder",
    [check("merchantOrderId").exists()],
    asyncHandler(async (req, res) => {

        const { merchantOrderId, user_id, amount, phone } = req.body

        let data = {
            merchantOrderId: merchantOrderId,
            expireAfter: 1200,
            amount: amount * 100, //rs to paisa
            paymentFlow: {
                type: "PG_CHECKOUT",
                message: "Payment message used for collect requests",
                merchantUrls: {
                    redirectUrl: `${FRONTEND_URL}/payment-redirect/id=${merchantId}`
                },
                paymentModeConfig: {
                    enabledPaymentModes: [
                        {
                            "type": "UPI_INTENT"
                        },
                        {
                            "type": "UPI_COLLECT"
                        },
                        {
                            "type": "UPI_QR"
                        },
                        {
                            "type": "NET_BANKING"
                        },
                        {
                            "type": "CARD",
                            "cardTypes": [
                                "DEBIT_CARD",
                                "CREDIT_CARD"
                            ]
                        }
                    ],
                }
            }
        }

        const payload = JSON.stringify(data);
        const payload_base64 = Buffer.from(payload).toString("base64");
        const keyIndex = 1;
        const packet = payload_base64 + "/pg/v1/pay" + saltKey;
        const packet_sha265 = crypto.createHash('sha256').update(packet).digest('hex');
        const checksum = packet_sha265 + '###' + keyIndex;

        const prod_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay"
        const testing_url = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay"
        const phonepe_url = process.env.LIVE === 1 ? prod_URL : testing_url;

        const options = {
            method: 'POST',
            url: phonepe_url,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: data
        };

        axios.request(options).then((response) => {
            console.log(response.data)

            return res.json(response.data)
        })
        .catch((error) => {
            console.error(error);
            res.status(403).json({ success: false, message: "failed", data: error });
        });

        
        // res.status(200).json({
        //     success: true,
        //     message: "Inquiry uploaded successfully",
        //     data: {},
        // });
    })
);


module.exports = router;