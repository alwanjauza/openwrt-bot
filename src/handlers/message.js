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

        if (isCmd) console.log(`[CMD] ${command} dari ${remoteJid}`);

        const react = async (emoji) => {
            await sock.sendMessage(remoteJid, { 
                react: { text: emoji, key: m.key } 
            });
        };

        switch (command) {
            case 'menu':
                await react("⏳");
                const menuMsg = `╭──〔 🤖 DASHBOARD BOT 〕──
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
┊ 📥 *DOWNLOADER*
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
                // Ambil data sistem sync
                const stats = getSystemInfo();
                
                // Ambil suhu via exec (async)
                exec('cat /sys/class/thermal/thermal_zone0/temp', async (err, stdout) => {
                    let temp = 'N/A';
                    if (!err) {
                        temp = (parseInt(stdout) / 1000).toFixed(1) + '°C';
                    }

                    const infoMsg = `╭──〔 📊 STATUS STB 〕──
┊
┊ 🖥️ Platform : ${stats.platform} (${stats.arch})
┊ 🌡️ Suhu     : ${temp}
┊ 🧠 RAM Used : ${stats.ramUsed}
┊ 🆓 RAM Free : ${stats.ramFree}
┊ ⏱️ Uptime   : ${stats.uptime}
┊
╰──────────────────────`;
                    
                    await sock.sendMessage(remoteJid, { text: infoMsg }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'speedtest':
            case 'speed':
                await react("⏳");
                await sock.sendMessage(remoteJid, { text: '🚀 *Speedtest sedang berjalan...*\n⏳ Mohon tunggu ±30 detik.' }, { quoted: m });

                exec('speedtest --accept-license --accept-gdpr', async (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Exec error: ${error}`);
                        await sock.sendMessage(remoteJid, { text: '❌ Gagal menjalankan speedtest.' }, { quoted: m });
                        return await react("❌");
                    }

                    const output = stdout + (stderr ? `\nNote: ${stderr}` : '');
                    const cleanOutput = output.trim();

                    const speedMsg = `╭──〔 🚀 HASIL SPEEDTEST 〕──
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
                    const ipMsg = `╭──〔 🌍 IP PUBLIC INFO 〕──
┊
┊ 📍 IP       : ${info.ip}
┊ 🏢 ISP      : ${info.org}
┊ 🏙️ Lokasi   : ${info.city}, ${info.country}
┊
╰──────────────────────`;
                    await sock.sendMessage(remoteJid, { text: ipMsg }, { quoted: m });
                    await react("✅");
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Gagal cek IP.' }, { quoted: m });
                    await react("❌");
                }
                break;

            case 'restartoc':
                if (!remoteJid.includes(config.ownerNumber.replace('@s.whatsapp.net', ''))) {
                   return await react("❌");
                }

                await react("⏳");
                await sock.sendMessage(remoteJid, { text: '♻️ Sedang merestart OpenClash...' }, { quoted: m });
                
                exec('/etc/init.d/openclash restart', async (err, stdout) => {
                    if (err) {
                        await sock.sendMessage(remoteJid, { text: '❌ Gagal restart OpenClash.' }, { quoted: m });
                        return await react("❌");
                    }
                    const ocMsg = `╭──〔 ✅ SUKSES 〕──
┊
┊ OpenClash berhasil direstart!
┊ Cek koneksi kembali.
┊
╰──────────────────────`;
                    await sock.sendMessage(remoteJid, { text: ocMsg }, { quoted: m });
                    await react("✅");
                });
                break;

            case 'tiktok':
            case 'tt':
                if (!args[0]) return await sock.sendMessage(remoteJid, { text: '❌ Masukkan link TikTok!' }, { quoted: m });
                await react("⏳");
                
                try {
                    const apiUrl = `https://www.tikwm.com/api/?url=${args[0]}`;
                    const res = await axios.get(apiUrl);
                    const data = res.data.data;
                    
                    if (!data) {
                        await sock.sendMessage(remoteJid, { text: '❌ Video tidak ditemukan/Private.' }, { quoted: m });
                        return await react("❌");
                    }

                    const ttMsg = `╭──〔 🎵 TIKTOK NO WM 〕──
┊
┊ 📝 Judul  : ${data.title}
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
                    await sock.sendMessage(remoteJid, { text: '❌ Gagal download video.' }, { quoted: m });
                    await react("❌");
                }
                break;
        }

    } catch (err) {
        console.error('Handler Error:', err);
    }
};