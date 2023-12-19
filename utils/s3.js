const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Config = require('../config.json');

const S3 = new S3Client({
    region: Config.S3.Region,
    endpoint: Config.S3.Endpoint,
    credentials: {
        accessKeyId: Config.S3.AccessKey,
        secretAccessKey: Config.S3.SecretKey
    }
});

const uploadFile = async (fileName, fileData) => {
    const putCommand = new PutObjectCommand({
        Bucket: Config.S3.Bucket,
        Key: fileName,
        Body: fileData,
        ContentEncoding: 'base64',
        ContentType: 'image/png'
    });

    await S3.send(putCommand);
};

module.exports = {
    uploadFile
};
