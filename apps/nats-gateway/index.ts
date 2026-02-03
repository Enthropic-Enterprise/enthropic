// =============================================================================
// NATS Gateway Entry Point - Complete Version
// File: apps/nats-gateway/src/index.ts
// =============================================================================
// Starts WebSocket server, Market Simulator, and Order Handler
// =============================================================================

import { Pool } from 'pg';
import Redis from 'ioredis';
import { WebSocketHandler } from './websocket-handler';
import { loadConfig } from './config';
import { MarketSimulator } from './services/market-simulator.service';
import { OrderHandler } from './services/order-handler.service';

async function main() {
    const config = loadConfig();

    console.log('═══════════════════════════════════════════════════════');
    console.log('       ENTHROPIC NATS GATEWAY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Port: ${config.port}`);
    console.log(`NATS: ${config.natsUrl}`);
    console.log('═══════════════════════════════════════════════════════');

    // Initialize PostgreSQL pool
    const pool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
    });

    // Test database connection
    try {
        const client = await pool.connect();
        console.log('Connected to PostgreSQL');
        client.release();
    } catch (error) {
        console.error('Failed to connect to PostgreSQL:', error);
        process.exit(1);
    }

    // Initialize Redis
    const redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    redis.on('connect', () => {
        console.log('Connected to Redis');
    });

    redis.on('error', (error) => {
        console.error('Redis error:', error);
    });

    // Initialize WebSocket handler
    const wsHandler = new WebSocketHandler(pool, redis, config);
    await wsHandler.start();
    console.log(`WebSocket server running on port ${config.port}`);

    // Initialize Market Simulator
    const marketSimulator = new MarketSimulator(config.natsUrl);
    try {
        await marketSimulator.connect();
        marketSimulator.start(1000); // 1 second interval
        console.log('Market Simulator started');
    } catch (error) {
        console.error('Market Simulator failed to start:', error);
        // Continue without simulator - not critical for operation
    }

    // Initialize Order Handler
    const orderHandler = new OrderHandler(pool, config.natsUrl);
    try {
        await orderHandler.start();
        console.log('Order Handler started');
    } catch (error) {
        console.error('Order Handler failed to start:', error);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('           NATS Gateway fully operational');
    console.log('═══════════════════════════════════════════════════════');

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\nShutting down...');

        wsHandler.stop();
        await marketSimulator.disconnect();
        await orderHandler.stop();
        await pool.end();
        redis.disconnect();

        console.log('Goodbye!');
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});