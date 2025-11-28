const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache'); 
const path = require('path');
const qrcode = require('qrcode-terminal'); // <--- 1. WAJIB IMPORT INI

const config = require('./src/config');
const messageHandler = require('./src/handlers/message');

const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, 'src/sessions'));
    
    const sock = makeWASocket({
        logger: pino({ level: 'fatal' }), 
        
        // 2. MATIKAN INI (Sudah deprecated)
        printQRInTerminal: false, 

        browser: Browsers.ubuntu("Chrome"),

        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },

        markOnlineOnConnect: false,
        cachedGroupMetadata: async (jid) => groupCache.get(jid),

        getMessage: async (key) => {
            return {
                conversation: 'Hello'
            }
        },

        syncFullHistory: false 
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // 3. RENDER QR CODE DISINI
        if (qr) {
            console.log('\nScan QR Code dibawah ini:');
            // small: true agar QR code-nya kecil dan rapi di terminal
            qrcode.generate(qr, { small: true }); 
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('Sesi habis/Logout. Hapus folder session dan scan ulang.');
            }
        } else if (connection === 'open') {
            console.log('✅ Bot Terhubung ke WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('groups.update', async (groups) => {
        for (const group of groups) {
            groupCache.set(group.id, group);
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (chatUpdate.type !== 'notify') return;
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            if (m.key.fromMe) return; 

            await messageHandler(sock, m, chatUpdate);
        } catch (err) {
            console.log('Error handling msg:', err);
        }
    });
}

startBot();