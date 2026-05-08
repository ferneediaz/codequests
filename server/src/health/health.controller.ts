import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    @ApiOperation({ summary: 'Liveness + database readiness probe' })
    @ApiResponse({ status: 200, description: 'Server and DB reachable' })
    @ApiResponse({ status: 503, description: 'Database unreachable' })
    async check() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch {
            throw new ServiceUnavailableException({
                status: 'down',
                db: 'down',
            });
        }
        return {
            status: 'ok',
            db: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        };
    }
}
