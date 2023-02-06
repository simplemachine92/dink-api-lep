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

    request.log.info(`[DINK] - Incoming payload: -> ${payload_json.value}`);

    const twitchUser = request.query.twitch_username ?? null;

    const parsedPayload = JSON.parse(payload_json.value);

    if (!parsedPayload.type) {
        return reply.status(400).send('Missing type in payload!');
    }

    const image = file ? await utils.fileToBase64(file) : null;

    const { type, extra, playerName } = parsedPayload;

    switch (type) {
        case 'QUEST': {
            const message = `has completed a quest: ${extra.questName}!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'CLUE': {
            const message = `has completed a ${extra.clueType} clue, making that ${extra.numberCompleted} in total!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'COLLECTION': {
            const message = `has added ${extra.itemName} to their collection!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'PET': {
            const message = 'has obtained a pet!';
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'SPEEDRUN': {
            const message = 'has made a new personal best!';
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'KILL_COUNT': {
            const message = extra.isPersonalBest === true
                ? `has defeated ${extra.boss} with a new personal best time of ${utils.parseDuration(extra.time)} and total completion count of ${extra.count}!`
                : `has defeated ${extra.boss} with a total completion count of ${extra.count}!`;
            
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'ACHIEVEMENT_DIARY': {
            const diaryDifficulty = utils.formatStringCase(extra.difficulty);
            const message = `has completed the ${diaryDifficulty} ${extra.area} Achievement Diary, for a total of ${extra.total} diaries completed!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'COMBAT_ACHIEVEMENT': {
            const achievementTier = utils.formatStringCase(extra.tier);
            const message = `has completed the ${achievementTier} combat task: ${extra.task}!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'SLAYER': {
            const message = `has completed a slayer task: ${extra.slayerTask}, getting ${extra.slayerPoints} points and making that ${extra.slayerCompleted} tasks completed!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'LEVEL': {
            const formattedLevelList = Object.entries(extra.levelledSkills)
                .map(i => `${i[0]} to ${i[1]}`)
                .join(', ')
                .replace(/,([^,]+$)/, ', and$1');
            const message = `has levelled up ${formattedLevelList}!`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'LOOT': {
            const lootItems = [];
            const filteredLoot = extra.items.filter(i => i.priceEach >= config.DinkConfig.LootMinValue);

            if (filteredLoot.length === 0) {
                break;
            }

            for (const item of filteredLoot) {
                lootItems.push(`${item.quantity}x ${item.name} (${utils.formatCurrency(item.priceEach * item.quantity)})`);
            }

            const message = `has looted: ${lootItems.join(', ')}`;
            await utils.handleDinkMessage(playerName, twitchUser, message, image);
            break;
        }
        case 'DEATH': {
            let message;
            if (extra.isPvp === true) {
                message = `has been PKed by ${extra.pker} and lost ${extra.valueLost === 0 ? 'nothing!' : `${extra.valueLost}gp!`}`;
            } else {
                message = 'has died!';
            }
            await utils.handleDinkMessage(playerName, twitchUser, message, image, true);
            break;
        }
    }

    return reply.send('OK');
};
