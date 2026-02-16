import Redis from 'ioredis';
import { writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as durationParse } from 'tinyduration';
import { nanoid } from 'nanoid';

import Config from '../config.json' with { type: 'json' };
import * as S3Client from './s3.js';

S3Client.initializeS3Client();

const RedisPub = new Redis({ host: Config.Options.RedisDSN, lazyConnect: true });

const publishMessage = (msgData) => {
    if (!Config.Options.RedisEnabled) {
        return;
    }
    RedisPub.publish('go-bot', JSON.stringify(msgData));
};

const checkTwitchName = (twitchUser, runescapeUser) => {
    if (!twitchUser || !runescapeUser) {
        return false;
    }

    const nameData = Config.NameMap?.[twitchUser.toLowerCase()];

    if (!nameData) {
        return false;
    }

    return Boolean(nameData.includes(runescapeUser));
};

const sendExtraChannels = (twitchUser, message, isDeath) => {
    const extraChannels = Config.UserConfig?.[twitchUser.toLowerCase()];

    if (extraChannels === undefined) {
        return null;
    }

    for (const channel of extraChannels.Channels) {
        const customEmotes = extraChannels?.emotes?.[channel] ?? Config.ChannelConfig?.[channel];
        let customMessage = `${customEmotes?.DinkEmote ?? Config.Default.DinkEmote} ${message}`;

        if (isDeath === true) {
            customMessage = `${customEmotes?.DeathEmote ?? Config.Default.DeathEmote} ${message}`;
        }

        sendTwitchMessage(channel, customMessage);
    }
};

const writeImage = async (imageData, skipImage) => {
    if (!imageData || skipImage === true) {
        return null;
    }

    if (Config.Options.Storage === '' || Config.Options.Storage !== 'file' && Config.Options.Storage !== 's3') {
        console.log('No Storage backend configured or invalid backend specified. Valid backends: [file, s3]');
        return null;
    }

    if (Config.Options.Storage === 'file' && Config.Options.FilePath === '') {
        console.log('No filepath configured with file based storage');
        return null;
    }

    const fileName = nanoid(12);

    switch (Config.Options.Storage) {
        case 'file': {
            await writeFile(`${Config.Options.FilePath}/${fileName}.png`, imageData);
            break;
        }
        case 's3': {
            await S3Client.uploadFile(fileName, imageData);
            break;
        }
    }

    return `${Config.Options.FileURLPrefix}/${fileName}.png`;
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

export const formatStringCase = (string) => {
    const str = string.toLowerCase();
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const parseDuration = (duration) => {
    const parsedDuration = durationParse(duration);
    const formattedDuration = Object.entries(parsedDuration)
        .map(i => `${i[1]}${i[0][0]}`)
        .join(', ');

    return formattedDuration;
};

export const formatCurrency = (value) => {
    if (value >= 1e6) {
        return `${Math.floor(value / 1e4) / 100}M`;
    } else if (value >= 1e5) {
        return `${Math.floor(value / 1e3)}k`;
    } else {
        return `${value}gp`;
    }
};

export const writeLog = async (logText) => {
    const projectRoot = path.dirname(process.argv[1]);
    const fileName = `${new Date().toJSON().slice(0, 10)}.json`;
    await appendFile(`${projectRoot}/logs/${fileName}`, `${JSON.stringify(logText)}\n`);
};

export const handleDinkMessage = async (runescapeUser, seasonalWorld, twitchUser, skipDefaultChannel, skipImage, message, imageData, isDeath = false) => {
    const imageURL = await writeImage(imageData, skipImage);

    const validTwitchUser = checkTwitchName(twitchUser, runescapeUser);
    const identicalNames = Boolean(runescapeUser?.toLowerCase() === twitchUser?.toLowerCase());

    const { DinkConfig: { SeasonalEmoji }, Default: { Channel, DinkEmote, DeathEmote } } = Config;

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
