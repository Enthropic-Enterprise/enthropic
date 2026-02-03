// =============================================================================
// Order Handler Service
// File: apps/nats-gateway/src/services/order-handler.service.ts
// =============================================================================
// Subscribes to order NATS subjects, saves to DB, broadcasts updates
// =============================================================================

import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface OrderSubmission {
    auth: {
        account_id: string;
        username: string;
        role: string;
        permissions: string[];
    };
    clientOrderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';
}

export interface Order {
    id: string;
    accountId: string;
    clientOrderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    orderType: string;
    quantity: string;
    price?: string;
    stopPrice?: string;
    filledQuantity: string;
    avgFillPrice?: string;
    status: 'pending' | 'accepted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';
    timeInForce: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CancelRequest {
    auth: {
        account_id: string;
        username: string;
        role: string;
        permissions: string[];
    };
    order_id: string;
}

// =============================================================================
// ORDER HANDLER CLASS
// =============================================================================

export class OrderHandler {
    private nc: NatsConnection | null = null;
    private pool: Pool;
    private jc = JSONCodec();
    private subscriptions: Subscription[] = [];

    constructor(pool: Pool, private natsUrl: string = 'nats://localhost:4222') {
        this.pool = pool;
    }

    async start(): Promise<void> {
        // Connect to NATS
        this.nc = await connect({ servers: this.natsUrl });
        console.log('✅ [OrderHandler] Connected to NATS');

        // Subscribe to order subjects
        await this.subscribeToOrders();
        await this.subscribeToCancel();

        console.log('📋 [OrderHandler] Listening for orders...');
    }

    async stop(): Promise<void> {
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        if (this.nc) {
            await this.nc.drain();
        }
        console.log('🔌 [OrderHandler] Stopped');
    }

    private async subscribeToOrders(): Promise<void> {
        if (!this.nc) return;

        const sub = this.nc.subscribe('orders.submit', {
            callback: async (err, msg) => {
                if (err) {
                    console.error('[OrderHandler] Error receiving order:', err);
                    return;
                }

                try {
                    const data: OrderSubmission = this.jc.decode(msg.data) as OrderSubmission;
                    await this.processOrder(data);
                } catch (error) {
                    console.error('[OrderHandler] Error processing order:', error);
                }
            },
        });

        this.subscriptions.push(sub);
        console.log('📥 [OrderHandler] Subscribed to orders.submit');
    }

    private async subscribeToCancel(): Promise<void> {
        if (!this.nc) return;

        const sub = this.nc.subscribe('orders.cancel', {
            callback: async (err, msg) => {
                if (err) {
                    console.error('[OrderHandler] Error receiving cancel:', err);
                    return;
                }

                try {
                    const data: CancelRequest = this.jc.decode(msg.data) as CancelRequest;
                    await this.processCancel(data);
                } catch (error) {
                    console.error('[OrderHandler] Error processing cancel:', error);
                }
            },
        });

        this.subscriptions.push(sub);
        console.log('📥 [OrderHandler] Subscribed to orders.cancel');
    }

    private async processOrder(submission: OrderSubmission): Promise<void> {
        const orderId = uuidv4();
        const now = new Date().toISOString();

        // Simulate order acceptance (in production, this would go to matching engine)
        const order: Order = {
            id: orderId,
            accountId: submission.auth.account_id,
            clientOrderId: submission.clientOrderId,
            symbol: submission.symbol,
            side: submission.side,
            orderType: submission.orderType,
            quantity: submission.quantity,
            price: submission.price,
            stopPrice: submission.stopPrice,
            filledQuantity: '0',
            status: 'accepted',
            timeInForce: submission.timeInForce || 'GTC',
            createdAt: now,
            updatedAt: now,
        };

        // Save to database
        try {
            await this.saveOrder(order);
            console.log(`✅ [OrderHandler] Order ${orderId} saved - ${submission.side} ${submission.quantity} ${submission.symbol}`);
        } catch (error) {
            console.error('[OrderHandler] Failed to save order:', error);
            order.status = 'rejected';
        }

        // Broadcast order update to client
        this.broadcastOrder(order);

        // Simulate order fill for market orders (demo purposes)
        if (submission.orderType === 'market') {
            setTimeout(() => this.simulateFill(order), 500 + Math.random() * 1000);
        } else {
            // For limit orders, simulate partial/full fill after random delay
            setTimeout(() => this.simulateFill(order), 2000 + Math.random() * 3000);
        }
    }

    private async processCancel(request: CancelRequest): Promise<void> {
        try {
            // Update order status in database
            const result = await this.pool.query(
                `UPDATE orders SET status = 'cancelled', updated_at = NOW() 
         WHERE id = $1 AND account_id = $2 AND status IN ('pending', 'accepted', 'partially_filled')
         RETURNING *`,
                [request.order_id, request.auth.account_id]
            );

            if (result.rows.length > 0) {
                const order = this.mapDbOrder(result.rows[0]);
                this.broadcastOrder(order);
                console.log(`❌ [OrderHandler] Order ${request.order_id} cancelled`);
            } else {
                console.log(`⚠️ [OrderHandler] Order ${request.order_id} not found or already completed`);
            }
        } catch (error) {
            console.error('[OrderHandler] Cancel error:', error);
        }
    }

    private async saveOrder(order: Order): Promise<void> {
        await this.pool.query(
            `INSERT INTO orders (
        id, account_id, client_order_id, symbol, side, order_type,
        quantity, price, stop_price, filled_quantity, avg_fill_price,
        status, time_in_force, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        filled_quantity = EXCLUDED.filled_quantity,
        avg_fill_price = EXCLUDED.avg_fill_price,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at`,
            [
                order.id,
                order.accountId,
                order.clientOrderId,
                order.symbol,
                order.side,
                order.orderType,
                order.quantity,
                order.price || null,
                order.stopPrice || null,
                order.filledQuantity,
                order.avgFillPrice || null,
                order.status,
                order.timeInForce,
                order.createdAt,
                order.updatedAt,
            ]
        );
    }

