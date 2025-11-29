import axios from 'axios';
import xml2js from 'xml2js';
import crypto from 'crypto';

const MODEM_IP = process.env.HUAWEI_MODEM_IP || '192.168.8.1';
const USER = process.env.USERNAME_HUAWEI || 'admin';
const PASS = process.env.PASSWORD_HUAWEI || 'admin';
const BASE_URL = `http://${MODEM_IP}/api`;

const DEBUG = process.env.DEBUG_HUAWEI === 'true' || false;

const parser = new xml2js.Parser({ explicitArray: false, trim: true });

const sha256 = (data) => crypto.createHash('sha256').update(data, 'utf8').digest('hex');
const b64 = (data) => Buffer.from(data, 'utf8').toString('base64');

const log = (...args) => { if (DEBUG) console.debug('[HUAWEI]', ...args); };
const warn = (...args) => console.warn('[HUAWEI]', ...args);
const errlog = (...args) => console.error('[HUAWEI]', ...args);

function normalizeToken(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) raw = raw.join('');
  return String(raw).split('#')[0].trim() || null;
}

function cookieFromSetCookie(setCookie) {
  if (!setCookie) return '';
  try {
    return setCookie.map(s => s.split(';')[0]).join('; ');
  } catch (e) {
    return '';
  }
}

const http = axios.create({
  timeout: 10_000,
  validateStatus: (s) => s >= 200 && s < 500, 
  headers: {
    'User-Agent': 'Huawei-HiLink-Client/1.0',
  }
});

async function parseXmlSafe(xml) {
  try {
    return await parser.parseStringPromise(xml);
  } catch (e) {
    errlog('XML parse failed:', e.message);
    return null;
  }
}

export async function getHuaweiSMS() {
  try {
    log('Starting getHuaweiSMS ->', BASE_URL);

    log('GET /webserver/SesTokInfo');
    const res1 = await http.get(`${BASE_URL}/webserver/SesTokInfo`);
    if (res1.status !== 200) {
      errlog('Failed to GET SesTokInfo, status', res1.status);
      return [];
    }
    log('SesTokInfo headers:', res1.headers);
    log('SesTokInfo body snippet:', typeof res1.data === 'string' ? res1.data.slice(0, 400) : undefined);

    const parsed1 = await parseXmlSafe(res1.data);
    const sesInfo = parsed1?.response?.SesInfo || '';
    const tokInfo = parsed1?.response?.TokInfo || '';
    let cookie = cookieFromSetCookie(res1.headers['set-cookie']) || sesInfo || '';
    const initialToken = tokInfo || normalizeToken(res1.headers && (res1.headers['__requestverificationtoken'] || res1.headers['__requestverificationtokenone'] || res1.headers['__requestverificationtokentwo']));

    if (!cookie) warn('No session cookie found from SesTokInfo (Set-Cookie absent and SesInfo empty).');
    if (!initialToken) warn('No initial token found from SesTokInfo.');

    log('Login with username:', USER);
    const passwordHash = b64(sha256(USER + b64(sha256(PASS)) + (initialToken || '')));
    const loginPayload = `<?xml version="1.0" encoding="UTF-8"?><request><Username>${USER}</Username><Password>${passwordHash}</Password><password_type>4</password_type></request>`;

    const loginHeaders = {
      'Cookie': cookie || '',
      '__RequestVerificationToken': initialToken || '',
      'Content-Type': 'text/xml'
    };

    const resLogin = await http.post(`${BASE_URL}/user/login`, loginPayload, { headers: loginHeaders });
    if (resLogin.status >= 400) {
      errlog('Login HTTP error', resLogin.status);
      return [];
    }
    log('Login headers:', resLogin.headers);
    log('Login response snippet:', typeof resLogin.data === 'string' ? resLogin.data.slice(0, 200) : undefined);

    const parsedLogin = await parseXmlSafe(resLogin.data);
    if (resLogin.headers && resLogin.headers['set-cookie']) {
      const newCookie = cookieFromSetCookie(resLogin.headers['set-cookie']);
      cookie = [newCookie, cookie].filter(Boolean).join('; ');
      log('Cookie updated after login.');
    }
    const tokenFromLoginHeader = normalizeToken(resLogin.headers && (resLogin.headers['__requestverificationtoken'] || resLogin.headers['__requestverificationtokenone'] || resLogin.headers['__requestverificationtokentwo']));
    const token = tokenFromLoginHeader || parsedLogin?.response?.TokInfo || initialToken || '';

    if (parsedLogin?.error) {
      errlog('Login returned error:', parsedLogin.error);
      if (parsedLogin.error.code !== '108006') return [];
    } else {
      log('Login OK (body).');
    }

    log('Fetching /sms/sms-list');
    const smsPayload = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <PageIndex>1</PageIndex>
  <ReadCount>20</ReadCount>
  <BoxType>1</BoxType>
  <SortType>0</SortType>
  <Ascending>0</Ascending>
  <UnreadPreferred>0</UnreadPreferred>
</request>`;

    const smsHeaders = {
      'Cookie': cookie || '',
      '__RequestVerificationToken': token || '',
      'Content-Type': 'text/xml; charset=UTF-8'
    };

    const resSms = await http.post(`${BASE_URL}/sms/sms-list`, smsPayload, { headers: smsHeaders });
    if (resSms.status >= 400) {
      errlog('sms-list HTTP error', resSms.status);
      return [];
    }
    log('sms-list headers:', resSms.headers);
    log('sms-list response snippet:', typeof resSms.data === 'string' ? resSms.data.slice(0, 500) : undefined);

    if (resSms.headers && resSms.headers['set-cookie']) {
      const newCookie = cookieFromSetCookie(resSms.headers['set-cookie']);
      cookie = [newCookie, cookie].filter(Boolean).join('; ');
      log('Cookie updated after sms-list.');
    }

    const parsedSms = await parseXmlSafe(resSms.data);
    if (!parsedSms) {
      errlog('sms-list returned unparsable XML.');
      return [];
    }
    if (parsedSms?.error) {
      errlog('sms-list returned error code:', parsedSms.error);
      return [];
    }

    let messages = [];
    if (parsedSms?.response) {
      const msgsNode = parsedSms.response.Messages;
      if (!msgsNode) {
        log('No Messages node in response.');
        return [];
      }
      const m = msgsNode.Message;
      if (!m) return [];
      messages = Array.isArray(m) ? m : [m];
    }

    messages = messages.map(msg => ({
      index: msg.Index || null,
      phone: msg.Phone || '',
      content: msg.Content || '',
      date: msg.Date || '',
      smstat: msg.Smstat || '',
      saveType: msg.SaveType || '',
      priority: msg.Priority || '',
      smsType: msg.SmsType || ''
    }));

    log(`Fetched ${messages.length} messages.`);
    return messages;
  } catch (e) {
    errlog('Unexpected error in getHuaweiSMS:', e && e.message ? e.message : e);
    return [];
  }
}

export default getHuaweiSMS;
