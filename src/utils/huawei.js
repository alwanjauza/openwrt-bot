import axios from 'axios';
import xml2js from 'xml2js';
import crypto from 'crypto';

const MODEM_IP = process.env.HUAWEI_MODEM_IP  || '192.168.8.1';
const USER = process.env.USERNAME_HUAWEI || 'admin';
const PASS = process.env.PASSWORD_HUAWEI || 'admin';
const BASE_URL = `http://${MODEM_IP}/api`;

const parser = new xml2js.Parser({ explicitArray: false });

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const b64 = (data) => Buffer.from(data).toString('base64');

export const getHuaweiSMS = async () => {
    try {
        let res = await axios.get(`${BASE_URL}/webserver/SesTokInfo`);
        let data = await parser.parseStringPromise(res.data);
        
        let cookie = data.response.SesInfo;
        let token = data.response.TokInfo;

        const passwordHash = b64(sha256(USER + b64(sha256(PASS)) + token));

        const loginPayload = `<?xml version="1.0" encoding="UTF-8"?>
        <request>
            <Username>${USER}</Username>
            <Password>${passwordHash}</Password>
            <password_type>4</password_type>
        </request>`;

        await axios.post(`${BASE_URL}/user/login`, loginPayload, {
            headers: {
                'Cookie': cookie,
                '__RequestVerificationToken': token,
                'Content-Type': 'text/xml'
            }
        });

        res = await axios.get(`${BASE_URL}/webserver/SesTokInfo`, {
            headers: { 'Cookie': cookie }
        });
        data = await parser.parseStringPromise(res.data);
        
        cookie = data.response.SesInfo;
        token = data.response.TokInfo;

        const smsPayload = `<?xml version="1.0" encoding="UTF-8"?>
        <request>
            <PageIndex>1</PageIndex>
            <ReadCount>20</ReadCount>
            <BoxType>1</BoxType>
            <SortType>0</SortType>
            <Ascending>0</Ascending>
            <UnreadPreferred>0</UnreadPreferred>
        </request>`;

        res = await axios.post(`${BASE_URL}/sms/sms-list`, smsPayload, {
            headers: {
                'Cookie': cookie,
                '__RequestVerificationToken': token,
                'Content-Type': 'text/xml'
            }
        });

        const result = await parser.parseStringPromise(res.data);
        
        if (!result.response || !result.response.Messages || !result.response.Messages.Message) {
            return [];
        }

        let messages = result.response.Messages.Message;
        if (!Array.isArray(messages)) {
            messages = [messages];
        }

        return messages;

    } catch (error) {
        console.error("Huawei Login Error:", error.message);
        if (error.response) console.error("Detail:", error.response.data);
        throw new Error("Gagal Login Modem. Cek IP/User/Pass.");
    }
};