    private async simulateFill(order: Order): Promise<void> {
        if (order.status === 'cancelled' || order.status === 'filled') return;

        // Generate fill price (market orders use "current" price, limit orders use limit price)
        const fillPrice = order.orderType === 'market'
            ? this.getSimulatedPrice(order.symbol)
            : parseFloat(order.price || '0');

        const qty = parseFloat(order.quantity);
        const currentFilled = parseFloat(order.filledQuantity);

        // Simulate partial or full fill
        const fillQty = order.orderType === 'market' ? qty : qty * (0.5 + Math.random() * 0.5);
        const newFilledQty = Math.min(currentFilled + fillQty, qty);

        order.filledQuantity = newFilledQty.toString();
        order.avgFillPrice = fillPrice.toString();
        order.status = newFilledQty >= qty ? 'filled' : 'partially_filled';
        order.updatedAt = new Date().toISOString();

        // Update in database
        try {
            await this.pool.query(
                `UPDATE orders SET 
          filled_quantity = $1, avg_fill_price = $2, status = $3, updated_at = NOW()
         WHERE id = $4`,
                [order.filledQuantity, order.avgFillPrice, order.status, order.id]
            );

            // Update position
            await this.updatePosition(order, fillQty, fillPrice);

            console.log(`📈 [OrderHandler] Order ${order.id} ${order.status}: ${newFilledQty}/${qty} @ ${fillPrice}`);
        } catch (error) {
            console.error('[OrderHandler] Fill update error:', error);
        }

        // Broadcast update
        this.broadcastOrder(order);
    }

    private async updatePosition(order: Order, fillQty: number, fillPrice: number): Promise<void> {
        const qtyChange = order.side === 'buy' ? fillQty : -fillQty;

        try {
            // Upsert position
            await this.pool.query(
                `INSERT INTO positions (account_id, symbol, net_quantity, avg_price, cost_basis, unrealized_pnl, realized_pnl, updated_at)
         VALUES ($1, $2, $3, $4, $5, '0', '0', NOW())
         ON CONFLICT (account_id, symbol) DO UPDATE SET
           net_quantity = positions.net_quantity + $3,
           avg_price = CASE 
             WHEN $3 > 0 THEN 
               (positions.avg_price::numeric * positions.net_quantity::numeric + $4 * $3) / 
               (positions.net_quantity::numeric + $3)
             ELSE positions.avg_price
           END,
           cost_basis = positions.cost_basis::numeric + ABS($3) * $4,
           updated_at = NOW()`,
                [order.accountId, order.symbol, qtyChange.toString(), fillPrice, (fillQty * fillPrice).toString()]
            );

            // Broadcast position update
            await this.broadcastPositions(order.accountId);
        } catch (error) {
            console.error('[OrderHandler] Position update error:', error);
        }
    }

    private async broadcastPositions(accountId: string): Promise<void> {
        if (!this.nc) return;

        try {
            const result = await this.pool.query(
                `SELECT * FROM positions WHERE account_id = $1`,
                [accountId]
            );

            const positions = result.rows.map(row => ({
                accountId: row.account_id,
                symbol: row.symbol,
                netQuantity: row.net_quantity,
                avgPrice: row.avg_price,
                currentPrice: row.current_price || row.avg_price,
                unrealizedPnl: row.unrealized_pnl || '0',
                realizedPnl: row.realized_pnl || '0',
                costBasis: row.cost_basis,
                updatedAt: row.updated_at,
            }));

            this.nc.publish(
                `positions.${accountId}`,
                this.jc.encode({ positions })
            );
        } catch (error) {
            console.error('[OrderHandler] Broadcast positions error:', error);
        }
    }

    private broadcastOrder(order: Order): void {
        if (!this.nc) return;

        // Broadcast to account-specific channel
        this.nc.publish(
            `orders.${order.accountId}`,
            this.jc.encode(order)
        );

        // Broadcast to all orders channel (for admins/risk managers)
        this.nc.publish('orders.all', this.jc.encode(order));
    }

    private getSimulatedPrice(symbol: string): number {
        // Simulated current prices
        const prices: Record<string, number> = {
            'BTC-USD': 95000 + (Math.random() - 0.5) * 1000,
            'ETH-USD': 3500 + (Math.random() - 0.5) * 100,
            'SPY': 590 + (Math.random() - 0.5) * 5,
            'AAPL': 185 + (Math.random() - 0.5) * 3,
            'GOOGL': 175 + (Math.random() - 0.5) * 3,
            'BBRI.JK': 5250 + (Math.random() - 0.5) * 100,
            'BBCA.JK': 9875 + (Math.random() - 0.5) * 150,
            'TLKM.JK': 3450 + (Math.random() - 0.5) * 50,
        };
        return prices[symbol] || 100;
    }

    private mapDbOrder(row: any): Order {
        return {
            id: row.id,
            accountId: row.account_id,
            clientOrderId: row.client_order_id,
            symbol: row.symbol,
            side: row.side,
            orderType: row.order_type,
            quantity: row.quantity,
            price: row.price,
            stopPrice: row.stop_price,
            filledQuantity: row.filled_quantity || '0',
            avgFillPrice: row.avg_fill_price,
            status: row.status,
            timeInForce: row.time_in_force || 'GTC',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}

export default OrderHandler;