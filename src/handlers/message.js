import { getSystemInfo } from '../utils/sysinfo.js';
import { exec } from 'child_process';
import axios from 'axios';
import config from '../config.js';

export default async (sock, m, chatUpdate) => {
    try {
        const msgType = Object.keys(m.message)[0];
        const body = msgType === 'conversation' ? m.message.conversation :
                     msgType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : 
                     msgType === 'imageMessage' ? m.message.imageMessage.caption : '';
        
        if (!body) return;

        const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : '.';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const remoteJid = m.key.remoteJid;

        if (isCmd) console.log(`[CMD] ${command} from ${remoteJid}`);

        const react = async (emoji) => {
            await sock.sendMessage(remoteJid, { 
                react: { text: emoji, key: m.key } 
            });
        };

        switch (command) {
            case 'menu':
                await react("⏳");
                const menuMsg = `╭──〔 🤖 BOT DASHBOARD 〕──
┊
┊ 🤖 *INTELLIGENCE*
┊ • ${prefix}ai <question>
┊
┊ 📡 *NETWORK*
┊ • ${prefix}speedtest
┊ • ${prefix}myip
┊ • ${prefix}restartoc
┊
┊ 📱 *SYSTEM*
┊ • ${prefix}info
┊ • ${prefix}ping
┊
┊ 🌍 *TOOLS*
┊ • ${prefix}weather <city>
┊ • ${prefix}tiktok <link>
┊ • ${prefix}short <url>
┊
╰──────────────────────`;
                await sock.sendMessage(remoteJid, { text: menuMsg }, { quoted: m });
                await react("✅");
                break;

            case 'ai':
            case 'ask':
            case 'gemini':
                if (!args.length) return await sock.sendMessage(remoteJid, { text: '❌ Please ask something! Ex: .ai How to cook rice?' }, { quoted: m });
                await react("🧠");

                try {
                    const apiKey = process.env.GEMINI_API_KEY;
                    if (!apiKey) {
                         await sock.sendMessage(remoteJid, { text: '❌ Gemini API Key missing in .env' }, { quoted: m });
                         return await react("❌");
                    }

                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                    
                    const response = await axios.post(url, {
                        contents: [{ parts: [{ text: args.join(" ") }] }]
                    }, {
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const answer = response.data.candidates[0].content.parts[0].text;

                    const aiMsg = `╭──〔 🤖 GEMINI 2.0 〕──
┊
${answer.trim()}
┊
╰──────────────────────`;

                    await sock.sendMessage(remoteJid, { text: aiMsg }, { quoted: m });
                    await react("✅");

               } catch (e) {
                    console.error("Gemini Error:", e.response ? e.response.data : e.message);
                    
                    let errMsg = '❌ AI is currently unavailable.';
                    
                    if (e.response) {
                        if (e.response.status === 404) {
                            errMsg = '❌ Model not found (Check URL/Model Name).';
                        } else if (e.response.status === 400) {
                            errMsg = '❌ Bad Request (Invalid API Key?).';
                        } else if (e.response.status === 429) {
                            errMsg = '⏳ Rate limit exceeded. Please try again later.';
                        }
                    }
                    
                    await sock.sendMessage(remoteJid, { text: errMsg }, { quoted: m });
                    await react("❌");
                }
                break;

            case 'short':
            case 'shortlink':
                if (!args[0]) return await sock.sendMessage(remoteJid, { text: '❌ Send a link! Ex: .short https://google.com' }, { quoted: m });
                await react("⏳");

                try {
                    const url = `https://tinyurl.com/api-create.php?url=${args[0]}`;
                    const res = await axios.get(url);
                    
                    await sock.sendMessage(remoteJid, { text: `🔗 *Shortlink Created:*\n${res.data}` }, { quoted: m });
                    await react("✅");
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Failed to shorten URL.' }, { quoted: m });
                    await react("❌");
                }
                break;

            case 'ping':
                await react("⏳");
                await sock.sendMessage(remoteJid, { text: `╭──〔 🏓 PONG! 〕──\n┊ \n┊ Bot Online & Ready!\n┊ Speed: Fast ⚡\n┊\n╰──────────────────────` }, { quoted: m });
                await react("✅");
                break;

            case 'info':
                await react("⏳");
                const stats = getSystemInfo();
                exec('cat /sys/class/thermal/thermal_zone0/temp', async (err, stdout) => {
                    let temp = 'N/A';
                    if (!err) temp = (parseInt(stdout) / 1000).toFixed(1) + '°C';
                    const infoMsg = `╭──〔 📊 STB STATUS 〕──\n┊\n┊ 🖥️ Platform : ${stats.platform} (${stats.arch})\n┊ 🌡️ Temp     : ${temp}\n┊ 🧠 RAM Used : ${stats.ramUsed}\n┊ 🆓 RAM Free : ${stats.ramFree}\n┊ ⏱️ Uptime   : ${stats.uptime}\n┊\n╰──────────────────────`;
                    await sock.sendMessage(remoteJid, { text: infoMsg }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'weather':
            case 'w':
                if (!args.length) return await sock.sendMessage(remoteJid, { text: '❌ Input city name!' }, { quoted: m });
                await react("⏳");
                try {
                    const apiKey = process.env.OPENWEATHER_API_KEY;
                    if (!apiKey) return await react("❌");
                    const { data } = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${args.join(' ')}&appid=${apiKey}&units=metric&lang=en`);
                    const cuacaMsg = `╭──〔 🌦️ WEATHER REPORT 〕──\n┊\n┊ 🏙️ City      : ${data.name}, ${data.sys.country}\n┊ 🌡️ Temp      : ${data.main.temp}°C\n┊ ☁️ Condition : ${data.weather[0].description}\n┊ 💧 Humidity  : ${data.main.humidity}%\n┊ 💨 Wind      : ${data.wind.speed} m/s\n┊\n╰──────────────────────`;
                    await sock.sendMessage(remoteJid, { text: cuacaMsg }, { quoted: m });
                    await react("✅");
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ City not found.' }, { quoted: m });
                    await react("❌");
                }
                break;

            case 'speedtest':
            case 'speed':
                await react("⏳");
                await sock.sendMessage(remoteJid, { text: '🚀 *Speedtest running...*\n⏳ Please wait ±30s.' }, { quoted: m });
                exec('speedtest --accept-license --accept-gdpr', async (error, stdout, stderr) => {
                    if (error) {
                        await sock.sendMessage(remoteJid, { text: '❌ Speedtest failed.' }, { quoted: m });
                        return await react("❌");
                    }
                    await sock.sendMessage(remoteJid, { text: `╭──〔 🚀 SPEEDTEST RESULT 〕──\n┊\n${stdout.trim()}\n┊\n╰──────────────────────` }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'myip':
                await react("⏳");
                try {
                    const { data } = await axios.get('https://ipinfo.io/json');
                    await sock.sendMessage(remoteJid, { text: `╭──〔 🌍 PUBLIC IP INFO 〕──\n┊\n┊ 📍 IP       : ${data.ip}\n┊ 🏢 ISP      : ${data.org}\n┊ 🏙️ Location : ${data.city}, ${data.country}\n┊\n╰──────────────────────` }, { quoted: m });
                    await react("✅");
                } catch (e) { await react("❌"); }
                break;

            case 'restartoc':
                if (!remoteJid.includes(config.ownerNumber.replace('@s.whatsapp.net', ''))) { await react("❌"); return await sock.sendMessage(remoteJid, { text: '⛔ Access Denied!' }, { quoted: m }); }
                await react("⏳");
                await sock.sendMessage(remoteJid, { text: '♻️ Restarting OpenClash...' }, { quoted: m });
                exec('/etc/init.d/openclash restart', async (err) => {
                    if (err) { await react("❌"); return await sock.sendMessage(remoteJid, { text: '❌ Failed.' }, { quoted: m }); }
                    await sock.sendMessage(remoteJid, { text: `╭──〔 ✅ SUCCESS 〕──\n┊\n┊ OpenClash restarted!\n┊\n╰──────────────────────` }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'tiktok':
            case 'tt':
                if (!args[0]) return await sock.sendMessage(remoteJid, { text: '❌ Link required!' }, { quoted: m });
                await react("⏳");
                try {
                    const { data } = await axios.get(`https://www.tikwm.com/api/?url=${args[0]}`);
                    if (!data.data) { await react("❌"); return await sock.sendMessage(remoteJid, { text: '❌ Not found.' }, { quoted: m }); }
                    const v = data.data;
                    await sock.sendMessage(remoteJid, { video: { url: v.play }, caption: `╭──〔 🎵 TIKTOK 〕──\n┊ 📝 ${v.title}\n┊ 👤 ${v.author.nickname}\n╰────────────────` }, { quoted: m });
                    await react("✅");
                } catch (e) { await react("❌"); }
                break;
        }

    } catch (err) {
        console.error('Handler Error:', err);
    }
};