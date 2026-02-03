// =============================================================================
// NATS Gateway Main Entry Point (Complete)
// File: apps/nats-gateway/src/main.ts
// =============================================================================
// Includes: Gateway, Market Simulator, Order Processor (dev mode)
// =============================================================================

import { NatsGatewayService } from './services/gateway.service';
import { MarketSimulator } from './services/market-simulator.service';
import { OrderProcessorService } from './services/order-processor.service';

async function main() {
    console.log('');
    console.log('='.repeat(60));
    console.log('ENTHROPIC TRADING PLATFORM - NATS GATEWAY');
    console.log('='.repeat(60));
    console.log('');

    const enableSimulator = process.env.ENABLE_MARKET_SIMULATOR !== 'false';
    const enableOrderProcessor = process.env.ENABLE_ORDER_PROCESSOR !== 'false';

    const gateway = new NatsGatewayService();
    let simulator: MarketSimulator | null = null;
    let orderProcessor: OrderProcessorService | null = null;

    const shutdown = async () => {
        console.log('\nShutting down...');
        if (simulator) await simulator.disconnect();
        if (orderProcessor) await orderProcessor.stop();
        await gateway.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        // Start gateway first
        await gateway.start();

        // Start order processor (for development without Rust backend)
        if (enableOrderProcessor) {
            console.log('\nStarting Order Processor (dev mode)...');
            orderProcessor = new OrderProcessorService();
            await orderProcessor.start();
            console.log('Order processor active');
        }

        // Start market simulator
        if (enableSimulator) {
            console.log('\nStarting Market Simulator...');
            simulator = new MarketSimulator();
            await simulator.connect();
            simulator.start(1000);
            console.log('Market simulator active');
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('Services:');
        console.log('  WebSocket Gateway: ws://localhost:3002');
        console.log('  NATS Server:       nats://localhost:4222');
        if (enableSimulator) console.log('  Market Simulator:  ACTIVE');
        if (enableOrderProcessor) console.log('  Order Processor:   ACTIVE (dev mode)');
        console.log('');
        console.log('Press Ctrl+C to stop');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Startup failed:', error);
        process.exit(1);
    }
}

main();