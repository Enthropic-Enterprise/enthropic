// =============================================================================
// Market Data Simulator Service (FIXED)
// File: apps/nats-gateway/src/services/market-simulator.service.ts
// =============================================================================
// Output format matches apps/dashboard/src/types/trading.ts MarketTick interface
// =============================================================================

import { connect, NatsConnection, JSONCodec } from 'nats';

// =============================================================================
// TYPES - Matching trading.ts MarketTick interface
// =============================================================================

export interface MarketTick {
    symbol: string;
    bidPrice: string;
    bidSize?: string;
    askPrice: string;
    askSize?: string;
    lastPrice: string;
    lastSize?: string;
    volume: string;
    high24h?: string;
    low24h?: string;
    change24h?: string;
    changePercent24h?: string;
    timestamp: number;  // Unix timestamp in milliseconds
}

interface InstrumentConfig {
    symbol: string;
    name: string;
    basePrice: number;
    volatility: number;
    spread: number;
    currency: string;
    tickSize: number;
}

// =============================================================================
// INSTRUMENT CONFIGURATIONS
// =============================================================================

const INSTRUMENTS: InstrumentConfig[] = [
    {
        symbol: 'BTC-USD',
        name: 'Bitcoin',
        basePrice: 95000,
        volatility: 2.5,
        spread: 0.05,
        currency: 'USD',
        tickSize: 0.01,
    },
    {
        symbol: 'ETH-USD',
        name: 'Ethereum',
        basePrice: 3500,
        volatility: 3.0,
        spread: 0.08,
        currency: 'USD',
        tickSize: 0.01,
    },
    {
        symbol: 'SPY',
        name: 'S&P 500 ETF',
        basePrice: 590,
        volatility: 0.8,
        spread: 0.02,
        currency: 'USD',
        tickSize: 0.01,
    },
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        basePrice: 185,
        volatility: 1.2,
        spread: 0.03,
        currency: 'USD',
        tickSize: 0.01,
    },
    {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        basePrice: 175,
        volatility: 1.5,
        spread: 0.03,
        currency: 'USD',
        tickSize: 0.01,
    },
    {
        symbol: 'BBRI.JK',
        name: 'Bank BRI',
        basePrice: 5250,
        volatility: 1.5,
        spread: 0.1,
        currency: 'IDR',
        tickSize: 25,
    },
    {
        symbol: 'BBCA.JK',
        name: 'Bank BCA',
        basePrice: 9875,
        volatility: 1.2,
        spread: 0.08,
        currency: 'IDR',
        tickSize: 25,
    },
    {
        symbol: 'TLKM.JK',
        name: 'Telkom Indonesia',
        basePrice: 3450,
        volatility: 1.0,
        spread: 0.12,
        currency: 'IDR',
        tickSize: 5,
    },
];

// =============================================================================
// MARKET SIMULATOR CLASS
// =============================================================================

export class MarketSimulator {
    private nc: NatsConnection | null = null;
    private jc = JSONCodec();
    private prices: Map<string, number> = new Map();
    private opens: Map<string, number> = new Map();
    private highs: Map<string, number> = new Map();
    private lows: Map<string, number> = new Map();
    private volumes: Map<string, number> = new Map();
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private running = false;
    private tickCount = 0;

    constructor(private natsUrl: string = 'nats://localhost:4222') {
        this.initializePrices();
    }

    private initializePrices(): void {
        INSTRUMENTS.forEach((inst) => {
            const openPrice = this.roundToTick(
                inst.basePrice * (1 + (Math.random() - 0.5) * 0.02),
                inst.tickSize
            );
            this.prices.set(inst.symbol, openPrice);
            this.opens.set(inst.symbol, openPrice);
            this.highs.set(inst.symbol, openPrice);
            this.lows.set(inst.symbol, openPrice);
            this.volumes.set(inst.symbol, 0);
        });
    }

