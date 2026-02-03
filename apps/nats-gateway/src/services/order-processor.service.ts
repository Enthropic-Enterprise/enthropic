// =============================================================================
// Development Order Processor
// File: apps/nats-gateway/src/services/order-processor.service.ts
// =============================================================================
// This service handles orders when Rust backend is not available
// For development/testing purposes only
// =============================================================================

import { connect, NatsConnection, JSONCodec } from 'nats';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

interface IncomingOrder {
    clientOrderId: string;
    accountId: string;
    username: string;
    symbol: string;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit';
    quantity: string;
    price?: string;
    timeInForce?: string;
    submittedAt: string;
}

interface Order {
    id: string;
    accountId: string;
    clientOrderId: string;
    symbol: string;
    side: string;
    orderType: string;
    quantity: string;
    price?: string;
    filledQuantity: string;
    avgFillPrice?: string;
    status: string;
    timeInForce: string;
    createdAt: string;
    updatedAt: string;
}

interface Position {
    accountId: string;
    symbol: string;
    netQuantity: string;
    avgPrice: string;
    currentPrice?: string;
    unrealizedPnl: string;
    realizedPnl: string;
    costBasis: string;
    updatedAt: string;
}

interface CancelRequest {
    orderId: string;
    accountId: string;
    username: string;
}

// =============================================================================
// ORDER PROCESSOR SERVICE
// =============================================================================

export class OrderProcessorService {
    private nc: NatsConnection | null = null;
    private jc = JSONCodec();

    // In-memory storage (for development only)
    private orders: Map<string, Order> = new Map();
    private positions: Map<string, Position> = new Map();
    private marketPrices: Map<string, number> = new Map();

    constructor(private natsUrl: string = 'nats://localhost:4222') {}

    async start(): Promise<void> {
        try {
            this.nc = await connect({ servers: this.natsUrl });
            console.log(`[OrderProcessor] Connected to NATS at ${this.natsUrl}`);

            await this.setupSubscriptions();
            console.log('[OrderProcessor] Ready to process orders');
        } catch (error) {
            console.error('[OrderProcessor] Failed to connect:', error);
            throw error;
        }
    }

    private async setupSubscriptions(): Promise<void> {
        if (!this.nc) return;

        // Listen for new orders
        const orderSub = this.nc.subscribe('orders.submit');
        (async () => {
            for await (const msg of orderSub) {
                try {
                    const order = this.jc.decode(msg.data) as IncomingOrder;
                    await this.processOrder(order);
                } catch (e) {
                    console.error('[OrderProcessor] Order processing error:', e);
                }
            }
        })();

        // Listen for cancel requests
        const cancelSub = this.nc.subscribe('orders.cancel');
        (async () => {
            for await (const msg of cancelSub) {
                try {
                    const request = this.jc.decode(msg.data) as CancelRequest;
                    await this.processCancelRequest(request);
                } catch (e) {
                    console.error('[OrderProcessor] Cancel error:', e);
                }
            }
        })();

        // Listen for market prices to update positions
        const marketSub = this.nc.subscribe('market.tick.*');
        (async () => {
            for await (const msg of marketSub) {
                try {
                    const tick = this.jc.decode(msg.data) as any;
                    if (tick.symbol && tick.lastPrice) {
                        this.marketPrices.set(tick.symbol, parseFloat(tick.lastPrice));
                        this.updatePositionPnL(tick.symbol);
                    }
                } catch (e) {
                    // Ignore market data errors
                }
            }
        })();

        console.log('[OrderProcessor] Subscriptions active:');
        console.log('  - orders.submit');
        console.log('  - orders.cancel');
        console.log('  - market.tick.*');
    }

    private async processOrder(incoming: IncomingOrder): Promise<void> {
        console.log(`[OrderProcessor] Processing: ${incoming.side.toUpperCase()} ${incoming.quantity} ${incoming.symbol}`);

        const now = new Date().toISOString();
        const orderId = uuidv4();

        // Create order
        const order: Order = {
            id: orderId,
            accountId: incoming.accountId,
            clientOrderId: incoming.clientOrderId,
            symbol: incoming.symbol,
            side: incoming.side,
            orderType: incoming.orderType,
            quantity: incoming.quantity,
            price: incoming.price,
            filledQuantity: '0',
            status: 'pending',
            timeInForce: incoming.timeInForce || 'GTC',
            createdAt: now,
            updatedAt: now,
        };

        // Store order
        this.orders.set(orderId, order);

        // Publish order accepted
        order.status = 'accepted';
        order.updatedAt = new Date().toISOString();
        await this.publishOrderUpdate(order);

        // Simulate fill for market orders
        if (incoming.orderType === 'market') {
            await this.simulateFill(order);
        } else {
            // For limit orders, simulate fill after delay (for demo)
            setTimeout(() => this.simulateFill(order), 2000);
        }
    }

    private async simulateFill(order: Order): Promise<void> {
        // Get current market price
        let fillPrice = this.marketPrices.get(order.symbol);

        if (!fillPrice) {
            // Use order price or default
            fillPrice = order.price ? parseFloat(order.price) : 100;
        }

        // Update order to filled
        order.filledQuantity = order.quantity;
        order.avgFillPrice = fillPrice.toFixed(2);
        order.status = 'filled';
        order.updatedAt = new Date().toISOString();

        this.orders.set(order.id, order);
        await this.publishOrderUpdate(order);

        console.log(`[OrderProcessor] Filled: ${order.id} at ${fillPrice}`);

        // Update position
        await this.updatePosition(order, fillPrice);
    }

