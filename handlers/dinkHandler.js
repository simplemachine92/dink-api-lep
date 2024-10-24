const utils = require('../utils/utils.js');

const config = require('../config.json');

const allowedUseragents = ['RuneLite/', 'HDOS/'];

function isValidUserAgent (userAgent) {
    for (const allowedUseragent of allowedUseragents) {
        if (userAgent.startsWith(allowedUseragent)) {
            return true;
        }
    }
    return false;
}

module.exports = async (request, reply) => {
    if (!isValidUserAgent(request.headers['user-agent'])) {
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

    const skipImage = request.query?.skipImage === 'true';

    const skipDefaultChannel = request.query?.skipDefaultChannel === 'true';

    const parsedPayload = JSON.parse(payload_json.value);

    if (!parsedPayload.type) {
        return reply.status(400).send('Missing type in payload!');
    }

    const image = file ? await file.toBuffer() : null;

    const { type, extra, playerName, seasonalWorld } = parsedPayload;

    let dinkMessage = null;
    
    switch (type) {
        case 'QUEST': {
            dinkMessage = `has completed a quest: ${extra.questName}!`;
            break;
        }
        case 'CLUE': {
            const clueType = utils.formatStringCase(extra.clueType);
            dinkMessage = `has completed a ${clueType} clue, making that ${extra.numberCompleted} in total!`;
            break;
        }
        case 'COLLECTION': {
            const logEntries = extra.completedEntries ? `(${extra.completedEntries}/${extra.totalEntries})` : '';
            dinkMessage = `has added ${extra.itemName} to their collection! ${logEntries}`;
            break;
        }
        case 'PET': {
            const petKind = (extra.duplicate || extra.previouslyOwned) ? 'duplicate' : 'new';
            if (extra.petName) {
                const milestone = extra.milestone ? ` at ${extra.milestone}` : '';
                dinkMessage = `has obtained a ${petKind} pet${milestone}: ${extra.petName}!`;
            } else {
                dinkMessage = `has obtained a ${petKind} pet!`;
            }
            break;
        }
        case 'SPEEDRUN': {
            dinkMessage = extra?.isPersonalBest === true
                ? `has completed a speedrun of ${extra.questName} with a new personal best of ${utils.parseDuration(extra.personalBest)}!`
                : `has completed a speedrun of ${extra.questName} in ${utils.parseDuration(extra.currentTime)}!`;
            break;
        }
        case 'KILL_COUNT': {
            dinkMessage = extra.isPersonalBest === true
                ? `has defeated ${extra.boss} with a new personal best time of ${utils.parseDuration(extra.time)} and a total completion count of ${extra.count}!`
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
            if (extra.justCompletedTier) {
                const completedTier = utils.formatStringCase(extra.justCompletedTier);
                dinkMessage = `has unlocked the ${completedTier} tier of rewards by completing the task: ${extra.task} with ${extra.taskPoints} points!`;
            } else {
                dinkMessage = `has completed the ${achievementTier} combat task: ${extra.task}, getting ${extra.taskPoints} points!`;
            }
            break;
        }
        case 'SLAYER': {
            dinkMessage = `has completed a slayer task: ${extra.slayerTask}, getting ${extra.slayerPoints} points and making that ${extra.slayerCompleted} tasks completed!`;
            break;
        }
        case 'LEVEL': {
            const levelled = extra.levelledSkills;
            const allSkillLevels = Object.values(extra.allSkills);
            const totalLevel = allSkillLevels.reduce((a, b) => a + b, 0);
            const isMaxed = allSkillLevels.every(level => level === 99);

            if (extra.combatLevel && extra.combatLevel.increased) {
                levelled.Combat = extra.combatLevel.value;
            }
            const formattedLevelList = Object.entries(levelled)
                .map(i => `${i[0]} to ${i[1]}`)
                .join(', ')
                .replace(/,([^,]+$)/, ', and$1');
 
            dinkMessage = `has levelled up ${formattedLevelList}`;

            if (totalLevel % 100 === 0) {
                dinkMessage = `${dinkMessage} and has reached total level of ${totalLevel}!`;
            } else if (isMaxed) {
                dinkMessage = `${dinkMessage} and has maxed their account!`;
            } else {
                dinkMessage = `${dinkMessage}!`;
            }

            break;
        }
        case 'BARBARIAN_ASSAULT_GAMBLE': {
            const lootItems = [];
            const filteredLoot = extra.items.filter(i => i.priceEach * i.quantity >= config.DinkConfig.LootMinValue);

            if (filteredLoot.length > 0) {
                for (const item of filteredLoot) {
                    lootItems.push(`${item.quantity}x ${item.name} (${utils.formatCurrency(item.priceEach * item.quantity)})`);
                }
            }

            dinkMessage = `has reached ${extra.gambleCount} Barbarian Assault high gambles! ${lootItems.length === 0 ? '' : lootItems.join(', ')}`;
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
        case 'PLAYER_KILL': {
            const victimValue = Object.values(extra.victimEquipment).reduce((a, b) => a + b);

            if (victimValue < config.DinkConfig.LootMinValue) {
                break;
            }

            dinkMessage = `has PKed ${extra.victimName} (level ${extra.victimCombatLevel})!`;
            break;
        }
        case 'DEATH': {
            // eslint-disable-next-line unicorn/prefer-ternary
            if (extra.isPvp === true) {
                dinkMessage = `has been PKed by ${extra.pker} and lost ${extra.valueLost === 0 ? 'nothing!' : `${utils.formatCurrency(extra.valueLost)}!`}`;
            } else {
                dinkMessage = 'has died!';
            }
            break;
        }
        case 'XP_MILESTONE': {
            const milestoneSkill = extra.milestoneAchieved[0];
            const milestoneXP = extra.xpData[milestoneSkill];
            const exactXP = milestoneXP - milestoneXP % 1e6;
            const xpMilestone = exactXP.toLocaleString('en-us');
            dinkMessage = `has reached a new milestone of ${xpMilestone} XP in ${milestoneSkill}!`;
            break;
        }
        case 'LEAGUES_AREA': {
            dinkMessage = `has unlocked the ${extra.area} area at ${extra.tasksCompleted} tasks completed.`;
            break;
        }
        case 'LEAGUES_RELIC': {
            dinkMessage = `has unlocked a new Tier ${extra.tier} Relic: ${extra.relic}!`;
            break;
        }
        case 'LEAGUES_TASK': {
            const taskDifficulty = utils.formatStringCase(extra.difficulty);
            if (extra.earnedTrophy) {
                dinkMessage = `has unlocked the ${extra.earnedTrophy} trophy by completing the ${taskDifficulty} task: ${extra.taskName}!`;
            } else {
                dinkMessage = `has completed a ${taskDifficulty} task: ${extra.taskName}.`;

                if (extra.tasksUntilNextArea) {
                    dinkMessage += ` They have ${extra.tasksUntilNextArea} tasks remaining until the next area unlock.`;
                } else if (extra.pointsUntilNextRelic) {
                    dinkMessage += ` They have ${extra.pointsUntilNextRelic} points remaining until their next relic.`;
                } else if (extra.pointsUntilNextTrophy) {
                    dinkMessage += ` They have ${extra.pointsUntilNextTrophy} points remaining until their next trophy.`;
                } else if (extra.totalPoints >= 56_000) {
                    dinkMessage += ' They have no reason to keep playing, and should touch grass.';
                }
            }
            break;
        }
        default: {
            request.log.info(`Unhandled Dink type: ${type}`);
        }
    }

    if (dinkMessage !== null) {
        await utils.handleDinkMessage(playerName, seasonalWorld, twitchUser, skipDefaultChannel, skipImage, dinkMessage, image, (type === 'DEATH'));
    }

    return reply.send('OK');
};
