import cron from 'node-cron';
import axios from 'axios';
import { exec } from 'child_process';
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

async function clearUpdateLog(sock) {
    const ownerNumber = process.env.OWNER_NUMBER + '@s.whatsapp.net';
    
    exec('echo "" > /root/wabot/update.log', async (err) => {
        if (err) {
            console.error("❌ Failed to clean logs via Cron");
        } else {
            console.log("🧹 Logs cleaned successfully via Cron");
            
            await sock.sendMessage(ownerNumber, { 
                text: "🧹 *SYSTEM NOTICE*\n\nWeekly maintenance complete.\nUpdate logs have been cleared successfully."
            });
        }
    });
}

export const initCron = (sock) => {
    console.log("⏰ Cron Jobs Initialized");
    
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

    cron.schedule("0 0 * * 1", async () => {
        console.log("🔄 Running Weekly Log Cleaner...");
        await clearUpdateLog(sock);
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
};