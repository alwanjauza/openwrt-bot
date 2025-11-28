require('dotenv').config();

module.exports = {
    sessionName: 'session-auth',
    ownerNumber: (process.env.OWNER_NUMBER || '628000000000') + '@s.whatsapp.net', 
    botName: process.env.BOT_NAME || 'OpenWrt Bot',
    public: true
};