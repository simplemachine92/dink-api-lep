const utils = require('../utils/utils.js');

module.exports = async (request, reply) => {
    if (!request.headers['user-agent'].startsWith('RuneLite/')) {
        return reply.status(403).send('Invalid useragent');
    }
    
    if (!request.body) {
        return reply.status(400).send('Empty POST body');
    }

    if (!request.body.payload_json?.value) {
        return reply.status(400).send('Invalid data in payload');
    }

    const { payload_json, file } = request.body;

    request.log.info(`[UNIVERSAL] - Incoming payload: -> ${payload_json.value}`);

    const twitchUser = request.query.twitch_username ?? null;

    const { content } = JSON.parse(payload_json.value);
    const image = file ? await utils.fileToBase64(file) : null;

    const simpleRegex = /has levelled|their collection|being followed|has died|slayer task|completed a quest|personal best in a speedrun/;

    if (simpleRegex.test(content)) {
        const splitMessage = content.split(' ');
        const runescapeUser = splitMessage.shift();
    
        const message = `${splitMessage.join(' ')}!`;

        if (content.includes('has died')) {
            await utils.handleUniversalMessage(runescapeUser, twitchUser, message, image, true);
        } else {
            await utils.handleUniversalMessage(runescapeUser, twitchUser, message, image);
        }
    }

    if (content.includes('clue')) {
        const clueMessage = content.split('\n')[0].split(' ');
        
        const runescapeUser = clueMessage.shift();
        await utils.handleUniversalMessage(runescapeUser, twitchUser, clueMessage.join(' '), image);
    }

    return reply.send('OK');
};
