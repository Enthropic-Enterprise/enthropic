// =============================================================================
// P&L Chart Component
// File: apps/dashboard/src/components/PnLChart.tsx
// =============================================================================
// Compatible with existing Position type from types/trading.ts
// All numeric fields are strings in the type
// =============================================================================

import React, { useMemo } from 'react';
import { Position } from '../types/trading';

interface PnLChartProps {
  positions: Position[];
}

export function PnLChart({ positions }: PnLChartProps) {
  // Helper to safely parse string to number
  const parseNum = (val: string | undefined): number => {
    if (!val) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  // Calculate P&L summary
  const pnlSummary = useMemo(() => {
    const unrealized = positions.reduce((sum, p) => sum + parseNum(p.unrealizedPnl), 0);
    const realized = positions.reduce((sum, p) => sum + parseNum(p.realizedPnl), 0);
    const total = unrealized + realized;

    return { unrealized, realized, total };
  }, [positions]);

  const formatCurrency = (value: number): string => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getPnlColor = (value: number): string => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getPnlBgColor = (value: number): string => {
    if (value > 0) return 'bg-green-500';
    if (value < 0) return 'bg-red-500';
    return 'bg-gray-500';
  };

  // Calculate bar widths for visualization
  const maxAbsValue = Math.max(
      Math.abs(pnlSummary.unrealized),
      Math.abs(pnlSummary.realized),
      1 // Prevent division by zero
  );

  const unrealizedWidth = (Math.abs(pnlSummary.unrealized) / maxAbsValue) * 100;
  const realizedWidth = (Math.abs(pnlSummary.realized) / maxAbsValue) * 100;

  return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">P&L Summary</h2>

        {/* P&L Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Unrealized */}
          <div className="bg-gray-700/30 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Unrealized</p>
            <p className={`text-2xl font-bold ${getPnlColor(pnlSummary.unrealized)}`}>
              {formatCurrency(pnlSummary.unrealized)}
            </p>
          </div>

          {/* Realized */}
          <div className="bg-gray-700/30 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Realized</p>
            <p className={`text-2xl font-bold ${getPnlColor(pnlSummary.realized)}`}>
              {formatCurrency(pnlSummary.realized)}
            </p>
          </div>

          {/* Total */}
          <div className="bg-gray-700/30 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Total</p>
            <p className={`text-2xl font-bold ${getPnlColor(pnlSummary.total)}`}>
              {formatCurrency(pnlSummary.total)}
            </p>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="space-y-3">
          {/* Unrealized Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Unrealized P&L</span>
              <span className={getPnlColor(pnlSummary.unrealized)}>
              {formatCurrency(pnlSummary.unrealized)}
            </span>
            </div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                  className={`h-full ${getPnlBgColor(pnlSummary.unrealized)} transition-all duration-500 rounded-full`}
                  style={{ width: `${Math.max(unrealizedWidth, 2)}%` }}
              />
            </div>
          </div>

          {/* Realized Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Realized P&L</span>
              <span className={getPnlColor(pnlSummary.realized)}>
              {formatCurrency(pnlSummary.realized)}
            </span>
            </div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                  className={`h-full ${getPnlBgColor(pnlSummary.realized)} transition-all duration-500 rounded-full`}
                  style={{ width: `${Math.max(realizedWidth, 2)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Position Breakdown */}
        {positions.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-3">P&L by Position</h3>
              <div className="space-y-2">
                {positions.slice(0, 5).map((pos) => {
                  const totalPnl = parseNum(pos.unrealizedPnl) + parseNum(pos.realizedPnl);
                  const qty = parseNum(pos.netQuantity);
                  return (
                      <div key={`${pos.accountId}-${pos.symbol}`} className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${getPnlBgColor(totalPnl)}`} />
                          <span className="text-white text-sm">{pos.symbol}</span>
                          <span className="text-gray-500 text-xs">
                      ({qty > 0 ? 'Long' : qty < 0 ? 'Short' : 'Flat'})
                    </span>
                        </div>
                        <span className={`text-sm font-medium ${getPnlColor(totalPnl)}`}>
                    {formatCurrency(totalPnl)}
                  </span>
                      </div>
                  );
                })}
                {positions.length > 5 && (
                    <p className="text-gray-500 text-xs text-center pt-2">
                      +{positions.length - 5} more positions
                    </p>
                )}
              </div>
            </div>
        )}

        {/* Empty State */}
        {positions.length === 0 && (
            <div className="text-center py-8">
              <svg
                  className="w-12 h-12 text-gray-600 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
              >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-gray-500 text-sm">No positions to display</p>
            </div>
        )}
      </div>
  );
}