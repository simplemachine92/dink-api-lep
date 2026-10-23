import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import Config from '../config.json' with { type: 'json' };

/**
 * @type { S3Client }
*/

let S3Instance = null;

export const initializeS3Client = () => {
    if (Config.Options.Storage === 's3' && S3Instance instanceof S3Client === false) {
        if (!(process.env.S3_BUCKET || Config.S3.Bucket)) {
            console.warn('S3 storage selected but S3_BUCKET is not set; image uploads are disabled');
            return;
        }
        S3Instance = new S3Client({
            region: process.env.S3_REGION || Config.S3.Region || 'auto',
            endpoint: process.env.S3_ENDPOINT || Config.S3.Endpoint || undefined,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || Config.S3.AccessKey,
                secretAccessKey: process.env.S3_SECRET_KEY || Config.S3.SecretKey
            }
        });
    }
};

export const uploadFile = async (fileName, fileData) => {
    if (!S3Instance) {
        throw new Error('S3 storage is not configured');
    }
    const putCommand = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET || Config.S3.Bucket,
        Key: `${fileName}.png`,
        Body: fileData,
        ContentType: 'image/png'
    });

    await S3Instance.send(putCommand);
};
