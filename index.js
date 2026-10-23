const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0';
const LISTEN_PORT = Number(process.env.PORT || process.env.LISTEN_PORT || 3000);

import fastifyInstance from 'fastify';
import multipartPlugin from '@fastify/multipart';

const fastify = fastifyInstance({
    trustProxy: true,
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
    const responseTime = `${reply.elapsedTime().toFixed('3')}ms`;
    const statusCode = reply.statusCode;
    const userAgent = req.headers['user-agent'] ?? null;
    const url = req.url;
    if (statusCode >= 500) {
        req.log.error(`${statusCode} ${responseTime}`);
    } else if (statusCode >= 400) {
        req.log.warn(`[${statusCode}] (${url}) (${responseTime}) (${userAgent})`);
    }
});

fastify.register(multipartPlugin, {
    attachFieldsToBody: true,
    limits: {
        files: 1,
        fileSize: 1e+8
    }
});

import dinkRouteHandler from './handlers/dinkHandler.js';

fastify.post('/dink', {
    handler: dinkRouteHandler
});

/* fastify.get('/delete', {
    handler: require('./handlers/delete.js')
}); */

fastify.listen({ port: LISTEN_PORT, host: LISTEN_HOST }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