    async connect(): Promise<void> {
        try {
            this.nc = await connect({ servers: this.natsUrl });
            console.log(`[MarketSimulator] Connected to NATS at ${this.natsUrl}`);
        } catch (error) {
            console.error('[MarketSimulator] Failed to connect to NATS:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        this.stop();
        if (this.nc) {
            await this.nc.drain();
            this.nc = null;
        }
        console.log('[MarketSimulator] Disconnected from NATS');
    }

    start(intervalMs: number = 1000): void {
        if (this.running) {
            console.log('[MarketSimulator] Already running');
            return;
        }

        this.running = true;
        console.log(`[MarketSimulator] Starting with ${intervalMs}ms interval`);

        INSTRUMENTS.forEach((inst) => {
            const delay = Math.random() * 500;

            setTimeout(() => {
                const interval = setInterval(() => {
                    this.generateAndPublishTick(inst);
                }, intervalMs + Math.random() * 200);

                this.intervals.set(inst.symbol, interval);
            }, delay);
        });
    }

    stop(): void {
        this.running = false;
        this.intervals.forEach((interval) => {
            clearInterval(interval);
        });
        this.intervals.clear();
        console.log(`[MarketSimulator] Stopped. Total ticks: ${this.tickCount}`);
    }

    private generateAndPublishTick(inst: InstrumentConfig): void {
        if (!this.nc || !this.running) return;

        const tick = this.generateTick(inst);

        // Publish to symbol-specific subject
        this.nc.publish(`market.tick.${inst.symbol}`, this.jc.encode(tick));

        // Publish to general market feed
        this.nc.publish('market.ticks', this.jc.encode(tick));

        this.tickCount++;

        if (this.tickCount % 100 === 0) {
            console.log(`[MarketSimulator] Published ${this.tickCount} ticks`);
        }
    }

    private generateTick(inst: InstrumentConfig): MarketTick {
        const currentPrice = this.prices.get(inst.symbol) || inst.basePrice;

        // Price movement with mean reversion
        const volatilityFactor = inst.volatility / 100;
        const randomChange = (Math.random() - 0.5) * 2 * volatilityFactor;
        const meanReversion = ((inst.basePrice - currentPrice) / inst.basePrice) * 0.01;
        const priceChange = currentPrice * (randomChange + meanReversion);

        const newPrice = this.roundToTick(
            Math.max(currentPrice + priceChange, inst.tickSize),
            inst.tickSize
        );

        // Calculate spread
        const spreadAmount = newPrice * (inst.spread / 100);
        const bidPrice = this.roundToTick(newPrice - spreadAmount / 2, inst.tickSize);
        const askPrice = this.roundToTick(newPrice + spreadAmount / 2, inst.tickSize);

        // Update tracking
        this.prices.set(inst.symbol, newPrice);

        const currentHigh = this.highs.get(inst.symbol) || newPrice;
        const currentLow = this.lows.get(inst.symbol) || newPrice;
        if (newPrice > currentHigh) this.highs.set(inst.symbol, newPrice);
        if (newPrice < currentLow) this.lows.set(inst.symbol, newPrice);

        // Volume
        const tradeSize = Math.floor(Math.random() * 100) + 1;
        const currentVolume = this.volumes.get(inst.symbol) || 0;
        this.volumes.set(inst.symbol, currentVolume + tradeSize);

        // Change from open
        const openPrice = this.opens.get(inst.symbol) || newPrice;
        const change = newPrice - openPrice;
        const changePercent = (change / openPrice) * 100;

        // Return format matching trading.ts MarketTick interface
        return {
            symbol: inst.symbol,
            timestamp: Date.now(),  // Unix timestamp (number)
            bidPrice: bidPrice.toFixed(2),
            bidSize: String(Math.floor(Math.random() * 1000) + 100),
            askPrice: askPrice.toFixed(2),
            askSize: String(Math.floor(Math.random() * 1000) + 100),
            lastPrice: newPrice.toFixed(2),
            lastSize: String(tradeSize),
            volume: String(this.volumes.get(inst.symbol) || 0),
            high24h: (this.highs.get(inst.symbol) || newPrice).toFixed(2),
            low24h: (this.lows.get(inst.symbol) || newPrice).toFixed(2),
            change24h: change.toFixed(2),
            changePercent24h: changePercent.toFixed(2),
        };
    }

    private roundToTick(value: number, tickSize: number): number {
        return Math.round(value / tickSize) * tickSize;
    }

    resetDaily(): void {
        INSTRUMENTS.forEach((inst) => {
            const currentPrice = this.prices.get(inst.symbol) || inst.basePrice;
            this.opens.set(inst.symbol, currentPrice);
            this.highs.set(inst.symbol, currentPrice);
            this.lows.set(inst.symbol, currentPrice);
            this.volumes.set(inst.symbol, 0);
        });
        console.log('[MarketSimulator] Daily data reset');
    }

    getSnapshot(): MarketTick[] {
        return INSTRUMENTS.map((inst) => this.generateTick(inst));
    }
}

// =============================================================================
// STANDALONE RUNNER
// =============================================================================

async function main() {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    const interval = parseInt(process.env.TICK_INTERVAL || '1000', 10);

    console.log('='.repeat(60));
    console.log('       ENTHROPIC MARKET DATA SIMULATOR');
    console.log('='.repeat(60));
    console.log(`NATS URL: ${natsUrl}`);
    console.log(`Tick Interval: ${interval}ms`);
    console.log('='.repeat(60));

    const simulator = new MarketSimulator(natsUrl);

    const shutdown = async () => {
        console.log('\n[MarketSimulator] Shutting down...');
        await simulator.disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await simulator.connect();
        simulator.start(interval);

        console.log('\nInstruments:');
        INSTRUMENTS.forEach((inst) => {
            console.log(`   ${inst.symbol.padEnd(10)} - ${inst.name} (${inst.currency})`);
        });
        console.log('\nPress Ctrl+C to stop');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('[MarketSimulator] Startup error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export default MarketSimulator;