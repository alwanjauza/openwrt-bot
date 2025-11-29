import axios from 'axios';
import xml2js from 'xml2js';
import crypto from 'crypto';
import fs from 'fs';

const MODEM_IP = process.env.HUAWEI_MODEM_IP || '192.168.8.1';
const USER = process.env.USERNAME_HUAWEI || 'admin';
const PASS = process.env.PASSWORD_HUAWEI || 'admin';
const BASE_URL = `http://${MODEM_IP}/api`;
const LOG_FILE = process.env.HUAWEI_DEBUG_LOG || '/tmp/huawei-hilink-debug.log';
const VERBOSE = process.env.DEBUG_HUAWEI === 'true' || process.env.DEBUG_HUAWEI === '1' || true;

const parser = new xml2js.Parser({ explicitArray: false });
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const b64 = (data) => Buffer.from(data).toString('base64');

function log(...args) {
  const msg = `[${new Date().toISOString()}]` + ' ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ');
  console.log(msg);
  try { fs.appendFileSync(LOG_FILE, msg + '\n'); } catch (e) { /* ignore file errors */ }
}

function safeParseXml(xml) {
  return parser.parseStringPromise(xml).catch(err => {
    log('XML Parse Error:', err.message);
    return null;
  });
}

function buildCookieFromSetCookie(setCookieArray) {
  if (!setCookieArray) return '';
  try {
    return setCookieArray.map(c => c.split(';')[0]).join('; ');
  } catch (e) {
    return '';
  }
}

function normalizeToken(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) raw = raw.join('');
  return raw.split('#')[0].trim();
}

async function httpGet(url) {
  try {
    const res = await axios.get(url, { timeout: 10000 });
    if (VERBOSE) log('HTTP GET', url, '-> status', res.status);
    if (VERBOSE) log('Response headers:', res.headers);
    if (VERBOSE) log('Response body snippet:', typeof res.data === 'string' ? res.data.slice(0, 1000) : res.data);
    return res;
  } catch (err) {
    log('HTTP GET Error for', url, err.message, err.response && { status: err.response.status, headers: err.response.headers });
    throw err;
  }
}

async function httpPost(url, payload, headers = {}) {
  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    if (VERBOSE) log('HTTP POST', url, '-> status', res.status);
    if (VERBOSE) log('Request headers:', headers);
    if (VERBOSE) log('Request body snippet:', (typeof payload === 'string') ? payload.slice(0, 1000) : payload);
    if (VERBOSE) log('Response headers:', res.headers);
    if (VERBOSE) log('Response body snippet:', typeof res.data === 'string' ? res.data.slice(0, 2000) : res.data);
    return res;
  } catch (err) {
    log('HTTP POST Error for', url, err.message, err.response && { status: err.response.status, headers: err.response.headers, dataSnippet: err.response && typeof err.response.data === 'string' ? err.response.data.slice(0,1000) : err.response && err.response.data });
    throw err;
  }
}

