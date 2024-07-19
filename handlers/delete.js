const config = require('../config.json');
const fs = require('node:fs');

module.exports = async (request, reply) => {
    if (!config.Options.DeleteWhitelist.includes(request.ip)) {
        return reply.status(403).send('Invalid IP Address');
    }

    // eslint-disable-next-line no-unused-vars
    const twitchUser = request.query.twitch_username;
    const fileName = request.query.fileName;

    const filePath = `/mnt/disk/share/runelite/${fileName}.png`;

    if (!fs.existsSync(filePath)) {
        return reply.status(400).send('Invalid Image');
    }

    await fs.promises.unlink(filePath);

    return reply.send('OK');
};
