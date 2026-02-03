// =============================================================================
// Market Data Panel Component
// File: apps/dashboard/src/components/MarketDataPanel.tsx
// =============================================================================
// Compatible with existing MarketTick type from types/trading.ts
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { MarketTick } from '../types/trading';

interface MarketDataPanelProps {
    ticks: Map<string, MarketTick>;
    onSubscribe?: (channel: string) => void;
}

const DEFAULT_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SPY', 'AAPL', 'GOOGL', 'BBRI.JK', 'BBCA.JK', 'TLKM.JK'];

export function MarketDataPanel({ ticks, onSubscribe }: MarketDataPanelProps) {
    const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(new Set());
    const [flashingPrices, setFlashingPrices] = useState<Map<string, 'up' | 'down' | null>>(new Map());
    const [previousPrices, setPreviousPrices] = useState<Map<string, string>>(new Map());

    // Handle symbol subscription
    const handleSubscribe = useCallback((symbol: string) => {
        if (subscribedSymbols.has(symbol)) return;

        setSubscribedSymbols((prev) => new Set(prev).add(symbol));
        if (onSubscribe) {
            onSubscribe(`market.tick.${symbol}`);
        }
    }, [subscribedSymbols, onSubscribe]);

    // Flash price on change
    useEffect(() => {
        const newFlashing = new Map<string, 'up' | 'down' | null>();

        ticks.forEach((tick, symbol) => {
            const prevPrice = previousPrices.get(symbol);
            if (prevPrice && prevPrice !== tick.lastPrice) {
                const current = parseFloat(tick.lastPrice);
                const prev = parseFloat(prevPrice);
                if (current > prev) {
                    newFlashing.set(symbol, 'up');
                } else if (current < prev) {
                    newFlashing.set(symbol, 'down');
                }
            }
        });

        setFlashingPrices(newFlashing);

        // Update previous prices
        const newPrevPrices = new Map<string, string>();
        ticks.forEach((tick, symbol) => {
            newPrevPrices.set(symbol, tick.lastPrice);
        });
        setPreviousPrices(newPrevPrices);

        // Clear flash after animation
        const timer = setTimeout(() => {
            setFlashingPrices(new Map());
        }, 500);

        return () => clearTimeout(timer);
    }, [ticks]);

    const formatPrice = (price: string | undefined, symbol: string): string => {
        if (!price) return '--';
        const numPrice = parseFloat(price);
        if (isNaN(numPrice)) return '--';

        // Format based on currency/asset type
        if (symbol.endsWith('.JK')) {
            return `Rp ${numPrice.toLocaleString('id-ID')}`;
        }
        return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatChange = (change: string | undefined, changePercent: string | undefined): string => {
        if (!change || !changePercent) return '--';
        const numChange = parseFloat(change);
        const numPercent = parseFloat(changePercent);
        if (isNaN(numChange) || isNaN(numPercent)) return '--';

        const sign = numChange >= 0 ? '+' : '';
        return `${sign}${numChange.toFixed(2)} (${sign}${numPercent.toFixed(2)}%)`;
    };

    const getChangeColor = (change: string | undefined): string => {
        if (!change) return 'text-gray-400';
        const numChange = parseFloat(change);
        if (isNaN(numChange)) return 'text-gray-400';
        if (numChange > 0) return 'text-green-400';
        if (numChange < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    const getFlashClass = (symbol: string): string => {
        const flash = flashingPrices.get(symbol);
        if (flash === 'up') return 'animate-pulse bg-green-500/10';
        if (flash === 'down') return 'animate-pulse bg-red-500/10';
        return '';
    };

    return (
        <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Market Data</h2>
                <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${ticks.size > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                    <span className="text-xs text-gray-400">{ticks.size > 0 ? 'Live' : 'Waiting...'}</span>
                </div>
            </div>

            {/* Market Data List */}
            <div className="space-y-2">
                {DEFAULT_SYMBOLS.map((symbol) => {
                    const tick = ticks.get(symbol);
                    const isSubscribed = subscribedSymbols.has(symbol);

                    return (
                        <div
                            key={symbol}
                            className={`p-3 rounded-lg border border-gray-700 transition-all ${getFlashClass(symbol)}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-white font-medium">{symbol}</span>
                                        {!tick && !isSubscribed && (
                                            <button
                                                onClick={() => handleSubscribe(symbol)}
                                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                Subscribe
                                            </button>
                                        )}
                                        {!tick && isSubscribed && (
                                            <span className="text-xs text-gray-500">Connecting...</span>
                                        )}
                                    </div>

                                    {tick ? (
                                        <div className="mt-1">
                                            <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-bold text-white">
                          {formatPrice(tick.lastPrice, symbol)}
                        </span>
                                                <span className={`text-sm ${getChangeColor(tick.change24h)}`}>
                          {formatChange(tick.change24h, tick.changePercent24h)}
                        </span>
                                            </div>
                                            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                                                <span>H: {formatPrice(tick.high24h, symbol)}</span>
                                                <span>L: {formatPrice(tick.low24h, symbol)}</span>
                                                <span>Vol: {tick.volume ? parseFloat(tick.volume).toLocaleString() : '--'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-1">
                                            <span className="text-gray-500 text-sm">--</span>
                                        </div>
                                    )}
                                </div>

                                {/* Bid/Ask Spread */}
                                {tick && (
                                    <div className="text-right text-xs">
                                        <div className="text-green-400">
                                            Bid: {parseFloat(tick.bidPrice).toFixed(2)}
                                        </div>
                                        <div className="text-red-400">
                                            Ask: {parseFloat(tick.askPrice).toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Subscribe All Button */}
            {subscribedSymbols.size < DEFAULT_SYMBOLS.length && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <button
                        onClick={() => DEFAULT_SYMBOLS.forEach(handleSubscribe)}
                        className="w-full py-2 text-sm bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                    >
                        Subscribe to All
                    </button>
                </div>
            )}
        </div>
    );
}