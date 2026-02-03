// =============================================================================
// useNatsWebSocket Hook
// File: apps/dashboard/src/hooks/useNatsWebSocket.ts
// =============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { Order, Position, MarketTick } from '../types/trading';

interface WebSocketMessage {
  type: string;
  data?: any;
  channel?: string;
  error?: string;
  code?: string;
}

interface UseNatsWebSocketReturn {
  connected: boolean;
  authenticated: boolean;
  positions: Position[];
  orders: Order[];
  marketTicks: Map<string, MarketTick>;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  submitOrder: (order: Omit<Order, 'id' | 'accountId' | 'createdAt' | 'status' | 'filledQuantity'>) => void;
  cancelOrder: (orderId: string) => void;
  connectionStatus: string;
  lastError: string | null;
}

const DEFAULT_MARKET_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SPY', 'AAPL', 'GOOGL', 'BBRI.JK', 'BBCA.JK', 'TLKM.JK'];

export function useNatsWebSocket(): UseNatsWebSocketReturn {
  const { accessToken, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());

  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [marketTicks, setMarketTicks] = useState<Map<string, MarketTick>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);

  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

  // ==========================================================================
  // MESSAGE HANDLER
  // ==========================================================================
  const handleMessage = useCallback((msg: WebSocketMessage) => {
    console.log(`[WS] Received: ${msg.type}`, msg.channel || '');

    switch (msg.type) {
      case 'authenticated':
        setAuthenticated(true);
        setConnectionStatus('authenticated');
        console.log('[WS] Authentication successful');
        break;

      case 'subscribed':
        console.log(`[WS] Subscribed to: ${msg.channel}`);
        break;

      case 'message':
        handleChannelMessage(msg);
        break;

      case 'order_submitted':
        console.log('[WS] Order submitted:', msg.data);
        break;

      case 'cancel_submitted':
        console.log('[WS] Cancel submitted:', msg.data);
        break;

      case 'error':
        console.error(`[WS] Error: ${msg.code} - ${msg.error}`);
        setLastError(`${msg.code}: ${msg.error}`);
        break;

      default:
        console.warn(`[WS] Unknown message type: ${msg.type}`);
    }
  }, []);

  const handleChannelMessage = useCallback((msg: WebSocketMessage) => {
    const { channel, data } = msg;
    if (!channel || !data) return;

    // Position updates
    if (channel.startsWith('positions.')) {
      console.log('[WS] Position update:', data);
      if (Array.isArray(data.positions)) {
        setPositions(data.positions);
      } else if (data.symbol) {
        setPositions((prev) => {
          const idx = prev.findIndex(
              (p) => p.symbol === data.symbol && p.accountId === data.accountId
          );
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data;
            return updated;
          }
          return [...prev, data];
        });
      }
      return;
    }

    // Order updates
    if (channel.startsWith('orders.')) {
      console.log('[WS] Order update:', data);
      if (data.id) {
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === data.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data;
            return updated;
          }
          return [data, ...prev].slice(0, 100);
        });
      }
      return;
    }

    // Market tick updates
    if (channel.startsWith('market.tick.') || channel === 'market.ticks') {
      const tick = data as MarketTick;
      if (tick?.symbol) {
        setMarketTicks((prev) => {
          const updated = new Map(prev);
          updated.set(tick.symbol, tick);
          return updated;
        });
      }
      return;
    }
  }, []);

  // ==========================================================================
  // CONNECTION
  // ==========================================================================
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log(`[WS] Connecting to ${WS_URL}...`);
    setConnectionStatus('connecting');
    setLastError(null);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
        setConnectionStatus('connected');

        if (accessToken) {
          console.log('[WS] Authenticating...');
          ws.send(JSON.stringify({ type: 'authenticate', token: accessToken }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WS] Closed: ${event.code}`);
        setConnected(false);
        setAuthenticated(false);
        setConnectionStatus('disconnected');
        subscribedChannelsRef.current.clear();

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        if (isAuthenticated) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WS] Reconnecting...');
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setLastError('Connection error');
        setConnectionStatus('error');
      };
    } catch (error) {
      console.error('[WS] Failed to connect:', error);
      setLastError('Failed to connect');
      setConnectionStatus('error');
    }
  }, [accessToken, WS_URL, handleMessage, isAuthenticated]);

  // ==========================================================================
  // SUBSCRIBE / UNSUBSCRIBE
  // ==========================================================================
  const subscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !authenticated) {
      return;
    }
    if (subscribedChannelsRef.current.has(channel)) {
      return;
    }

    console.log(`[WS] Subscribing to ${channel}`);
    wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
    subscribedChannelsRef.current.add(channel);
  }, [authenticated]);

  const unsubscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
    subscribedChannelsRef.current.delete(channel);
  }, []);

  // ==========================================================================
  // ORDER OPERATIONS
  // ==========================================================================
  const submitOrder = useCallback(
      (order: Omit<Order, 'id' | 'accountId' | 'createdAt' | 'status' | 'filledQuantity'>) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN || !authenticated) {
          console.error('[WS] Cannot submit: not connected/authenticated');
          setLastError('Not connected');
          return;
        }

        console.log('[WS] Submitting order:', order);
        wsRef.current.send(JSON.stringify({ type: 'order', data: order }));
      },
      [authenticated]
  );

  const cancelOrder = useCallback(
      (orderId: string) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN || !authenticated) {
          return;
        }

        console.log(`[WS] Cancelling order: ${orderId}`);
        wsRef.current.send(JSON.stringify({ type: 'cancel', orderId }));
      },
      [authenticated]
  );

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [isAuthenticated, connect]);

  // Re-authenticate on token change
  useEffect(() => {
    if (connected && accessToken && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'authenticate', token: accessToken }));
    }
  }, [accessToken, connected]);

  // Auto-subscribe to market data
  useEffect(() => {
    if (authenticated) {
      const timer = setTimeout(() => {
        DEFAULT_MARKET_SYMBOLS.forEach((symbol) => {
          subscribe(`market.tick.${symbol}`);
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [authenticated, subscribe]);

  return {
    connected,
    authenticated,
    positions,
    orders,
    marketTicks,
    subscribe,
    unsubscribe,
    submitOrder,
    cancelOrder,
    connectionStatus,
    lastError,
  };
}