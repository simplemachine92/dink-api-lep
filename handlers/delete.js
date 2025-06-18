import Config from '../config.json' with { type: 'json' };

import { existsSync as fileExists } from 'node:fs';
import { unlink as deleteFile } from 'node:fs/promises';

module.exports = async (request, reply) => {
    if (!Config.Options.DeleteWhitelist.includes(request.ip)) {
        return reply.status(403).send('Invalid IP Address');
    }

    // eslint-disable-next-line no-unused-vars
    const twitchUser = request.query.twitch_username;
    const fileName = request.query.fileName;

    const filePath = `/mnt/disk/share/runelite/${fileName}.png`;

    if (!fileExists(filePath)) {
        return reply.status(400).send('Invalid Image');
    }

    await deleteFile(filePath);

    return reply.send('OK');
};
