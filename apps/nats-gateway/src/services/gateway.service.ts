// =============================================================================
// NATS Gateway WebSocket Handler
// File: apps/nats-gateway/src/services/gateway.service.ts
// =============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import * as http from 'http';
import * as jwt from 'jsonwebtoken';

// =============================================================================
// TYPES
// =============================================================================

interface WebSocketMessage {
    type: string;
    token?: string;
    channel?: string;
    data?: any;
    orderId?: string;
}

interface AuthenticatedClient {
    ws: WebSocket;
    accountId: string;
    username: string;
    permissions: string[];
    subscriptions: Map<string, Subscription>;
}

interface DecodedToken {
    sub: string;
    username: string;
    role: string;
    permissions: string[];
    iat: number;
    exp: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    WS_PORT: parseInt(process.env.WS_PORT || '3002', 10),
    NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    HEARTBEAT_INTERVAL: 30000,
};

// =============================================================================
// NATS GATEWAY SERVICE
// =============================================================================

export class NatsGatewayService {
    private wss: WebSocketServer | null = null;
    private nc: NatsConnection | null = null;
    private jc = JSONCodec();
    private clients: Map<WebSocket, AuthenticatedClient> = new Map();
    private server: http.Server | null = null;

    async start(): Promise<void> {
        console.log('='.repeat(60));
        console.log('       ENTHROPIC NATS GATEWAY');
        console.log('='.repeat(60));

        await this.connectNats();
        this.startWebSocketServer();
        this.setupNatsListeners();

        console.log('='.repeat(60));
        console.log(`WebSocket Server: ws://localhost:${CONFIG.WS_PORT}`);
        console.log(`NATS Connection: ${CONFIG.NATS_URL}`);
        console.log('='.repeat(60));
    }

    // ===========================================================================
    // NATS CONNECTION
    // ===========================================================================

    private async connectNats(): Promise<void> {
        try {
            this.nc = await connect({ servers: CONFIG.NATS_URL });
            console.log(`[Gateway] Connected to NATS at ${CONFIG.NATS_URL}`);

            (async () => {
                for await (const status of this.nc!.status()) {
                    console.log(`[Gateway] NATS Status: ${status.type}`);
                }
            })();
        } catch (error) {
            console.error('[Gateway] Failed to connect to NATS:', error);
            throw error;
        }
    }

    // ===========================================================================
    // WEBSOCKET SERVER
    // ===========================================================================

