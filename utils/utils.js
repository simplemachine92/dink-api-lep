const Redis = require('ioredis');
const Crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const tinyDuration = require('tinyduration');

const S3Client = require('./s3.js');
S3Client.initializeS3Client();

const config = require('../config.json');

const RedisPub = new Redis({ lazyConnect: true });

const publishMessage = (msgData) => {
    if (!config.Options.RedisEnabled) {
        return;
    }
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

const sendExtraChannels = (twitchUser, message, isDeath) => {
    const extraChannels = config.UserConfig?.[twitchUser.toLowerCase()];

    if (extraChannels === undefined) {
        return null;
    }

    for (const channel of extraChannels.Channels) {
        const customEmotes = extraChannels?.emotes?.[channel] ?? config.ChannelConfig?.[channel];
        let customMessage = `${customEmotes?.DinkEmote ?? config.Default.DinkEmote} ${message}`;

        if (isDeath === true) {
            customMessage = `${customEmotes?.DeathEmote ?? config.Default.DeathEmote} ${message}`;
        }

        sendTwitchMessage(channel, customMessage);
    }
};

const writeImage = async (imageData, skipImage) => {
    if (!imageData || skipImage === true) {
        return null;
    }

    if (config.Options.Storage === '' || config.Options.Storage !== 'file' && config.Options.Storage !== 's3') {
        console.log('No Storage backend configured or invalid backend specified. Valid backends: [file, s3]');
        return null;
    }

    if (config.Options.Storage === 'file' && config.Options.FilePath === '') {
        console.log('No filepath configured with file based storage');
        return null;
    }

    const fileName = Crypto.randomBytes(20).toString('hex').slice(-12);

    switch (config.Options.Storage) {
        case 'file': {
            await fsp.writeFile(`${config.Options.FilePath}/${fileName}.png`, imageData);
            break;
        }
        case 's3': {
            await S3Client.uploadFile(fileName, imageData);
            break;
        }
    }

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

module.exports.handleDinkMessage = async (runescapeUser, seasonalWorld, twitchUser, skipDefaultChannel, skipImage, message, imageData, isDeath = false) => {
    const imageURL = await writeImage(imageData, skipImage);

    const validTwitchUser = checkTwitchName(twitchUser, runescapeUser);
    const identicalNames = Boolean(runescapeUser?.toLowerCase() === twitchUser?.toLowerCase());

    const { DinkConfig: { SeasonalEmoji }, Default: { Channel, DinkEmote, DeathEmote } } = config;

    const buildMessage = (message) => {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (validTwitchUser === true) {
            return `${seasonalWorld === true ? SeasonalEmoji : ''} ${runescapeUser} ( @${twitchUser} ) ${message} ${imageURL ?? ''}`;
        } else {
            return `${seasonalWorld === true ? SeasonalEmoji : ''} ${runescapeUser} ${message} ${imageURL ?? ''}`;
        }
    };

    const formattedMessage = buildMessage(message);

    if (skipDefaultChannel === false) {
        sendTwitchMessage(Channel, `${isDeath === true ? DeathEmote : DinkEmote} ${formattedMessage}`);
    }


    if (validTwitchUser === true || identicalNames === true) {
        sendExtraChannels(twitchUser, formattedMessage, isDeath);
    }
};
