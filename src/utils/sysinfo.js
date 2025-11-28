const os = require('os');

const formatSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

const getSystemInfo = () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = os.uptime();

    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    return {
        platform: os.platform(),
        arch: os.arch(),
        ramTotal: formatSize(totalMem),
        ramFree: formatSize(freeMem),
        ramUsed: formatSize(usedMem),
        uptime: `${h} Jam ${m} Menit ${s} Detik`
    };
};

module.exports = { getSystemInfo };