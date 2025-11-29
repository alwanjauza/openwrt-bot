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
┊
╰──────────────────────`;
                await sock.sendMessage(remoteJid, { text: menuMsg }, { quoted: m });
                await react("✅");
                break;

            case 'ping':
                await react("⏳");
                const pingMsg = `╭──〔 🏓 PONG! 〕──
┊ 
┊ Bot Online & Ready!
┊ Speed: Fast ⚡
┊
╰──────────────────────`;
                await sock.sendMessage(remoteJid, { text: pingMsg }, { quoted: m });
                await react("✅");
                break;

            case 'info':
                await react("⏳");
                const stats = getSystemInfo();
                
                exec('cat /sys/class/thermal/thermal_zone0/temp', async (err, stdout) => {
                    let temp = 'N/A';
                    if (!err) {
                        temp = (parseInt(stdout) / 1000).toFixed(1) + '°C';
                    }

                    const infoMsg = `╭──〔 📊 STB STATUS 〕──
┊
┊ 🖥️ Platform : ${stats.platform} (${stats.arch})
┊ 🌡️ Temp     : ${temp}
┊ 🧠 RAM Used : ${stats.ramUsed}
┊ 🆓 RAM Free : ${stats.ramFree}
┊ ⏱️ Uptime   : ${stats.uptime}
┊
╰──────────────────────`;
                    
                    await sock.sendMessage(remoteJid, { text: infoMsg }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'weather':
            case 'w':
                if (!args.length) return await sock.sendMessage(remoteJid, { text: '❌ Input city name! Ex: .weather London' }, { quoted: m });
                
                await react("⏳");

                try {
                    const cityInput = args.join(' ').toLowerCase();
                    const apiKey = process.env.OPENWEATHER_API_KEY;

                    if (!apiKey) {
                        await sock.sendMessage(remoteJid, { text: '❌ OpenWeather API Key not set in .env!' }, { quoted: m });
                        return await react("❌");
                    }

                    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityInput}&appid=${apiKey}&units=metric&lang=en`;
                    const { data } = await axios.get(apiUrl);

                    const cuacaMsg = `╭──〔 🌦️ WEATHER REPORT 〕──
┊
┊ 🏙️ City      : ${data.name}, ${data.sys.country}
┊ 🌡️ Temp      : ${data.main.temp}°C
┊ 🌡️ Feels Like: ${data.main.feels_like}°C
┊ ☁️ Condition : ${data.weather[0].description}
┊ 💧 Humidity  : ${data.main.humidity}%
┊ 💨 Wind      : ${data.wind.speed} m/s
┊
╰──────────────────────`;

                    await sock.sendMessage(remoteJid, { text: cuacaMsg }, { quoted: m });
                    await react("✅");

                } catch (e) {
                    console.error(e);
                    if (e.response && e.response.status === 404) {
                        await sock.sendMessage(remoteJid, { text: `❌ City *${args.join(' ')}* not found.` }, { quoted: m });
                    } else {
                        await sock.sendMessage(remoteJid, { text: '❌ Error fetching weather data.' }, { quoted: m });
                    }
                    await react("❌");
                }
                break;

            case 'speedtest':
            case 'speed':
                await react("⏳");
                await sock.sendMessage(remoteJid, { text: '🚀 *Speedtest running...*\n⏳ Please wait ±30 seconds.' }, { quoted: m });

                exec('speedtest --accept-license --accept-gdpr', async (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Exec error: ${error}`);
                        await sock.sendMessage(remoteJid, { text: '❌ Failed to execute speedtest. Ensure package is installed.' }, { quoted: m });
                        return await react("❌");
                    }

                    const output = stdout + (stderr ? `\nNote: ${stderr}` : '');
                    const cleanOutput = output.trim();

                    const speedMsg = `╭──〔 🚀 SPEEDTEST RESULT 〕──
┊
${cleanOutput}
┊
╰──────────────────────`;

                    await sock.sendMessage(remoteJid, { text: speedMsg }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'myip':
                await react("⏳");
                try {
                    const res = await axios.get('https://ipinfo.io/json');
                    const info = res.data;
                    const ipMsg = `╭──〔 🌍 PUBLIC IP INFO 〕──
┊
┊ 📍 IP       : ${info.ip}
┊ 🏢 ISP      : ${info.org}
┊ 🏙️ Location : ${info.city}, ${info.country}
┊
╰──────────────────────`;
                    await sock.sendMessage(remoteJid, { text: ipMsg }, { quoted: m });
                    await react("✅");
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Failed to check IP.' }, { quoted: m });
                    await react("❌");
                }
                break;

            case 'restartoc':
                if (!remoteJid.includes(config.ownerNumber.replace('@s.whatsapp.net', ''))) {
                   await react("❌");
                   return await sock.sendMessage(remoteJid, { text: '⛔ You do not have access to perform this command!' }, { quoted: m });
                }

                await react("⏳");
                await sock.sendMessage(remoteJid, { text: '♻️ Restarting OpenClash service...' }, { quoted: m });
                
                exec('/etc/init.d/openclash restart', async (err, stdout) => {
                    if (err) {
                        await sock.sendMessage(remoteJid, { text: '❌ Failed to restart OpenClash.' }, { quoted: m });
                        return await react("❌");
                    }
                    const ocMsg = `╭──〔 ✅ SUCCESS 〕──
┊
┊ OpenClash restarted successfully!
┊ Please check your connection.
┊
╰──────────────────────`;
                    await sock.sendMessage(remoteJid, { text: ocMsg }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'tiktok':
            case 'tt':
                if (!args[0]) return await sock.sendMessage(remoteJid, { text: '❌ Please provide TikTok link!' }, { quoted: m });
                await react("⏳");
                
                try {
                    const apiUrl = `https://www.tikwm.com/api/?url=${args[0]}`;
                    const res = await axios.get(apiUrl);
                    const data = res.data.data;
                    
                    if (!data) {
                        await sock.sendMessage(remoteJid, { text: '❌ Video not found/Private.' }, { quoted: m });
                        return await react("❌");
                    }

                    const ttMsg = `╭──〔 🎵 TIKTOK NO WM 〕──
┊
┊ 📝 Title  : ${data.title}
┊ 👤 Author : ${data.author.nickname}
┊ ▶️ Plays  : ${data.play_count}
┊
╰──────────────────────`;

                    await sock.sendMessage(remoteJid, { 
                        video: { url: data.play }, 
                        caption: ttMsg 
                    }, { quoted: m });
                    await react("✅");
                    
                } catch (e) {
                    console.log(e);
                    await sock.sendMessage(remoteJid, { text: '❌ Failed to download video.' }, { quoted: m });
                    await react("❌");
                }
                break;
        }

    } catch (err) {
        console.error('Handler Error:', err);
    }
};