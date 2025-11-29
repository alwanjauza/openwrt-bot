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
        console.log("1. Mengambil Token Awal...");
        let res = await axios.get(`${BASE_URL}/webserver/SesTokInfo`);
        let data = await parser.parseStringPromise(res.data);
        
        let cookie = data.response.SesInfo;
        let token = data.response.TokInfo;

        console.log("2. Mencoba Login...");
        const passwordHash = b64(sha256(USER + b64(sha256(PASS)) + token));
        
        const loginPayload = `<?xml version="1.0" encoding="UTF-8"?><request><Username>${USER}</Username><Password>${passwordHash}</Password><password_type>4</password_type></request>`;

        res = await axios.post(`${BASE_URL}/user/login`, loginPayload, {
            headers: { 'Cookie': cookie, '__RequestVerificationToken': token, 'Content-Type': 'text/xml' }
        });

        const loginResult = await parser.parseStringPromise(res.data);
        console.log("   Status Login:", JSON.stringify(loginResult));

        if (loginResult.error) {
            console.log("   ❌ LOGIN GAGAL! Code:", loginResult.error.code);
            return []; 
        }

        console.log("3. Refresh Token...");
        res = await axios.get(`${BASE_URL}/webserver/SesTokInfo`, { headers: { 'Cookie': cookie } });
        data = await parser.parseStringPromise(res.data);
        
        token = data.response.TokInfo;

        console.log("4. Fetch SMS...");
        const smsPayload = `<?xml version="1.0" encoding="UTF-8"?><request><PageIndex>1</PageIndex><ReadCount>20</ReadCount><BoxType>1</BoxType><SortType>0</SortType><Ascending>0</Ascending><UnreadPreferred>0</UnreadPreferred></request>`;

        res = await axios.post(`${BASE_URL}/sms/sms-list`, smsPayload, {
            headers: { 
                'Cookie': cookie, 
                '__RequestVerificationToken': token, 
                'Content-Type': 'text/xml',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const result = await parser.parseStringPromise(res.data);
        
        if (result.error) {
            console.log("   ❌ Gagal Ambil SMS. Code:", result.error.code);
            return [];
        }

        let messages = [];
        if (result.response) {
            if (result.response.Messages && result.response.Messages.Message) {
                messages = result.response.Messages.Message;
            } else if (result.response.Messages && Array.isArray(result.response.Messages)) {
                messages = result.response.Messages;
            }
        }

        if (messages && !Array.isArray(messages)) messages = [messages];
        
        console.log(`   ✅ Berhasil! Dapat ${messages.length} SMS.`);
        return messages || [];

    } catch (error) {
        console.error("System Error:", error.message);
        return [];
    }
};