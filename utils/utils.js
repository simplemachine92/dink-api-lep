const Redis = require('ioredis');
const Crypto = require('crypto');
const fsp = require('fs/promises');
const tinyDuration = require('tinyduration');

const config = require('../config.json');

const RedisPub = new Redis();

const publishMessage = (msgData) => {
    RedisPub.publish('go-bot', JSON.stringify(msgData));
};

const checkTwitchName = (twitchUser, runescapeUser) => {
    if (!twitchUser || !runescapeUser) {
        return false;
    }

    const nameData = config.NameMap?.[twitchUser.toLowerCase()];

    if (!nameData) {
        return false;
    }

    return Boolean(nameData.includes(runescapeUser));
};

const sendExtraChannels = (twitchUser, message, type) => {
    const extraChannels = config.UserConfig?.[twitchUser.toLowerCase()];

    if (extraChannels === undefined) {
        return null;
    }

    for (const channel of extraChannels.Channels) {
        const customEmotes = extraChannels?.emotes?.[channel] ?? config.ChannelConfig?.[channel];
        let customMessage = `${customEmotes?.DinkEmote ?? config.Default.DinkEmote} ${message}`;

        if (type === 'death') {
            customMessage = `${customEmotes?.DeathEmote ?? config.Default.DeathEmote} ${message}`;
        }

        sendTwitchMessage(channel, customMessage);
    }
};

const writeImage = async (imageData) => {
    if (!imageData) {
        return null;
    }
    const fileName = Crypto.randomBytes(20).toString('hex').slice(-12);
    await fsp.writeFile(`${config.Options.FilePath}/${fileName}.png`, Buffer.from(imageData, 'base64'));
    return `${config.Options.FileURLPrefix}/${fileName}.png`;
};

const sendTwitchMessage = (channel, message) => {
    const msgData = {
        Platform: 'Twitch',
        Message: {
            Type: 'ChatMessage',
            Data: {
                Channel: channel,
                Message: message
            }
        }
    };
    publishMessage(msgData);
};

module.exports.fileToBase64 = async (file) => {
    const imageBuffer = await file.toBuffer();
    return imageBuffer.toString('base64');
};

module.exports.formatStringCase = (string) => {
    const str = string.toLowerCase();
    return str.charAt(0).toUpperCase() + str.slice(1);
};

module.exports.parseDuration = (duration) => {
    const parsedDuration = tinyDuration.parse(duration);
    const formattedDuration = Object.entries(parsedDuration)
        .map(i => `${i[1]}${i[0][0]}`)
        .join(', ');

    return formattedDuration;
};

module.exports.formatCurrency = (value) => {
    if (value >= 1e6) {
        return `${Math.floor(value / 1e4) / 100}M`;
    } else if (value >= 1e5) {
        return `${Math.floor(value / 1e3)}k`;
    } else {
        return `${value}gp`;
    }
};

module.exports.handleDinkMessage = async (runescapeUser, twitchUser, message, imageData, isDeath = false) => {
    const imageURL = await writeImage(imageData);

    const validTwitchUser = checkTwitchName(twitchUser, runescapeUser);
    const identicalNames = Boolean(runescapeUser?.toLowerCase() === twitchUser?.toLowerCase());

    const { Channel, DinkEmote, DeathEmote } = config.Default;

    const buildMessage = (message) => {
        if (validTwitchUser === true) {
            return `${runescapeUser} ( @${twitchUser} ) ${message} ${imageURL ?? ''}`;
        } else {
            return `${runescapeUser} ${message} ${imageURL ?? ''}`;
        }
    };

    const formattedMessage = buildMessage(message);

    sendTwitchMessage(Channel, `${isDeath === true ? DeathEmote : DinkEmote} ${formattedMessage}`);

    if (validTwitchUser === true || identicalNames === true) {
        sendExtraChannels(twitchUser, formattedMessage, isDeath);
    }
};
