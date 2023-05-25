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

    let dinkMessage = null;
    
    switch (type) {
        case 'QUEST': {
            dinkMessage = `has completed a quest: ${extra.questName}!`;
            break;
        }
        case 'CLUE': {
            dinkMessage = `has completed a ${extra.clueType} clue, making that ${extra.numberCompleted} in total!`;
            break;
        }
        case 'COLLECTION': {
            dinkMessage = `has added ${extra.itemName} to their collection!`;
            break;
        }
        case 'PET': {
            dinkMessage = 'has obtained a pet!';
            break;
        }
        case 'SPEEDRUN': {
            dinkMessage = 'has made a new personal best!';
            break;
        }
        case 'KILL_COUNT': {
            dinkMessage = extra.isPersonalBest === true
                ? `has defeated ${extra.boss} with a new personal best time of ${utils.parseDuration(extra.time)} and total completion count of ${extra.count}!`
                : `has defeated ${extra.boss} with a total completion count of ${extra.count}!`;
            break;
        }
        case 'ACHIEVEMENT_DIARY': {
            const diaryDifficulty = utils.formatStringCase(extra.difficulty);
            dinkMessage = `has completed the ${diaryDifficulty} ${extra.area} Achievement Diary, for a total of ${extra.total} diaries completed!`;
            break;
        }
        case 'COMBAT_ACHIEVEMENT': {
            const achievementTier = utils.formatStringCase(extra.tier);
            dinkMessage = `has completed the ${achievementTier} combat task: ${extra.task}!`;
            break;
        }
        case 'SLAYER': {
            dinkMessage = `has completed a slayer task: ${extra.slayerTask}, getting ${extra.slayerPoints} points and making that ${extra.slayerCompleted} tasks completed!`;
            break;
        }
        case 'LEVEL': {
            const levelled = extra.levelledSkills;
            if (extra.combatLevel && extra.combatLevel.increased) {
                levelled["Combat"] = extra.combatLevel.value;
            }
            const formattedLevelList = Object.entries(levelled)
                .map(i => `${i[0]} to ${i[1]}`)
                .join(', ')
                .replace(/,([^,]+$)/, ', and$1');
            dinkMessage = `has levelled up ${formattedLevelList}!`;
            break;
        }
        case 'BARBARIAN_ASSAULT_GAMBLE': {
            const lootItems = [];
            const filteredLoot = extra.items.filter(i => i.priceEach * i.quantity >= config.DinkConfig.LootMinValue);

            if (filteredLoot.length !== 0) {
                for (const item of filteredLoot) {
                    lootItems.push(`${item.quantity}x ${item.name} (${utils.formatCurrency(item.priceEach * item.quantity)})`);
                }
            }

            dinkMessage = `has reached ${extra.gambleCount} Barbarian Assault high gambles! ${lootItems.length !== 0 ? lootItems.join(', ') : ''}`;
            break;
        }
        case 'LOOT': {
            const lootItems = [];
            const filteredLoot = extra.items.filter(i => i.priceEach * i.quantity >= config.DinkConfig.LootMinValue);

            if (filteredLoot.length === 0) {
                break;
            }

            for (const item of filteredLoot) {
                lootItems.push(`${item.quantity}x ${item.name} (${utils.formatCurrency(item.priceEach * item.quantity)})`);
            }

            dinkMessage = `has looted: ${lootItems.join(', ')}`;
            break;
        }
        case 'DEATH': {
            if (extra.isPvp === true) {
                dinkMessage = `has been PKed by ${extra.pker} and lost ${extra.valueLost === 0 ? 'nothing!' : `${extra.valueLost}gp!`}`;
            } else {
                dinkMessage = 'has died!';
            }
            break;
        }
        default: {
            request.log.info(`Unhandled Dink type: ${type}`);
        }
    }

    if (dinkMessage !== null) {
        await utils.handleDinkMessage(playerName, twitchUser, dinkMessage, image, (type === 'DEATH'));
    }

    return reply.send('OK');
};
