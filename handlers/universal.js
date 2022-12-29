const utils = require('../utils/utils.js');

const config = require('../config.json');

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

    const parsedPayload = JSON.parse(payload_json.value);

    const { content } = parsedPayload;

    const image = file ? await utils.fileToBase64(file) : null;

    const simpleRegex = /has levelled|their collection|being followed|slayer task|completed a quest|personal best in a speedrun|has defeated/;

    if (simpleRegex.test(content)) {
        const splitMessage = content.split(' ');
        const runescapeUser = splitMessage.shift();
    
        const message = `${splitMessage.join(' ')}!`;

        await utils.handleUniversalMessage(runescapeUser, twitchUser, message, image);
    }

    if (parsedPayload.type) {
        const { content, type, extra, playerName } = parsedPayload;

        switch (type) {
        case 'LOOT': {
            const lootItems = [];
            const filteredLoot = extra.items.filter(i => i.priceEach >= config.DinkConfig.LootMinValue);

            if (filteredLoot.length === 0) {
                request.log.info('No loot items after filtering');
                break;
            }

            for (const item of filteredLoot) {
                lootItems.push(`${item.quantity}x ${item.name} (${utils.formatCurrency(item.priceEach)})`);
            }

            const message = `has looted: ${lootItems.join(', ')}`;
            await utils.handleUniversalMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'CLUE': {
            const message = `has completed a ${extra.clueType} clue, making that ${extra.numberCompleted} in total!`;
            await utils.handleUniversalMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'DEATH': {
            let message;
            if (extra.isPvp === true) {
                message = 'has died!';
            } else {
                message = `has been PKed by ${extra.pker} and lost ${extra.valueLost === 0 ? 'nothing!' : `${extra.valueLost}gp!`}`;
            }
            await utils.handleUniversalMessage(playerName, twitchUser, message, image, true);
            break;
        }
        case 'ACHIEVEMENT_DIARY':
        case 'COMBAT_ACHIEVEMENT':
            await utils.handleUniversalMessage(playerName, twitchUser, content, image);
            break;
        }
    }

    return reply.send('OK');
};
