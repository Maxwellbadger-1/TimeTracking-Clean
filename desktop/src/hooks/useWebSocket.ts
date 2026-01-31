import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// 🔥 VERSION MARKER - Beweist dass neue Version läuft
console.log('🚀 useWebSocket.ts LOADED - VERSION 3.0 (Post-Connection Auth) - ' + new Date().toISOString());

/**
 * WebSocket Hook for Real-Time Updates
 *
 * Professional real-time system (like Slack, Teams, Personio)
 * - Connects to WebSocket server on mount
 * - Authenticates with userId
 * - Auto-invalidates TanStack Query caches on backend events
 * - Automatic reconnection with exponential backoff
 * - Graceful degradation (app works without WebSocket)
 */

// Event Types (must match server/src/websocket/server.ts)
export type WSEventType =
  | 'overtime:updated'
  | 'time-entry:created'
  | 'time-entry:updated'
  | 'time-entry:deleted'
  | 'absence:created'
  | 'absence:approved'
  | 'absence:rejected'
  | 'correction:created'
  | 'correction:deleted';

export interface WSEvent {
  type: WSEventType;
  userId: number;
  data?: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  userId: number | undefined;
  enabled?: boolean; // Allow disabling WebSocket connection
}

interface UseWebSocketReturn {
  connected: boolean;
  reconnecting: boolean;
}

// WebSocket URL (development vs production)
const getWebSocketUrl = (): string => {
  console.log('[WebSocket] 🔥 getWebSocketUrl called (v3.0 - Post-Connection Auth)');
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  console.log('[WebSocket] baseUrl:', baseUrl);
  // Remove /api prefix if present (backend WebSocket is on /ws, not /api/ws)
  const cleanUrl = baseUrl.replace('/api', '');
  console.log('[WebSocket] cleanUrl:', cleanUrl);
  const wsUrl = cleanUrl.replace(/^http/, 'ws');
  console.log('[WebSocket] wsUrl:', wsUrl);

  const finalUrl = `${wsUrl}/ws`;
  console.log('[WebSocket] 🔥🔥🔥 v3.0 - Professional Post-Connection Auth 🔥🔥🔥 URL:', finalUrl);
  return finalUrl;
};

export function useWebSocket({ userId, enabled = true }: UseWebSocketOptions): UseWebSocketReturn {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // Start with 1 second

  /**
   * Invalidate TanStack Query caches based on event type
   */
  const handleEvent = useCallback((event: WSEvent) => {
    console.log('[WebSocket] Event received:', event.type, event);

    switch (event.type) {
      case 'time-entry:created':
      case 'time-entry:updated':
      case 'time-entry:deleted':
        // Invalidate time entries queries
        queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

        // Invalidate ALL overtime-related queries (comprehensive!)
        queryClient.invalidateQueries({ queryKey: ['overtime'] }); // matches ['overtime', 'corrections', ...], ['overtime', 'all', ...], ['overtime', 'aggregated', ...]
        queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] }); // Dashboard cards
        queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] }); // Year summaries
        queryClient.invalidateQueries({ queryKey: ['overtime-report'] }); // Reports page
        queryClient.invalidateQueries({ queryKey: ['overtime-history'] }); // History charts
        queryClient.invalidateQueries({ queryKey: ['overtime-year-breakdown'] }); // Year breakdown
        queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // Admin reports
        queryClient.invalidateQueries({ queryKey: ['overtime-transactions'] }); // Transaction history
        queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] }); // Work time accounts
        queryClient.invalidateQueries({ queryKey: ['vacationBalance'] });
        queryClient.invalidateQueries({ queryKey: ['currentOvertimeStats'] });
        queryClient.invalidateQueries({ queryKey: ['totalOvertime'] });
        queryClient.invalidateQueries({ queryKey: ['dailyOvertime'] });
        queryClient.invalidateQueries({ queryKey: ['weeklyOvertime'] });
        console.log('[WebSocket] Invalidated all caches after time entry event');
        break;

      case 'absence:created':
      case 'absence:approved':
      case 'absence:rejected':
        // Invalidate absence queries
        queryClient.invalidateQueries({ queryKey: ['absenceRequests'] });

        // Invalidate ALL overtime-related queries (absences affect overtime!)
        queryClient.invalidateQueries({ queryKey: ['overtime'] }); // matches ['overtime', 'corrections', ...], ['overtime', 'all', ...], ['overtime', 'aggregated', ...]
        queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] }); // Dashboard cards
        queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] }); // Year summaries
        queryClient.invalidateQueries({ queryKey: ['overtime-report'] }); // Reports page
        queryClient.invalidateQueries({ queryKey: ['overtime-history'] }); // History charts
        queryClient.invalidateQueries({ queryKey: ['overtime-year-breakdown'] }); // Year breakdown
        queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // Admin reports
        queryClient.invalidateQueries({ queryKey: ['overtime-transactions'] }); // Transaction history
        queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] }); // Work time accounts
        queryClient.invalidateQueries({ queryKey: ['vacationBalance'] });
        queryClient.invalidateQueries({ queryKey: ['vacation-balances'] }); // Admin page
        queryClient.invalidateQueries({ queryKey: ['currentOvertimeStats'] });
        console.log('[WebSocket] Invalidated ALL absence + overtime caches');
        break;

      case 'correction:created':
      case 'correction:deleted':
        // Invalidate ALL overtime-related queries (comprehensive!)
        queryClient.invalidateQueries({ queryKey: ['overtime'] }); // matches ['overtime', 'corrections', ...], ['overtime', 'all', ...], ['overtime', 'aggregated', ...]
        queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] }); // Dashboard cards
        queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] }); // Year summaries
        queryClient.invalidateQueries({ queryKey: ['overtime-report'] }); // Reports page
        queryClient.invalidateQueries({ queryKey: ['overtime-history'] }); // History charts
        queryClient.invalidateQueries({ queryKey: ['overtime-year-breakdown'] }); // Year breakdown
        queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // Admin reports
        queryClient.invalidateQueries({ queryKey: ['overtime-transactions'] }); // Transaction history
        queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] }); // Work time accounts
        console.log('[WebSocket] Invalidated ALL overtime caches (corrections)');
        break;

      case 'overtime:updated':
        // Invalidate all overtime-related queries
        queryClient.invalidateQueries({ queryKey: ['overtime'] });
        queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] });
        console.log('[WebSocket] Invalidated overtime caches');
        break;

      default:
        console.warn('[WebSocket] Unknown event type:', event.type);
    }
  }, [queryClient]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!enabled || !userId) {
      console.log('[WebSocket] Connection disabled or no userId');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      console.log('[WebSocket] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnected(true);
        setReconnecting(false);
        reconnectAttemptsRef.current = 0;

        // Send authentication message
        ws.send(JSON.stringify({
          type: 'auth',
          userId: userId,
        }));
        console.log('[WebSocket] Authentication sent for userId:', userId);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'auth:success') {
            console.log('[WebSocket] Authentication successful');
            return;
          }

          // Handle data events
          handleEvent(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          setReconnecting(true);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn('[WebSocket] Max reconnection attempts reached. Giving up.');
          setReconnecting(false);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      setConnected(false);
      setReconnecting(false);
    }
  }, [enabled, userId, handleEvent]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      console.log('[WebSocket] Disconnecting...');
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
      setReconnecting(false);
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected,
    reconnecting,
  };
}