export const getHuaweiSMS = async () => {
  try {
    log('=== START: getHuaweiSMS ===');

    log('1) GET SesTokInfo:', `${BASE_URL}/webserver/SesTokInfo`);
    const res1 = await httpGet(`${BASE_URL}/webserver/SesTokInfo`);

    log('-- res1.headers --', res1.headers);
    log('-- res1.data (first 2000 chars) --');
    log(typeof res1.data === 'string' ? res1.data.slice(0, 2000) : JSON.stringify(res1.data));

    const parsed1 = await safeParseXml(res1.data);
    log('Parsed SesTokInfo:', parsed1);

    const sesInfo = parsed1?.response?.SesInfo || null;
    const tokInfo = parsed1?.response?.TokInfo || null;

    let cookie = buildCookieFromSetCookie(res1.headers['set-cookie']) || sesInfo || '';
    log('Initial cookie built:', cookie);

    const headerToken = normalizeToken(res1.headers && (res1.headers['__requestverificationtoken'] || res1.headers['__requestverificationtoken2']));
    const initialToken = tokInfo || headerToken || null;
    log('Initial token candidates:', { tokInfo, headerToken, initialToken });

    if (!cookie) log('WARNING: No cookie detected from Set-Cookie or SesInfo. This may cause login/session problems.');
    if (!initialToken) log('WARNING: No initial token detected from SesTokInfo. This may cause password hashing issue.');

    log('2) LOGIN');
    const passwordHash = b64(sha256(USER + b64(sha256(PASS)) + (initialToken || '')));
    const loginPayload = `<?xml version="1.0" encoding="UTF-8"?><request><Username>${USER}</Username><Password>${passwordHash}</Password><password_type>4</password_type></request>`;

    log('Login payload snippet:', loginPayload.slice(0, 400));

    const loginHeaders = {
      'Cookie': cookie || '',
      '__RequestVerificationToken': initialToken || '',
      'Content-Type': 'text/xml'
    };

    const resLogin = await httpPost(`${BASE_URL}/user/login`, loginPayload, loginHeaders);

    log('-- resLogin.headers --', resLogin.headers);
    log('-- resLogin.data (first 2000 chars) --');
    log(typeof resLogin.data === 'string' ? resLogin.data.slice(0, 2000) : JSON.stringify(resLogin.data));

    const parsedLogin = await safeParseXml(resLogin.data);
    log('Parsed login response:', parsedLogin);

    if (resLogin.headers && resLogin.headers['set-cookie']) {
      const newCookie = buildCookieFromSetCookie(resLogin.headers['set-cookie']);
      cookie = [newCookie, cookie].filter(Boolean).join('; ');
      log('Updated cookie after login:', cookie);
    }

    const tokenFromLoginHeader = normalizeToken(resLogin.headers && (resLogin.headers['__requestverificationtoken'] || resLogin.headers['__requestverificationtoken2']));
    const token = tokenFromLoginHeader || parsedLogin?.response?.TokInfo || initialToken;
    log('Token chosen for SMS request:', { tokenFromLoginHeader, parsedLoginTokInfo: parsedLogin?.response?.TokInfo, token });

    if (parsedLogin?.error) {
      log('LOGIN ERROR:', parsedLogin.error);
      if (parsedLogin.error.code !== '108006') {
        log('Login failed – returning empty array.');
        return [];
      }
    } else {
      log('Login seems successful per response body.');
    }

    log('3) Fetch SMS');
    const smsPayload = `<?xml version="1.0" encoding="UTF-8"?>\n<request>\n    <PageIndex>1</PageIndex>\n    <ReadCount>20</ReadCount>\n    <BoxType>1</BoxType>\n    <SortType>0</SortType>\n    <Ascending>0</Ascending>\n    <UnreadPreferred>0</UnreadPreferred>\n</request>`;

    const smsHeaders = {
      'Cookie': cookie || '',
      '__RequestVerificationToken': token || '',
      'Content-Type': 'text/xml; charset=UTF-8'
    };

    log('SMS request headers:', smsHeaders);
    log('SMS request payload snippet:', smsPayload.slice(0, 400));

    const resSms = await httpPost(`${BASE_URL}/sms/sms-list`, smsPayload, smsHeaders);

    log('-- resSms.headers --', resSms.headers);
    log('-- resSms.data (first 4000 chars) --');
    log(typeof resSms.data === 'string' ? resSms.data.slice(0, 4000) : JSON.stringify(resSms.data));

    const parsedSms = await safeParseXml(resSms.data);
    log('Parsed SMS response:', parsedSms);

    if (parsedSms?.error) {
      log('SMS FETCH ERROR CODE:', parsedSms.error.code, parsedSms.error);
      return [];
    }

    if (resSms.headers && resSms.headers['set-cookie']) {
      const newCookie = buildCookieFromSetCookie(resSms.headers['set-cookie']);
      cookie = [newCookie, cookie].filter(Boolean).join('; ');
      log('Updated cookie after sms-list:', cookie);
    }

    let messages = [];
    if (parsedSms?.response) {
      if (parsedSms.response.Messages && parsedSms.response.Messages.Message) {
        messages = parsedSms.response.Messages.Message;
      } else if (parsedSms.response.Messages && Array.isArray(parsedSms.response.Messages)) {
        messages = parsedSms.response.Messages;
      }
    }

    if (messages && !Array.isArray(messages)) messages = [messages];

    log('Successfully retrieved messages count:', messages ? messages.length : 0);
    log('=== END: getHuaweiSMS ===');
    return messages || [];

  } catch (err) {
    log('Fatal Error in getHuaweiSMS:', err.message, err.stack, err.response && { status: err.response.status, headers: err.response.headers, dataSnippet: err.response && typeof err.response.data === 'string' ? err.response.data.slice(0,1000) : err.response && err.response.data });
    return [];
  }
}

export default getHuaweiSMS;
