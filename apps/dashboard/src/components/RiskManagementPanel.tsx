// =============================================================================
// Risk Management Panel with Interactive Modal
// File: apps/dashboard/src/components/RiskManagementPanel.tsx
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Position } from '../types/trading';

interface RiskLimit {
    id: string;
    type: string;
    symbol?: string;
    limitValue: number;
    currentValue: number;
    utilization: number;
    status: 'ok' | 'warning' | 'critical';
}

interface RiskManagementPanelProps {
    positions: Position[];
    onEmergencyStop?: () => void;
}

export function RiskManagementPanel({ positions, onEmergencyStop }: RiskManagementPanelProps) {
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [riskLimits, setRiskLimits] = useState<RiskLimit[]>([]);
    const [loading, setLoading] = useState(false);
    const [confirmStop, setConfirmStop] = useState(false);

    // Calculate exposure from positions
    const calculateExposure = useCallback(() => {
        let totalLong = 0;
        let totalShort = 0;

        positions.forEach(p => {
            const qty = parseFloat(p.netQuantity);
            const price = parseFloat(p.avgPrice);
            const value = Math.abs(qty * price);

            if (qty > 0) totalLong += value;
            else if (qty < 0) totalShort += value;
        });

        return { totalLong, totalShort, netExposure: totalLong - totalShort, grossExposure: totalLong + totalShort };
    }, [positions]);

    // Mock risk limits - in production, fetch from API
    useEffect(() => {
        const exposure = calculateExposure();

        setRiskLimits([
            {
                id: '1',
                type: 'Max Position Size',
                limitValue: 1000000,
                currentValue: exposure.grossExposure,
                utilization: (exposure.grossExposure / 1000000) * 100,
                status: exposure.grossExposure > 800000 ? 'critical' : exposure.grossExposure > 500000 ? 'warning' : 'ok',
            },
            {
                id: '2',
                type: 'Max Daily Loss',
                limitValue: 50000,
                currentValue: 12500,
                utilization: 25,
                status: 'ok',
            },
            {
                id: '3',
                type: 'Max Order Size',
                limitValue: 100000,
                currentValue: 0,
                utilization: 0,
                status: 'ok',
            },
            {
                id: '4',
                type: 'Max Concentration',
                symbol: 'BTC-USD',
                limitValue: 500000,
                currentValue: 285000,
                utilization: 57,
                status: 'warning',
            },
        ]);
    }, [positions, calculateExposure]);

    const handleEmergencyStop = async () => {
        if (!confirmStop) {
            setConfirmStop(true);
            return;
        }

        setLoading(true);
        try {
            // In production, call API to cancel all orders and close positions
            if (onEmergencyStop) {
                onEmergencyStop();
            }
            alert('Emergency stop executed! All orders cancelled.');
        } catch (error) {
            console.error('Emergency stop failed:', error);
        } finally {
            setLoading(false);
            setConfirmStop(false);
        }
    };

    const getStatusColor = (status: RiskLimit['status']) => {
        switch (status) {
            case 'ok': return 'text-green-400 bg-green-500/20';
            case 'warning': return 'text-yellow-400 bg-yellow-500/20';
            case 'critical': return 'text-red-400 bg-red-500/20';
        }
    };

    const getBarColor = (utilization: number) => {
        if (utilization >= 80) return 'bg-red-500';
        if (utilization >= 50) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const formatCurrency = (value: number) => {
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const exposure = calculateExposure();

    return (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-400 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Risk Management
            </h3>

            <div className="space-y-2 text-sm">
                {/* View Risk Limits Button */}
                <button
                    onClick={() => setActiveModal('limits')}
                    className="w-full px-3 py-2 bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30 text-left flex justify-between items-center"
                >
                    <span>View Risk Limits</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* Position Exposure Button */}
                <button
                    onClick={() => setActiveModal('exposure')}
                    className="w-full px-3 py-2 bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30 text-left flex justify-between items-center"
                >
                    <span>Position Exposure</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* Emergency Stop Button */}
                <button
                    onClick={handleEmergencyStop}
                    disabled={loading}
                    className={`w-full px-3 py-2 rounded text-left transition-all ${
                        confirmStop
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                    }`}
                >
                    {loading ? (
                        <span className="flex items-center">
              <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Stopping...
            </span>
                    ) : confirmStop ? (
                        '⚠️ Click again to CONFIRM'
                    ) : (
                        'Emergency Stop All'
                    )}
                </button>
                {confirmStop && (
                    <button
                        onClick={() => setConfirmStop(false)}
                        className="w-full px-3 py-1 text-gray-400 text-xs hover:text-white"
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* Risk Limits Modal */}
            {activeModal === 'limits' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">Risk Limits</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-4">
                                {riskLimits.map(limit => (
                                    <div key={limit.id} className="bg-gray-700/50 rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="text-white font-medium">{limit.type}</h4>
                                                {limit.symbol && <span className="text-gray-400 text-sm">{limit.symbol}</span>}
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(limit.status)}`}>
                        {limit.status.toUpperCase()}
                      </span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                                            <span>Current: {formatCurrency(limit.currentValue)}</span>
                                            <span>Limit: {formatCurrency(limit.limitValue)}</span>
                                        </div>
                                        <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${getBarColor(limit.utilization)} transition-all`}
                                                style={{ width: `${Math.min(limit.utilization, 100)}%` }}
                                            />
                                        </div>
                                        <div className="text-right text-xs text-gray-500 mt-1">
                                            {limit.utilization.toFixed(1)}% utilized
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Position Exposure Modal */}
            {activeModal === 'exposure' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">Position Exposure</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                    <p className="text-green-400 text-sm mb-1">Long Exposure</p>
                                    <p className="text-2xl font-bold text-green-400">{formatCurrency(exposure.totalLong)}</p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                    <p className="text-red-400 text-sm mb-1">Short Exposure</p>
                                    <p className="text-2xl font-bold text-red-400">{formatCurrency(exposure.totalShort)}</p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <p className="text-blue-400 text-sm mb-1">Net Exposure</p>
                                    <p className={`text-2xl font-bold ${exposure.netExposure >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(exposure.netExposure)}
                                    </p>
                                </div>
                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                    <p className="text-purple-400 text-sm mb-1">Gross Exposure</p>
                                    <p className="text-2xl font-bold text-purple-400">{formatCurrency(exposure.grossExposure)}</p>
                                </div>
                            </div>

                            {/* Position Breakdown */}
                            <h3 className="text-white font-medium mb-3">Position Breakdown</h3>
                            {positions.length > 0 ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {positions.map(pos => {
                                        const qty = parseFloat(pos.netQuantity);
                                        const price = parseFloat(pos.avgPrice);
                                        const value = qty * price;
                                        const pnl = parseFloat(pos.unrealizedPnl) + parseFloat(pos.realizedPnl);

                                        return (
                                            <div key={`${pos.accountId}-${pos.symbol}`} className="bg-gray-700/50 rounded p-3 flex justify-between items-center">
                                                <div>
                                                    <span className="text-white font-medium">{pos.symbol}</span>
                                                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${qty > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {qty > 0 ? 'LONG' : 'SHORT'}
                          </span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-white">{formatCurrency(Math.abs(value))}</div>
                                                    <div className={`text-xs ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        P&L: {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">No open positions</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}