    private startWebSocketServer(): void {
        this.server = http.createServer();
        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
            const clientIp = req.socket.remoteAddress || 'unknown';
            console.log(`[Gateway] New connection from ${clientIp}`);

            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }, CONFIG.HEARTBEAT_INTERVAL);

            ws.on('message', (data: Buffer) => {
                this.handleMessage(ws, data);
            });

            ws.on('close', () => {
                console.log(`[Gateway] Client disconnected: ${clientIp}`);
                this.cleanupClient(ws);
                clearInterval(pingInterval);
            });

            ws.on('error', (error) => {
                console.error('[Gateway] WebSocket error:', error);
                this.cleanupClient(ws);
                clearInterval(pingInterval);
            });
        });

        this.server.listen(CONFIG.WS_PORT, () => {
            console.log(`[Gateway] WebSocket server on port ${CONFIG.WS_PORT}`);
        });
    }

    // ===========================================================================
    // MESSAGE HANDLING
    // ===========================================================================

    private handleMessage(ws: WebSocket, data: Buffer): void {
        try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            console.log(`[Gateway] Received: ${message.type}`);

            switch (message.type) {
                case 'authenticate':
                    this.handleAuthenticate(ws, message.token);
                    break;
                case 'subscribe':
                    this.handleSubscribe(ws, message.channel);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(ws, message.channel);
                    break;
                case 'order':
                    this.handleOrder(ws, message.data);
                    break;
                case 'cancel':
                    this.handleCancelOrder(ws, message.orderId);
                    break;
                default:
                    this.sendError(ws, 'UNKNOWN_TYPE', `Unknown: ${message.type}`);
            }
        } catch (error) {
            console.error('[Gateway] Parse error:', error);
            this.sendError(ws, 'PARSE_ERROR', 'Failed to parse message');
        }
    }

    // ===========================================================================
    // AUTHENTICATION
    // ===========================================================================

    private handleAuthenticate(ws: WebSocket, token?: string): void {
        if (!token) {
            this.sendError(ws, 'NO_TOKEN', 'No token provided');
            return;
        }

        try {
            const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as DecodedToken;

            const client: AuthenticatedClient = {
                ws,
                accountId: decoded.sub,
                username: decoded.username,
                permissions: decoded.permissions || [],
                subscriptions: new Map(),
            };

            this.clients.set(ws, client);

            this.send(ws, {
                type: 'authenticated',
                data: {
                    accountId: decoded.sub,
                    username: decoded.username,
                    permissions: decoded.permissions,
                },
            });

            console.log(`[Gateway] Authenticated: ${decoded.username} (${decoded.sub})`);

            // Auto-subscribe to user's orders and positions
            this.subscribeToChannel(client, `orders.${client.accountId}`);
            this.subscribeToChannel(client, `positions.${client.accountId}`);

        } catch (error: any) {
            console.error('[Gateway] Auth failed:', error.message);
            this.sendError(ws, 'AUTH_FAILED', 'Invalid token');
        }
    }

    // ===========================================================================
    // SUBSCRIPTIONS
    // ===========================================================================

    private handleSubscribe(ws: WebSocket, channel?: string): void {
        const client = this.clients.get(ws);
        if (!client) {
            this.sendError(ws, 'NOT_AUTHENTICATED', 'Authenticate first');
            return;
        }

        if (!channel) {
            this.sendError(ws, 'NO_CHANNEL', 'No channel specified');
            return;
        }

        this.subscribeToChannel(client, channel);
    }

    private subscribeToChannel(client: AuthenticatedClient, channel: string): void {
        if (client.subscriptions.has(channel)) {
            return;
        }

        if (!this.nc) {
            this.sendError(client.ws, 'NATS_ERROR', 'NATS not connected');
            return;
        }

        try {
            const sub = this.nc.subscribe(channel, {
                callback: (err, msg) => {
                    if (err) {
                        console.error(`[Gateway] NATS error on ${channel}:`, err);
                        return;
                    }

                    try {
                        const data = this.jc.decode(msg.data);
                        this.send(client.ws, {
                            type: 'message',
                            channel: channel,
                            data: data,
                        });
                    } catch (decodeErr) {
                        console.error('[Gateway] Decode error:', decodeErr);
                    }
                },
            });

            client.subscriptions.set(channel, sub);
            console.log(`[Gateway] ${client.username} subscribed to ${channel}`);

            this.send(client.ws, {
                type: 'subscribed',
                channel: channel,
            });

        } catch (error) {
            console.error(`[Gateway] Subscribe failed for ${channel}:`, error);
            this.sendError(client.ws, 'SUBSCRIBE_FAILED', `Failed: ${channel}`);
        }
    }

    private handleUnsubscribe(ws: WebSocket, channel?: string): void {
        const client = this.clients.get(ws);
        if (!client || !channel) return;

        const sub = client.subscriptions.get(channel);
        if (sub) {
            sub.unsubscribe();
            client.subscriptions.delete(channel);
            console.log(`[Gateway] ${client.username} unsubscribed from ${channel}`);
        }
    }

    // ===========================================================================
    // ORDER HANDLING
    // ===========================================================================

    private async handleOrder(ws: WebSocket, orderData?: any): Promise<void> {
        const client = this.clients.get(ws);
        if (!client) {
            this.sendError(ws, 'NOT_AUTHENTICATED', 'Authenticate first');
            return;
        }

        if (!this.hasPermission(client, 'orders:create')) {
            this.sendError(ws, 'PERMISSION_DENIED', 'No order permission');
            return;
        }

        if (!orderData) {
            this.sendError(ws, 'NO_DATA', 'No order data');
            return;
        }

        if (!this.nc) {
            this.sendError(ws, 'NATS_ERROR', 'NATS not connected');
            return;
        }

        try {
            const enrichedOrder = {
                ...orderData,
                accountId: client.accountId,
                username: client.username,
                submittedAt: new Date().toISOString(),
            };

            // Publish to NATS for backend processing
            this.nc.publish('orders.submit', this.jc.encode(enrichedOrder));

            console.log(`[Gateway] Order submitted: ${enrichedOrder.clientOrderId} by ${client.username}`);

            this.send(ws, {
                type: 'order_submitted',
                data: {
                    clientOrderId: orderData.clientOrderId,
                    status: 'submitted',
                },
            });

        } catch (error) {
            console.error('[Gateway] Order submit failed:', error);
            this.sendError(ws, 'ORDER_FAILED', 'Failed to submit order');
        }
    }

    private async handleCancelOrder(ws: WebSocket, orderId?: string): Promise<void> {
        const client = this.clients.get(ws);
        if (!client) {
            this.sendError(ws, 'NOT_AUTHENTICATED', 'Authenticate first');
            return;
        }

        if (!this.hasPermission(client, 'orders:cancel')) {
            this.sendError(ws, 'PERMISSION_DENIED', 'No cancel permission');
            return;
        }

        if (!orderId || !this.nc) {
            this.sendError(ws, 'INVALID_REQUEST', 'Invalid cancel request');
            return;
        }

        try {
            const cancelRequest = {
                orderId,
                accountId: client.accountId,
                username: client.username,
                cancelledAt: new Date().toISOString(),
            };

            this.nc.publish('orders.cancel', this.jc.encode(cancelRequest));

            console.log(`[Gateway] Cancel submitted: ${orderId} by ${client.username}`);

            this.send(ws, {
                type: 'cancel_submitted',
                data: { orderId, status: 'cancel_pending' },
            });

        } catch (error) {
            console.error('[Gateway] Cancel failed:', error);
            this.sendError(ws, 'CANCEL_FAILED', 'Failed to cancel');
        }
    }

    // ===========================================================================
    // NATS LISTENERS - Receive updates from backend and forward to clients
    // ===========================================================================

    private setupNatsListeners(): void {
        if (!this.nc) return;

        // Listen for order updates from execution-core
        this.nc.subscribe('orders.update.*', {
            callback: (err, msg) => {
                if (err) return;
                try {
                    const data = this.jc.decode(msg.data) as any;
                    const accountId = msg.subject.split('.')[2]; // orders.update.{accountId}

                    console.log(`[Gateway] Order update for account ${accountId}:`, data.id || data.clientOrderId);

                    // Forward to all clients subscribed to this account's orders
                    this.clients.forEach((client) => {
                        if (client.accountId === accountId || client.subscriptions.has(`orders.${accountId}`)) {
                            this.send(client.ws, {
                                type: 'message',
                                channel: `orders.${accountId}`,
                                data: data,
                            });
                        }
                    });
                } catch (e) {
                    console.error('[Gateway] Order update error:', e);
                }
            },
        });

        // Listen for position updates
        this.nc.subscribe('positions.update.*', {
            callback: (err, msg) => {
                if (err) return;
                try {
                    const data = this.jc.decode(msg.data) as any;
                    const accountId = msg.subject.split('.')[2];

                    console.log(`[Gateway] Position update for account ${accountId}:`, data.symbol);

                    this.clients.forEach((client) => {
                        if (client.accountId === accountId || client.subscriptions.has(`positions.${accountId}`)) {
                            this.send(client.ws, {
                                type: 'message',
                                channel: `positions.${accountId}`,
                                data: data,
                            });
                        }
                    });
                } catch (e) {
                    console.error('[Gateway] Position update error:', e);
                }
            },
        });

        // Forward market ticks to subscribed clients
        this.nc.subscribe('market.tick.*', {
            callback: (err, msg) => {
                if (err) return;
                try {
                    const data = this.jc.decode(msg.data);
                    const channel = msg.subject;

                    this.clients.forEach((client) => {
                        if (client.subscriptions.has(channel)) {
                            this.send(client.ws, {
                                type: 'message',
                                channel: channel,
                                data: data,
                            });
                        }
                    });
                } catch (e) {
                    // Silent fail for market data
                }
            },
        });

        console.log('[Gateway] NATS listeners configured');
    }

    // ===========================================================================
    // UTILITIES
    // ===========================================================================

    private hasPermission(client: AuthenticatedClient, permission: string): boolean {
        return client.permissions.includes(permission) ||
            client.permissions.includes('admin:full');
    }

    private send(ws: WebSocket, message: any): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    private sendError(ws: WebSocket, code: string, message: string): void {
        this.send(ws, { type: 'error', code, error: message });
    }

    private cleanupClient(ws: WebSocket): void {
        const client = this.clients.get(ws);
        if (client) {
            client.subscriptions.forEach((sub) => {
                sub.unsubscribe();
            });
            console.log(`[Gateway] Cleaned up: ${client.username}`);
        }
        this.clients.delete(ws);
    }

    async stop(): Promise<void> {
        this.clients.forEach((client, ws) => {
            this.cleanupClient(ws);
            ws.close();
        });

        if (this.wss) this.wss.close();
        if (this.server) this.server.close();
        if (this.nc) await this.nc.drain();

        console.log('[Gateway] Stopped');
    }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    const gateway = new NatsGatewayService();

    const shutdown = async () => {
        console.log('\n[Gateway] Shutting down...');
        await gateway.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await gateway.start();
    } catch (error) {
        console.error('[Gateway] Startup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export default NatsGatewayService;