import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('Request');

    use(req: Request, res: Response, next: NextFunction) {
        const incoming = req.header(REQUEST_ID_HEADER);
        const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
        req.headers[REQUEST_ID_HEADER] = requestId;
        res.setHeader('X-Request-Id', requestId);

        const startedAt = Date.now();

        res.on('finish', () => {
            const durationMs = Date.now() - startedAt;
            const { method, originalUrl } = req;
            const status = res.statusCode;
            this.logger.log(
                `${method} ${originalUrl} ${status} ${durationMs}ms id=${requestId}`,
            );
        });

        next();
    }
}
