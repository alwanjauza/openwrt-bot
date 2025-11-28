import cron from 'node-cron';
import axios from 'axios';
import 'dotenv/config';

async function sendDailyQuote(sock, targetNumber) {
    try {
        if (!targetNumber.endsWith('@s.whatsapp.net')) {
            targetNumber += '@s.whatsapp.net';
        }

        const res = await axios.get("https://api.api-ninjas.com/v1/quotes", {
            headers: { "X-Api-Key": process.env.NINJA_API_KEY },
        });

        const quote = res.data[0];
        const message = `╭──〔 🌄 QUOTE PAGI 〕──
┊ 💬 *${quote.quote}*
┊ ✍️ _${quote.author}_
╰──────────────────────`;

        await sock.sendMessage(targetNumber, { text: message });
        console.log(`✅ Quote terkirim ke ${targetNumber}`);

    } catch (error) {
        console.error(`❌ Gagal kirim quote ke ${targetNumber}:`, error?.message);
    }
}

export const initCron = (sock) => {
    console.log("⏰ Sistem Cronjob Aktif (Jadwal: 06:00 WIB)");
    
    cron.schedule("0 6 * * *", async () => {
        const targets = [
            process.env.OWNER_NUMBER,
        ].filter(Boolean);

        console.log("🔄 Menjalankan Cronjob Pagi...");
        
        for (const number of targets) {
            await sendDailyQuote(sock, number);
            await new Promise(r => setTimeout(r, 5000));
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
};