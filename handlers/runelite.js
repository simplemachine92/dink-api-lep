const utils = require('../utils/utils.js');

module.exports = async (request, reply) => {
    if (!request.headers['user-agent'].startsWith('RuneLite/')) {
        return reply.status(403).send('Invalid Useragent');
    }

    if (!request.body) {
        return reply.status(400).send('Invalid POST body');
    }

    if (!request.body.payload_json?.value) {
        return reply.status(400).send('Invalid data in payload');
    }

    const { payload_json, file } = request.body;

    const twitchUser = request.query.twitch_username ?? null;

    const { content } = JSON.parse(payload_json.value);
    const image = file ? await utils.fileToBase64(file) : null;

    request.log.info(`Incoming Runelite Message (Version ${request.headers['user-agent']}) - ${content}`);

    if (content.includes('leveled')) {
        const splitRegex = /^(.*?) leveled (.*$)/;
        // eslint-disable-next-line no-unused-vars
        const [contentString, runescapeUser, levelUps] = content.match(splitRegex);
        const levelUpString = levelUps.replace(/leveled/g, '').replace(/ +/g, ' ');
        utils.handleMessage('levelup', runescapeUser, twitchUser, levelUpString, image);
    } else if (content.includes('has just completed:')) {
        const [runescapeUser, quest] = content.split(' has just completed: ');
        utils.handleMessage('quest', runescapeUser, twitchUser, quest, image);
    } else if (content.includes('has just died!')) {
        const runescapeUser = content.split(' has just died!')[0];
        utils.handleMessage('death', runescapeUser, twitchUser, null, image);
    } else if (content.includes('clue scroll')) {
        const runescapeUser = content.split(' has just completed a clue scroll')[0];
        utils.handleMessage('clue', runescapeUser, twitchUser, null, image);
    } else if (content.includes('received a pet')) {
        const runescapeUser = content.split(' has just received a pet')[0];
        utils.handleMessage('pet', runescapeUser, twitchUser, null, image);
    } else {
        request.log.info(`Unhandled message: ${content}`);
    }

    return reply.send('OK');
};
