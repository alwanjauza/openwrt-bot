import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import NodeCache from "node-cache";
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import qrcode from "qrcode-terminal";
import { initCron } from "./src/utils/cron.js";
import config from "./src/config.js";
import messageHandler from "./src/handlers/message.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const API_SECRET = process.env.API_SECRET || "123";

// app.use(bodyParser.json());
app.use(
  express.json({
    limit: "256kb",
  }),
);

// const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const groupCache = new NodeCache({
  stdTTL: 120,
  checkperiod: 300,
  useClones: false,
});

let globalSock;

app.post("/api/send-message", async (req, res) => {
  const { number, message, secret } = req.body;

  if (secret !== API_SECRET) {
    return res.status(403).json({ status: false, error: "Forbidden" });
  }

  if (!number || !message) {
    return res.status(400).json({ status: false, error: "Missing parameters" });
  }

  if (!globalSock) {
    return res.status(503).json({ status: false, error: "Bot not connected" });
  }

  try {
    let jid = number;
    if (!jid.includes("@s.whatsapp.net")) {
      jid =
        jid.replace(/^08/, "628").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    }

    await globalSock.sendMessage(jid, { text: message });
    return res.json({ status: true, message: "Success", target: jid });
  } catch (error) {
    return res.status(500).json({ status: false, error: error.message });
  }
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.resolve(__dirname, "src/sessions"),
  );

  const sock = makeWASocket({
    logger: pino({ level: "fatal" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    markOnlineOnConnect: false,
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    getMessage: async (key) => {
      return { conversation: "Hello" };
    },
    syncFullHistory: false,
    shouldIgnoreJid: (jid) => jid.endsWith("@newsletter"),
    connectTimeoutMs: 30_000,
  });

  globalSock = sock;

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nScan QR Code dibawah ini:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Koneksi terputus. Reconnecting...", shouldReconnect);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log("Sesi habis/Logout. Hapus folder session dan scan ulang.");
      }
    } else if (connection === "open") {
      console.log("✅ Bot Terhubung ke WhatsApp!");
      initCron(sock);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("groups.update", async (groups) => {
    for (const group of groups) {
      groupCache.set(group.id, group);
    }
  });

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      if (chatUpdate.type !== "notify") return;
      const m = chatUpdate.messages[0];
      if (!m.message) return;
      if (m.key.fromMe) return;

      await messageHandler(sock, m, chatUpdate);
    } catch (err) {
      console.log("Error handling msg:", err);
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  startBot();
});
