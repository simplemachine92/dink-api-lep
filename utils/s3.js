import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import Config from '../config.json' with { type: 'json' };

/**
 * @type { S3Client }
*/

let S3Instance = null;

export const initializeS3Client = () => {
    if (Config.Options.Storage === 's3' && S3Instance instanceof S3Client === false) {
        S3Instance = new S3Client({
            region: Config.S3.Region,
            endpoint: Config.S3.Endpoint,
            credentials: {
                accessKeyId: Config.S3.AccessKey,
                secretAccessKey: Config.S3.SecretKey
            }
        });
    }
};

export const uploadFile = async (fileName, fileData) => {
    const putCommand = new PutObjectCommand({
        Bucket: Config.S3.Bucket,
        Key: `${fileName}.png`,
        Body: fileData,
        ContentType: 'image/png'
    });

    await S3Instance.send(putCommand);
};
