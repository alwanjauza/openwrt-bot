import { getSystemInfo } from '../utils/sysinfo.js';
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
        const remoteJid = m.key.remoteJid;

        if (isCmd) console.log(`[CMD] ${command} dari ${remoteJid}`);

        switch (command) {
            case 'menu':
                await sock.sendMessage(remoteJid, { text: `🤖 *Menu Bot*\n\n• .ping - Cek respon bot\n• .info - Info sistem bot` }, { quoted: m });
                break;

            case 'ping':
                await sock.sendMessage(remoteJid, { text: 'Pong! 🏓' }, { quoted: m });
                break;

            case 'info':
                const stats = getSystemInfo();
                await sock.sendMessage(remoteJid, { text: `📊 RAM: ${stats.ramUsed} / ${stats.ramTotal}\n⏱️ Uptime: ${stats.uptime}` }, { quoted: m });
                break;            
        }

    } catch (err) {
        console.error('Handler Error:', err);
    }
};