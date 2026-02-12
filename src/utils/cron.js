import cron from "node-cron";
import axios from "axios";
import { exec } from "child_process";
import "dotenv/config";

let tasks = [];

async function sendDailyQuote(sock, targetNumber) {
  try {
    if (!targetNumber.endsWith("@s.whatsapp.net")) {
      targetNumber += "@s.whatsapp.net";
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
    console.error(
      `❌ Failed to send quote to ${targetNumber}:`,
      error?.message,
    );
  }
}

async function clearUpdateLog(sock) {
  const ownerNumber = process.env.OWNER_NUMBER + "@s.whatsapp.net";
  exec('echo "" > /root/wabot/update.log', async (err) => {
    if (!err) {
      console.log("🧹 Logs cleaned successfully");
      await sock.sendMessage(ownerNumber, { text: "🧹 Weekly logs cleared." });
    }
  });
}

async function sendSpecialPartnerMessage(sock) {
  const partnerNumber = process.env.PARTNER_NUMBER + "@s.whatsapp.net";
  const ownerNumber = process.env.OWNER_NUMBER + "@s.whatsapp.net";

  const message = `╭──〔 🥂 HAPPY 25th BIRTHDAY 〕──
┊
┊ 🌹 *To My Beautiful Berliana,*
┊
┊ A quarter of a century has passed,
┊ and yet, you only get more stunning
┊ with every sunrise. 25 isn't just
┊ a number; it is the blooming of
┊ your most beautiful chapter yet.
┊
┊ They say this is the age where
┊ youth meets wisdom. But for me,
┊ you are simply the definition of
┊ perfection. Thank you for being
┊ the calm in my chaos and the
┊ melody in my silence.
┊
┊ May this Silver Jubilee bring you
┊ closer to everything you dream of.
┊ I promise to be the one cheering
┊ the loudest by your side.
┊
┊ *You are my today and all of my*
┊ *tomorrows.* I love you.
┊
┊ ══════════════════
┊ ✨ *WRITE YOUR WISH AT 25*
┊ 🌐 Link: https://berlsday.alwan-projects.me
┊
┊ Use this key to grant your wish:
┊ 🗝️ *160226211226*
╰──────────────────────`;

  try {
    await sock.sendMessage(ownerNumber, { text: message });
    console.log("💖 Special romantic 25th birthday message sent.");
  } catch (error) {
    console.error("❌ Failed to send special message:", error);
  }
}

export const initCron = (sock) => {
  if (tasks.length > 0) {
    console.log("♻️ Stopping old cron jobs to prevent duplication...");
    tasks.forEach((task) => task.stop());
    tasks = [];
  }

  console.log("⏰ Initializing New Cron Jobs...");

  const task1 = cron.schedule(
    "2 6 * * *",
    async () => {
      const targets = [
        process.env.OWNER_NUMBER,
        process.env.PARTNER_NUMBER,
      ].filter(Boolean);

      console.log("🔄 Running Daily Quote Job...");
      for (const number of targets) {
        await sendDailyQuote(sock, number);
        await new Promise((r) => setTimeout(r, 5000));
      }
    },
    { scheduled: true, timezone: "Asia/Jakarta" },
  );

  const task2 = cron.schedule(
    "30 0 * * 1",
    async () => {
      console.log("🔄 Running Weekly Log Cleaner...");
      await clearUpdateLog(sock);
    },
    { scheduled: true, timezone: "Asia/Jakarta" },
  );

  const task3 = cron.schedule(
    "10 23 12 2 *",
    async () => {
      const now = new Date();
      const currentYear = now.getFullYear();

      if (currentYear === 2026) {
        console.log("💖 Running Special 2026 Message...");
        await sendSpecialPartnerMessage(sock);
      } else {
        console.log(`⚠️ Skip special message. Current year: ${currentYear}`);
      }
    },
    { scheduled: true, timezone: "Asia/Jakarta" },
  );

  tasks.push(task1, task2, task3);
};
