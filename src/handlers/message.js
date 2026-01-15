import { getSystemInfo } from "../utils/sysinfo.js";
import { exec } from "child_process";
import axios from "axios";
import config from "../config.js";
import { getHuaweiSMS } from "../utils/huawei.js";

export default async (sock, m, chatUpdate) => {
  try {
    const msgType = Object.keys(m.message)[0];
    const body =
      msgType === "conversation"
        ? m.message.conversation
        : msgType === "extendedTextMessage"
        ? m.message.extendedTextMessage.text
        : msgType === "imageMessage"
        ? m.message.imageMessage.caption
        : "";

    if (!body) return;

    const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : ".";
    const isCmd = body.startsWith(prefix);
    const command = isCmd
      ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase()
      : "";
    const args = body.trim().split(/ +/).slice(1);
    const remoteJid = m.key.remoteJid;

    if (isCmd) console.log(`[CMD] ${command} from ${remoteJid}`);

    const react = async (emoji) => {
      await sock.sendMessage(remoteJid, {
        react: { text: emoji, key: m.key },
      });
    };

    switch (command) {
      case "menu":
        await react("⏳");
        const menuMsg = `╭──〔 🤖 BOT DASHBOARD 〕──
┊
┊ 🤖 *INTELLIGENCE*
┊ • ${prefix}ai <question>
┊
┊ 📡 *NETWORK*
┊ • ${prefix}speedtest
┊ • ${prefix}myip
┊ • ${prefix}restartadg
┊ • ${prefix}restartcf
┊ • ${prefix}restartoc
┊
┊ 📱 *SYSTEM*
┊ • ${prefix}info
┊ • ${prefix}ping
┊ • ${prefix}sms
┊ • ${prefix}bandwidth
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

      case "ai":
      case "ask":
      case "gemini":
        if (!args.length)
          return await sock.sendMessage(
            remoteJid,
            { text: "❌ Please ask something! Ex: .ai How to cook rice?" },
            { quoted: m }
          );
        await react("🧠");

        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            await sock.sendMessage(
              remoteJid,
              { text: "❌ Gemini API Key missing in .env" },
              { quoted: m }
            );
            return await react("❌");
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

          const response = await axios.post(
            url,
            {
              contents: [{ parts: [{ text: args.join(" ") }] }],
            },
            {
              headers: { "Content-Type": "application/json" },
            }
          );

          const answer = response.data.candidates[0].content.parts[0].text;

          const aiMsg = `╭──〔 🤖 GEMINI 2.0 〕──
┊
${answer.trim()}
┊
╰──────────────────────`;

          await sock.sendMessage(remoteJid, { text: aiMsg }, { quoted: m });
          await react("✅");
        } catch (e) {
          console.error(
            "Gemini Error:",
            e.response ? e.response.data : e.message
          );

          let errMsg = "❌ AI is currently unavailable.";

          if (e.response) {
            if (e.response.status === 404) {
              errMsg = "❌ Model not found (Check URL/Model Name).";
            } else if (e.response.status === 400) {
              errMsg = "❌ Bad Request (Invalid API Key?).";
            } else if (e.response.status === 429) {
              errMsg = "⏳ Rate limit exceeded. Please try again later.";
            }
          }

          await sock.sendMessage(remoteJid, { text: errMsg }, { quoted: m });
          await react("❌");
        }
        break;

      case "short":
      case "shortlink":
        if (!args[0])
          return await sock.sendMessage(
            remoteJid,
            { text: "❌ Send a link! Ex: .short https://google.com" },
            { quoted: m }
          );
        await react("⏳");

        try {
          const url = `https://tinyurl.com/api-create.php?url=${args[0]}`;
          const res = await axios.get(url);

          await sock.sendMessage(
            remoteJid,
            { text: `🔗 *Shortlink Created:*\n${res.data}` },
            { quoted: m }
          );
          await react("✅");
        } catch (e) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Failed to shorten URL." },
            { quoted: m }
          );
          await react("❌");
        }
        break;

      case "ping":
        await react("⏳");
        await sock.sendMessage(
          remoteJid,
          {
            text: `╭──〔 🏓 PONG! 〕──\n┊ \n┊ Bot Online & Ready!\n┊ Speed: Fast ⚡\n┊\n╰──────────────────────`,
          },
          { quoted: m }
        );
        await react("✅");
        break;

      // case "info":
      //   await react("⏳");
      //   const stats = getSystemInfo();
      //   exec(
      //     "cat /sys/class/thermal/thermal_zone0/temp",
      //     async (err, stdout) => {
      //       let temp = "N/A";
      //       if (!err) temp = (parseInt(stdout) / 1000).toFixed(1) + "°C";
      //       const infoMsg = `╭──〔 📊 STB STATUS 〕──\n┊\n┊ 🖥️ Platform : ${stats.platform} (${stats.arch})\n┊ 🌡️ Temp     : ${temp}\n┊ 🧠 RAM Used : ${stats.ramUsed}\n┊ 🆓 RAM Free : ${stats.ramFree}\n┊ ⏱️ Uptime   : ${stats.uptime}\n┊\n╰──────────────────────`;
      //       await sock.sendMessage(remoteJid, { text: infoMsg }, { quoted: m });
      //       await react("✅");
      //     }
      //   );
      //   break;

      case "info":
        await react("⏳");
        const stats = getSystemInfo();
        exec(
          "cat /sys/class/thermal/thermal_zone0/temp",
          async (err, stdout) => {
            let temp = "N/A";
            if (!err) temp = (parseInt(stdout) / 1000).toFixed(1) + "°C";
            const infoMsg = `╭──〔 📊 STB ARMBIAN STATUS 〕──\n┊\n┊ 🖥️ Platform : ${stats.platform} (${stats.arch})\n┊ 🌡️ Temp     : ${temp}\n┊ 🧠 RAM Used : ${stats.ramUsed}\n┊ 🆓 RAM Free : ${stats.ramFree}\n┊ ⏱️ Uptime   : ${stats.uptime}\n┊\n╰──────────────────────`;
            await sock.sendMessage(remoteJid, { text: infoMsg }, { quoted: m });
            await react("✅");
          }
        );
        break;

      case "weather":
      case "w":
        if (!args.length)
          return await sock.sendMessage(
            remoteJid,
            { text: "❌ Input city name!" },
            { quoted: m }
          );
        await react("⏳");
        try {
          const apiKey = process.env.OPENWEATHER_API_KEY;
          if (!apiKey) return await react("❌");
          const { data } = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${args.join(
              " "
            )}&appid=${apiKey}&units=metric&lang=en`
          );
          const cuacaMsg = `╭──〔 🌦️ WEATHER REPORT 〕──\n┊\n┊ 🏙️ City      : ${data.name}, ${data.sys.country}\n┊ 🌡️ Temp      : ${data.main.temp}°C\n┊ ☁️ Condition : ${data.weather[0].description}\n┊ 💧 Humidity  : ${data.main.humidity}%\n┊ 💨 Wind      : ${data.wind.speed} m/s\n┊\n╰──────────────────────`;
          await sock.sendMessage(remoteJid, { text: cuacaMsg }, { quoted: m });
          await react("✅");
        } catch (e) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ City not found." },
            { quoted: m }
          );
          await react("❌");
        }
        break;

      case "speedtest":
      case "speed":
        await react("⏳");
        await sock.sendMessage(
          remoteJid,
          { text: "🚀 *Speedtest running...*\n⏳ Please wait ±30s." },
          { quoted: m }
        );
        exec(
          "speedtest --accept-license --accept-gdpr",
          async (error, stdout, stderr) => {
            if (error) {
              await sock.sendMessage(
                remoteJid,
                { text: "❌ Speedtest failed." },
                { quoted: m }
              );
              return await react("❌");
            }
            await sock.sendMessage(
              remoteJid,
              {
                text: `╭──〔 🚀 SPEEDTEST RESULT 〕──\n┊\n${stdout.trim()}\n┊\n╰──────────────────────`,
              },
              { quoted: m }
            );
            await react("✅");
          }
        );
        break;

      case "myip":
        await react("⏳");
        try {
          const { data } = await axios.get("https://ipinfo.io/json");
          await sock.sendMessage(
            remoteJid,
            {
              text: `╭──〔 🌍 PUBLIC IP INFO 〕──\n┊\n┊ 📍 IP       : ${data.ip}\n┊ 🏢 ISP      : ${data.org}\n┊ 🏙️ Location : ${data.city}, ${data.country}\n┊\n╰──────────────────────`,
            },
            { quoted: m }
          );
          await react("✅");
        } catch (e) {
          await react("❌");
        }
        break;

      case "restartadg":
        if (
          !remoteJid.includes(config.ownerNumber.replace("@s.whatsapp.net", ""))
        )
          return await react("❌");
        await react("⏳");
        await sock.sendMessage(
          remoteJid,
          { text: "♻️ Restarting AdGuard Home..." },
          { quoted: m }
        );
        exec("systemctl restart AdGuardHome", async (err) => {
          if (err)
            return await sock.sendMessage(
              remoteJid,
              { text: "❌ Failed." },
              { quoted: m }
            );
          await sock.sendMessage(
            remoteJid,
            { text: "✅ AdGuard Home Restarted!" },
            { quoted: m }
          );
          await react("✅");
        });
        break;

      case "restartcf":
        if (
          !remoteJid.includes(config.ownerNumber.replace("@s.whatsapp.net", ""))
        )
          return await react("❌");
        await react("⏳");
        await sock.sendMessage(
          remoteJid,
          { text: "♻️ Restarting Cloudflare Tunnel..." },
          { quoted: m }
        );
        exec("systemctl restart cloudflared", async (err) => {
          if (err)
            return await sock.sendMessage(
              remoteJid,
              { text: "❌ Failed." },
              { quoted: m }
            );
          await sock.sendMessage(
            remoteJid,
            { text: "✅ Cloudflare Tunnel Restarted!" },
            { quoted: m }
          );
          await react("✅");
        });
        break;

      case "restartoc":
        if (
          !remoteJid.includes(config.ownerNumber.replace("@s.whatsapp.net", ""))
        ) {
          await react("❌");
          return await sock.sendMessage(
            remoteJid,
            { text: "⛔ Access Denied!" },
            { quoted: m }
          );
        }
        await react("⏳");
        await sock.sendMessage(
          remoteJid,
          { text: "♻️ Restarting OpenClash..." },
          { quoted: m }
        );
        exec("/etc/init.d/openclash restart", async (err) => {
          if (err) {
            await react("❌");
            return await sock.sendMessage(
              remoteJid,
              { text: "❌ Failed." },
              { quoted: m }
            );
          }
          await sock.sendMessage(
            remoteJid,
            {
              text: `╭──〔 ✅ SUCCESS 〕──\n┊\n┊ OpenClash restarted!\n┊\n╰──────────────────────`,
            },
            { quoted: m }
          );
          await react("✅");
        });
        break;

      case "tiktok":
      case "tt":
        if (!args[0])
          return await sock.sendMessage(
            remoteJid,
            { text: "❌ Link required!" },
            { quoted: m }
          );
        await react("⏳");
        try {
          const { data } = await axios.get(
            `https://www.tikwm.com/api/?url=${args[0]}`
          );
          if (!data.data) {
            await react("❌");
            return await sock.sendMessage(
              remoteJid,
              { text: "❌ Not found." },
              { quoted: m }
            );
          }
          const v = data.data;
          await sock.sendMessage(
            remoteJid,
            {
              video: { url: v.play },
              caption: `╭──〔 🎵 TIKTOK 〕──\n┊ 📝 ${v.title}\n┊ 👤 ${v.author.nickname}\n╰────────────────`,
            },
            { quoted: m }
          );
          await react("✅");
        } catch (e) {
          await react("❌");
        }
        break;

      case "sms":
      case "inbox":
        if (
          !remoteJid.includes(config.ownerNumber.replace("@s.whatsapp.net", ""))
        ) {
          return await react("❌");
        }

        await react("📩");
        await sock.sendMessage(
          remoteJid,
          { text: "⏳ Fetching SMS from Huawei HiLink..." },
          { quoted: m }
        );

        try {
          const messages = await getHuaweiSMS();

          if (!Array.isArray(messages) || messages.length === 0) {
            const emptyMsg = `╭──〔 📩 MODEM INBOX 〕──
┊
┊ 📭 Inbox Kosong / Belum Login
┊
╰──────────────────────`;
            await sock.sendMessage(
              remoteJid,
              { text: emptyMsg },
              { quoted: m }
            );
            return await react("✅");
          }

          const safe = (obj, ...keys) => {
            for (const k of keys) {
              if (obj == null) continue;
              if (
                Object.prototype.hasOwnProperty.call(obj, k) &&
                obj[k] != null
              )
                return String(obj[k]);
            }
            return "";
          };

          const shorten = (text, max = 800) => {
            if (!text) return "";
            text = String(text).trim();
            if (text.length <= max) return text;
            return text.slice(0, max) + "...";
          };

          const sorted = [...messages].sort((a, b) => {
            const da = new Date(safe(a, "Date", "date"));
            const db = new Date(safe(b, "Date", "date"));
            return db - da;
          });

          const recent5 = sorted.slice(0, 5);

          let smsList = "";
          recent5.forEach((sms, i) => {
            const date =
              safe(sms, "Date", "date", "dateTime", "datetime") ||
              "Unknown date";
            const sender =
              safe(sms, "Phone", "phone", "Sender", "sender") || "Unknown";
            const content =
              safe(sms, "Content", "content", "Message", "message") || "";

            const senderClean = sender.trim();
            const dateClean = date.trim();
            const contentClean = shorten(
              content.replace(/\r\n/g, "\n").replace(/\s+$/g, "")
            );

            smsList += `📨 *${senderClean}* (${dateClean})\n${contentClean}\n\n`;
          });

          const replyMsg = `╭──〔 📩 INBOX (showing 5 of ${
            messages.length
          }) 〕──
┊
${smsList.trim()}
┊
╰──────────────────────`;

          await sock.sendMessage(remoteJid, { text: replyMsg }, { quoted: m });
          await react("✅");
        } catch (e) {
          console.error("SMS Handler Error:", e && e.message ? e.message : e);
          await sock.sendMessage(
            remoteJid,
            {
              text: `❌ Error: ${e && e.message ? e.message : "Unknown error"}`,
            },
            { quoted: m }
          );
          await react("❌");
        }
        break;

      //       case "bandwidth":
      //       case "usage":
      //       case "bw":
      //         await react("📊");

      //         const iface = "br-lan";

      //         await sock.sendMessage(
      //           remoteJid,
      //           { text: "⏳ Mengambil data trafik (br-lan)..." },
      //           { quoted: m }
      //         );

      //         const cmd = `vnstat -i ${iface}; echo "--------------------------------------------------"; vnstat -i ${iface} -w || true`;

      //         exec(cmd, (err, stdout, stderr) => {
      //           if (stdout && stdout.trim().length > 0) {
      //             const output = stdout.trim();

      //             const msg = `╭──〔 📊 TRAFFIC LAN/WIFI 〕──
      // ┊
      // ┊ *Interface:* BR-LAN (Total Client)
      // ┊
      // \`\`\`${output}\`\`\`
      // ┊
      // ╰──────────────────────`;

      //             sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
      //             react("✅");
      //           } else {
      //             // Kalau benar-benar kosong barulah kita bilang error
      //             const errMsg = `❌ *Gagal mengambil data br-lan*\n\nError:\n\`\`\`${
      //               stderr || err?.message || "Unknown Error"
      //             }\`\`\``;
      //             sock.sendMessage(remoteJid, { text: errMsg }, { quoted: m });
      //             react("❌");
      //           }
      //         });
      //         break;

      case "bandwidth":
      case "usage":
      case "bw":
        await react("📊");
        const ifaceCmd = "ip route | grep default | awk '{print $5}'";

        exec(ifaceCmd, (err, ifaceName) => {
          const iface = ifaceName.trim() || "eth0";
          sock.sendMessage(
            remoteJid,
            { text: `⏳ Mengambil data trafik (${iface})...` },
            { quoted: m }
          );

          const cmd = `vnstat -i ${iface}; echo "--- Weekly ---"; vnstat -i ${iface} -w`;
          exec(cmd, (err, stdout) => {
            if (stdout) {
              const msg = `╭──〔 📊 TRAFFIC INFO 〕──\n┊\n┊ *Interface:* ${iface}\n\`\`\`${stdout.trim()}\`\`\`\n┊\n╰──────────────────────`;
              sock.sendMessage(remoteJid, { text: msg }, { quoted: m });
              react("✅");
            } else {
              sock.sendMessage(
                remoteJid,
                {
                  text: "❌ Vnstat belum terinstall atau interface tidak ditemukan.",
                },
                { quoted: m }
              );
              react("❌");
            }
          });
        });
        break;
    }
  } catch (err) {
    console.error("Handler Error:", err && err.message ? err.message : err);
  }
};
