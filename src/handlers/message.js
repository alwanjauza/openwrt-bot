import { getSystemInfo } from '../utils/sysinfo.js'; // Wajib .js
import config from '../config.js'; // Wajib .js

export default async (sock, m, chatUpdate) => {
    try {
        const msgType = Object.keys(m.message)[0];
        const body = msgType === 'conversation' ? m.message.conversation :
                     msgType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : '';
        
        if (!body) return;

        const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : '.';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const remoteJid = m.key.remoteJid;

        if (isCmd) console.log(`[CMD] ${command} dari ${remoteJid}`);

        switch (command) {
            case 'ping':
                await sock.sendMessage(remoteJid, { text: 'Pong! 🏓 Bot OpenWrt siap!' }, { quoted: m });
                break;

            case 'info':
            case 'status':
                const stats = getSystemInfo();
                const textInfo = `📊 *STATUS STB B860H* 📊\n\n` +
                                 `🖥️ Platform: ${stats.platform} (${stats.arch})\n` +
                                 `🧠 RAM Pakai: ${stats.ramUsed}\n` +
                                 `🆓 RAM Sisa: ${stats.ramFree}\n` +
                                 `⏱️ Uptime: ${stats.uptime}\n\n` +
                                 `_Powered by Baileys on OpenWrt_`;
                
                await sock.sendMessage(remoteJid, { text: textInfo }, { quoted: m });
                break;

            case 'menu':
                const menuText = `Halo! Ini menu bot:\n\n` +
                                 `➤ *${prefix}ping* - Cek respon\n` +
                                 `➤ *${prefix}info* - Cek RAM & Uptime STB`;
                await sock.sendMessage(remoteJid, { text: menuText }, { quoted: m });
                break;
        }

    } catch (err) {
        console.error('Error di message handler:', err);
    }
};