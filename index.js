/**
 * @type {import('fastify').FastifyInstance} Instance of Fastify
 */

const fastify = require('fastify')({
    trustProxy: true,
    requestIdHeader: false,
    genReqId () {
        return undefined;
    },
    logger: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'dd.mm.yy HH:MM:s.l',
                ignore: 'pid,hostname'
            }
        }
    },
    disableRequestLogging: true
});

fastify.addHook('onResponse', async (req, reply) => {
    const responseTime = `${reply.getResponseTime().toFixed('3')}ms`;
    const statusCode = reply.raw.statusCode;
    const userAgent = req.headers['user-agent'] ?? null;
    const url = req.raw.url;
    if (statusCode >= 500) {
        req.log.error(`${statusCode} ${responseTime}`);
    } else if (statusCode >= 400) {
        req.log.warn(`[${statusCode}] (${url}) (${responseTime}) (${userAgent})`);
    }
});

fastify.register(require('@fastify/multipart'), {
    attachFieldsToBody: true,
    limits: {
        files: 1,
        fileSize: 1e+8
    }
});

fastify.post('/', {
    handler: require('./handlers/dinkHandler.js')
});

fastify.post('/runelite', {
    handler: require('./handlers/dinkHandler.js')
});

fastify.post('/webhook', {
    handler: require('./handlers/dinkHandler.js')
});

fastify.post('/universal', {
    handler: require('./handlers/dinkHandler.js')
});

fastify.post('/dink', {
    handler: require('./handlers/dinkHandler.js')
});

fastify.get('/delete', {
    handler: require('./handlers/delete.js')
});

fastify.all('*', (request, reply) => reply.status(404).send({ error: 'Route not found' }));

fastify.listen({ port: process.env.LISTEN_PORT || 3000 }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
