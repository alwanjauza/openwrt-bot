import cron from 'node-cron';
import axios from 'axios';
import { exec } from 'child_process';
import 'dotenv/config';

let tasks = [];

async function sendDailyQuote(sock, targetNumber) {
    try {
        if (!targetNumber.endsWith('@s.whatsapp.net')) {
            targetNumber += '@s.whatsapp.net';
        }

        const res = await axios.get("https://api.api-ninjas.com/v1/quotes", {
            headers: { "X-Api-Key": process.env.NINJA_API_KEY },
        });

        const quote = res.data[0];
        const message = `╭──〔 🌄 MORNING QUOTE 〕──
┊ 💬 *${quote.quote}*
┊ ✍️ _${quote.author}_
╰──────────────────────`;

        await sock.sendMessage(targetNumber, { text: message });
        console.log(`✅ Quote sent to ${targetNumber}`);

    } catch (error) {
        console.error(`❌ Failed to send quote to ${targetNumber}:`, error?.message);
    }
}

async function clearUpdateLog(sock) {
    const ownerNumber = process.env.OWNER_NUMBER + '@s.whatsapp.net';
    exec('echo "" > /root/wabot/update.log', async (err) => {
        if (!err) {
            console.log("🧹 Logs cleaned successfully");
            await sock.sendMessage(ownerNumber, { text: "🧹 Weekly logs cleared." });
        }
    });
}

export const initCron = (sock) => {
    if (tasks.length > 0) {
        console.log("♻️ Stopping old cron jobs to prevent duplication...");
        tasks.forEach(task => task.stop());
        tasks = []; 
    }

    console.log("⏰ Initializing New Cron Jobs...");
    
    const task1 = cron.schedule("2 6 * * *", async () => {
        const targets = [
            process.env.OWNER_NUMBER,
            process.env.PARTNER_NUMBER,
        ].filter(Boolean);

        console.log("🔄 Running Daily Quote Job...");
        for (const number of targets) {
            await sendDailyQuote(sock, number);
            await new Promise(r => setTimeout(r, 5000));
        }
    }, { scheduled: true, timezone: "Asia/Jakarta" });

    const task2 = cron.schedule("0 0 * * 1", async () => {
        console.log("🔄 Running Weekly Log Cleaner...");
        await clearUpdateLog(sock);
    }, { scheduled: true, timezone: "Asia/Jakarta" });

    tasks.push(task1, task2);
};