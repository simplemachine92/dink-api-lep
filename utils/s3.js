const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Config = require('../config.json');

if (Config.Options.Storage !== 's3' && Config.S3.Region === '' || Config.S3.Endpoint === '' || Config.S3.Bucket === '' || Config.S3.AccessKey === '' || Config.S3.SecretKey === '') {
    console.log('S3 configuration missing or incomplete. Not initializing S3 Client');
    return;
}

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
        Key: `${fileName}.png`,
        Body: fileData,
        ContentType: 'image/png'
    });

    await S3.send(putCommand);
};

module.exports = {
    uploadFile
};
