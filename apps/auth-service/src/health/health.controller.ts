import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: { status: string; latency?: number };
  };
}

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const dbCheck = await this.checkDatabase();
    
    const status = dbCheck.status === 'up' ? 'healthy' : 'unhealthy';
    
    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbCheck,
      },
    };
  }

  @Get('live')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; ready: boolean }> {
    const dbCheck = await this.checkDatabase();
    return { status: dbCheck.status, ready: dbCheck.status === 'up' };
  }

  private async checkDatabase(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { status: 'up', latency };
    } catch {
      return { status: 'down' };
    }
  }
}
