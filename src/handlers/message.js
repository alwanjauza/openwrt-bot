const { getSystemInfo } = require('../utils/sysinfo');
const config = require('../config');

module.exports = async (sock, m, chatUpdate) => {
    try {
        const msgType = Object.keys(m.message)[0];
        const body = msgType === 'conversation' ? m.message.conversation :
                     msgType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : '';
        
        if (!body) return;

        const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : '';
        if (!prefix) return;

        const command = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const remoteJid = m.key.remoteJid;

        console.log(`[CMD] ${command} from ${remoteJid}`);

        switch (command) {
            case 'ping':
                await sock.sendMessage(remoteJid, { text: 'Pong! 🏓 Bot Online di STB.' }, { quoted: m });
                break;

            case 'info':
            case 'status':
                const stats = getSystemInfo();
                const textInfo = `📊 *STB STATUS* 📊\n\n` +
                                 `💻 Platform: ${stats.platform} (${stats.arch})\n` +
                                 `🧠 RAM Used: ${stats.ramUsed} / ${stats.ramTotal}\n` +
                                 `🆓 RAM Free: ${stats.ramFree}\n` +
                                 `⏱️ Uptime: ${stats.uptime}`;
                await sock.sendMessage(remoteJid, { text: textInfo }, { quoted: m });
                break;

            case 'menu':
                const menu = `Hello! Ini bot OpenWrt.\n\n` +
                             `Commands:\n` +
                             `- ${prefix}ping\n` +
                             `- ${prefix}info (Cek Status STB)\n` +
                             `- ${prefix}menu`;
                await sock.sendMessage(remoteJid, { text: menu }, { quoted: m });
                break;

            default:
                break;
        }

    } catch (err) {
        console.error('Error handling message:', err);
    }
};