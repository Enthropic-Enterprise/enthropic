// =============================================================================
// Positions Table Component
// File: apps/dashboard/src/components/PositionsTable.tsx
// =============================================================================
// Compatible with existing Position type from types/trading.ts
// All numeric fields are strings in the type
// =============================================================================

import React from 'react';
import { Position } from '../types/trading';

interface PositionsTableProps {
  positions: Position[];
  showAllAccounts?: boolean;
}

export function PositionsTable({ positions, showAllAccounts = false }: PositionsTableProps) {
  // Helper to safely parse string to number
  const parseNum = (val: string | undefined): number => {
    if (!val) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  // Calculate totals (string -> number for calculations)
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + parseNum(p.unrealizedPnl), 0);
  const totalRealizedPnl = positions.reduce((sum, p) => sum + parseNum(p.realizedPnl), 0);
  const totalPnl = totalUnrealizedPnl + totalRealizedPnl;

  const formatCurrency = (value: number): string => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatQuantity = (value: string): string => {
    const num = parseNum(value);
    return Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    });
  };

  const formatPrice = (value: string | undefined): string => {
    if (!value) return '--';
    const num = parseNum(value);
    return `$${num.toFixed(2)}`;
  };

  const getPnlColor = (value: number): string => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getPositionType = (quantity: string): { label: string; color: string } => {
    const qty = parseNum(quantity);
    if (qty > 0) return { label: 'LONG', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    if (qty < 0) return { label: 'SHORT', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    return { label: 'FLAT', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  };

  return (
      <div className="bg-gray-800 rounded-lg p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-white">Positions</h2>
            {showAllAccounts && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
              All Accounts
            </span>
            )}
          </div>

          {positions.length > 0 && (
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-gray-400">Unrealized: </span>
                  <span className={getPnlColor(totalUnrealizedPnl)}>
                {formatCurrency(totalUnrealizedPnl)}
              </span>
                </div>
                <div>
                  <span className="text-gray-400">Realized: </span>
                  <span className={getPnlColor(totalRealizedPnl)}>
                {formatCurrency(totalRealizedPnl)}
              </span>
                </div>
                <div className="pl-3 border-l border-gray-700">
                  <span className="text-gray-400">Total: </span>
                  <span className={`font-semibold ${getPnlColor(totalPnl)}`}>
                {formatCurrency(totalPnl)}
              </span>
                </div>
              </div>
          )}
        </div>

        {/* Empty State */}
        {positions.length === 0 ? (
            <div className="text-center py-12">
              <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
              >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-gray-400 text-lg mb-1">No open positions</p>
              <p className="text-gray-500 text-sm">Submit an order to open a position</p>
            </div>
        ) : (
            /* Positions Table */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  {showAllAccounts && <th className="text-left py-3 px-3 font-medium">Account</th>}
                  <th className="text-left py-3 px-3 font-medium">Symbol</th>
                  <th className="text-left py-3 px-3 font-medium">Type</th>
                  <th className="text-right py-3 px-3 font-medium">Quantity</th>
                  <th className="text-right py-3 px-3 font-medium">Avg Price</th>
                  <th className="text-right py-3 px-3 font-medium">Current</th>
                  <th className="text-right py-3 px-3 font-medium">Unrealized P&L</th>
                  <th className="text-right py-3 px-3 font-medium">Realized P&L</th>
                </tr>
                </thead>
                <tbody>
                {positions.map((position) => {
                  const posType = getPositionType(position.netQuantity);
                  const unrealizedPnl = parseNum(position.unrealizedPnl);
                  const realizedPnl = parseNum(position.realizedPnl);

                  return (
                      <tr
                          key={`${position.accountId}-${position.symbol}`}
                          className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                      >
                        {showAllAccounts && (
                            <td className="py-3 px-3">
                        <span className="text-gray-300">
                          {position.accountId.length > 8
                              ? `${position.accountId.slice(0, 8)}...`
                              : position.accountId}
                        </span>
                            </td>
                        )}
                        <td className="py-3 px-3">
                          <span className="text-white font-medium">{position.symbol}</span>
                        </td>
                        <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs border ${posType.color}`}>
                        {posType.label}
                      </span>
                        </td>
                        <td className="py-3 px-3 text-right text-white font-mono">
                          {formatQuantity(position.netQuantity)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-300 font-mono">
                          {formatPrice(position.avgPrice)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-300 font-mono">
                          {formatPrice(position.currentPrice)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${getPnlColor(unrealizedPnl)}`}>
                          {formatCurrency(unrealizedPnl)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${getPnlColor(realizedPnl)}`}>
                          {formatCurrency(realizedPnl)}
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}

        {/* Export Button */}
        {positions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
              <button className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Export CSV</span>
              </button>
            </div>
        )}
      </div>
  );
}