    private async updatePosition(order: Order, fillPrice: number): Promise<void> {
        const posKey = `${order.accountId}:${order.symbol}`;
        let position = this.positions.get(posKey);

        const fillQty = parseFloat(order.filledQuantity);
        const signedQty = order.side === 'buy' ? fillQty : -fillQty;

        if (!position) {
            // New position
            position = {
                accountId: order.accountId,
                symbol: order.symbol,
                netQuantity: signedQty.toString(),
                avgPrice: fillPrice.toFixed(2),
                currentPrice: fillPrice.toFixed(2),
                unrealizedPnl: '0',
                realizedPnl: '0',
                costBasis: (Math.abs(signedQty) * fillPrice).toFixed(2),
                updatedAt: new Date().toISOString(),
            };
        } else {
            // Update existing position
            const currentQty = parseFloat(position.netQuantity);
            const currentAvg = parseFloat(position.avgPrice);
            const newQty = currentQty + signedQty;

            if (Math.sign(currentQty) === Math.sign(signedQty) || currentQty === 0) {
                // Adding to position - weighted average
                const totalCost = Math.abs(currentQty) * currentAvg + fillQty * fillPrice;
                const newAvg = totalCost / Math.abs(newQty);
                position.avgPrice = newAvg.toFixed(2);
            } else if (Math.abs(signedQty) <= Math.abs(currentQty)) {
                // Reducing position - realize P&L
                const realizedPnl = fillQty * (fillPrice - currentAvg) * Math.sign(currentQty);
                position.realizedPnl = (parseFloat(position.realizedPnl) + realizedPnl).toFixed(2);
            } else {
                // Reversing position
                const closedQty = Math.abs(currentQty);
                const realizedPnl = closedQty * (fillPrice - currentAvg) * Math.sign(currentQty);
                position.realizedPnl = (parseFloat(position.realizedPnl) + realizedPnl).toFixed(2);
                position.avgPrice = fillPrice.toFixed(2);
            }

            position.netQuantity = newQty.toFixed(8);
            position.currentPrice = fillPrice.toFixed(2);
            position.costBasis = (Math.abs(newQty) * parseFloat(position.avgPrice)).toFixed(2);
            position.updatedAt = new Date().toISOString();

            // Calculate unrealized P&L
            const unrealized = parseFloat(position.netQuantity) * (fillPrice - parseFloat(position.avgPrice));
            position.unrealizedPnl = unrealized.toFixed(2);
        }

        this.positions.set(posKey, position);
        await this.publishPositionUpdate(position);

        console.log(`[OrderProcessor] Position updated: ${position.symbol} qty=${position.netQuantity}`);
    }

    private updatePositionPnL(symbol: string): void {
        const price = this.marketPrices.get(symbol);
        if (!price) return;

        this.positions.forEach((position, key) => {
            if (position.symbol === symbol) {
                const qty = parseFloat(position.netQuantity);
                const avg = parseFloat(position.avgPrice);
                const unrealized = qty * (price - avg);

                position.currentPrice = price.toFixed(2);
                position.unrealizedPnl = unrealized.toFixed(2);
                position.updatedAt = new Date().toISOString();

                this.publishPositionUpdate(position);
            }
        });
    }

    private async processCancelRequest(request: CancelRequest): Promise<void> {
        console.log(`[OrderProcessor] Cancel request: ${request.orderId}`);

        const order = this.orders.get(request.orderId);
        if (!order) {
            console.log(`[OrderProcessor] Order not found: ${request.orderId}`);
            return;
        }

        if (order.status !== 'pending' && order.status !== 'accepted') {
            console.log(`[OrderProcessor] Cannot cancel order in status: ${order.status}`);
            return;
        }

        order.status = 'cancelled';
        order.updatedAt = new Date().toISOString();
        this.orders.set(order.id, order);

        await this.publishOrderUpdate(order);
        console.log(`[OrderProcessor] Order cancelled: ${request.orderId}`);
    }

    private async publishOrderUpdate(order: Order): Promise<void> {
        if (!this.nc) return;

        const subject = `orders.update.${order.accountId}`;
        this.nc.publish(subject, this.jc.encode(order));
        console.log(`[OrderProcessor] Published order update to ${subject}`);
    }

    private async publishPositionUpdate(position: Position): Promise<void> {
        if (!this.nc) return;

        const subject = `positions.update.${position.accountId}`;
        this.nc.publish(subject, this.jc.encode(position));
    }

    async stop(): Promise<void> {
        if (this.nc) {
            await this.nc.drain();
        }
        console.log('[OrderProcessor] Stopped');
    }
}

// =============================================================================
// STANDALONE RUNNER
// =============================================================================

async function main() {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';

    console.log('='.repeat(60));
    console.log('       ENTHROPIC ORDER PROCESSOR (DEV MODE)');
    console.log('='.repeat(60));
    console.log(`NATS URL: ${natsUrl}`);
    console.log('='.repeat(60));

    const processor = new OrderProcessorService(natsUrl);

    const shutdown = async () => {
        console.log('\nShutting down...');
        await processor.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await processor.start();
        console.log('\nPress Ctrl+C to stop');
    } catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export default OrderProcessorService;