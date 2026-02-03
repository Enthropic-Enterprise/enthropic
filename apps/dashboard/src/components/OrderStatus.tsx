// =============================================================================
// Order Status Component with Trading Form
// File: apps/dashboard/src/components/OrderStatus.tsx
// =============================================================================
// Compatible with existing Order type from types/trading.ts
// Compatible with useNatsWebSocket hook signature
// =============================================================================

import React, { useState, useCallback } from 'react';
import { Order, OrderSide, OrderType } from '../types/trading';

// Type matching useNatsWebSocket submitOrder signature
type OrderSubmission = Omit<Order, 'id' | 'accountId' | 'createdAt' | 'status' | 'filledQuantity'>;

interface OrderStatusProps {
  orders: Order[];
  onSubmitOrder?: (order: OrderSubmission) => void;
  onCancelOrder?: (orderId: string) => void;
}

const SYMBOLS = [
  'BTC-USD',
  'ETH-USD',
  'SPY',
  'AAPL',
  'GOOGL',
  'BBRI.JK',
  'BBCA.JK',
  'TLKM.JK',
];

// Generate unique client order ID
const generateClientOrderId = (): string => {
  return `CLT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export function OrderStatus({ orders, onSubmitOrder, onCancelOrder }: OrderStatusProps) {
  const [symbol, setSymbol] = useState<string>('BTC-USD');
  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitOrder) return;

    // Validate inputs
    const qtyNum = parseFloat(quantity);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (orderType === 'limit') {
      const priceNum = parseFloat(price);
      if (!price || isNaN(priceNum) || priceNum <= 0) {
        setError('Please enter a valid price for limit order');
        return;
      }
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      // Build order matching Omit<Order, 'id' | 'accountId' | 'createdAt' | 'status' | 'filledQuantity'>
      const order: OrderSubmission = {
        clientOrderId: generateClientOrderId(),
        symbol,
        side,
        orderType,
        quantity, // string as per trading.ts
        timeInForce: 'GTC',
      };

      // Add price only for limit orders
      if (orderType === 'limit' && price) {
        order.price = price;
      }

      onSubmitOrder(order);

      setSuccess(`${side.toUpperCase()} order submitted successfully!`);
      setQuantity('1');
      setPrice('');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitOrder, symbol, side, orderType, quantity, price]);

  const handleCancel = useCallback((orderId: string) => {
    if (!onCancelOrder) return;
    onCancelOrder(orderId);
  }, [onCancelOrder]);

  const getStatusColor = (status: Order['status']): string => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      accepted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      partially_filled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      filled: 'bg-green-500/20 text-green-400 border-green-500/30',
      cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
      expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[status] || colors.pending;
  };

  const formatQuantity = (qty: string, filled: string): string => {
    const qtyNum = parseFloat(qty);
    const filledNum = parseFloat(filled);
    if (isNaN(qtyNum)) return qty;
    if (isNaN(filledNum)) return `0/${qtyNum}`;
    return `${filledNum}/${qtyNum}`;
  };

  const formatPrice = (priceStr: string | undefined): string => {
    if (!priceStr) return 'MKT';
    const num = parseFloat(priceStr);
    if (isNaN(num)) return priceStr;
    return `$${num.toFixed(2)}`;
  };

  const openOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'partially_filled' || o.status === 'accepted'
  );

  return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Order Entry</h2>

        {/* Order Entry Form */}
        {onSubmitOrder && (
            <form onSubmit={handleSubmit} className="space-y-3 mb-4">
              {/* Symbol & Side Row */}
              <div className="grid grid-cols-2 gap-2">
                <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                >
                  {SYMBOLS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                    value={side}
                    onChange={(e) => setSide(e.target.value as OrderSide)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                        side === 'buy'
                            ? 'bg-green-600/20 border-green-500/50 text-green-400'
                            : 'bg-red-600/20 border-red-500/50 text-red-400'
                    }`}
                >
                  <option value="buy">BUY</option>
                  <option value="sell">SELL</option>
                </select>
              </div>

              {/* Order Type & Quantity */}
              <div className="grid grid-cols-2 gap-2">
                <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as OrderType)}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                >
                  <option value="limit">Limit</option>
                  <option value="market">Market</option>
                </select>

                <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Quantity"
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    required
                />
              </div>

              {/* Price (for limit orders) */}
              {orderType === 'limit' && (
                  <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Price"
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      required
                  />
              )}

              {/* Success Message */}
              {success && (
                  <div className="flex items-center text-green-400 text-sm bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/30">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {success}
                  </div>
              )}

              {/* Error Message */}
              {error && (
                  <div className="flex items-center text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/30">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
              )}

              {/* Submit Button */}
              <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-3 rounded-lg font-medium text-sm transition-all shadow-lg ${
                      side === 'buy'
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/25'
                          : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submitting ? (
                    <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </span>
                ) : (
                    `${side.toUpperCase()} ${symbol}`
                )}
              </button>
            </form>
        )}

        {/* Open Orders List */}
        <div className="border-t border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-400">Open Orders</h3>
            <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
            {openOrders.length}
          </span>
          </div>

          {openOrders.length === 0 ? (
              <div className="text-center py-6">
                <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-500 text-sm">No open orders</p>
              </div>
          ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {openOrders.map((order) => (
                    <div key={order.id} className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                      <span className={`font-medium text-sm ${order.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {order.side.toUpperCase()}
                      </span>
                            <span className="text-white text-sm font-medium">{order.symbol}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs border ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-gray-400">
                            <span>{formatQuantity(order.quantity, order.filledQuantity)}</span>
                            <span>@</span>
                            <span>{formatPrice(order.price)}</span>
                          </div>
                        </div>

                        {onCancelOrder && (order.status === 'pending' || order.status === 'accepted') && (
                            <button
                                onClick={() => handleCancel(order.id)}
                                className="text-gray-400 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded transition-colors"
                                title="Cancel Order"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                        )}
                      </div>
                    </div>
                ))}
              </div>
          )}
        </div>
      </div>
  );
}