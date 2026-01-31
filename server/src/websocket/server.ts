/**
 * WebSocket Server for Real-Time Updates
 *
 * Professional Real-Time System (like Slack, Teams, Personio)
 * - Authenticated WebSocket connections
 * - Event-based broadcasts
 * - Automatic reconnection support
 * - Heartbeat for connection health
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import logger from '../utils/logger.js';
import { db } from '../database/connection.js';

// Typed WebSocket with User Info
interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  sessionId?: string;
  isAlive: boolean;
}

// Event Types
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

// Global WebSocket Server instance
let wss: WebSocketServer | null = null;

// Track connected clients by userId
const clients = new Map<number, Set<AuthenticatedWebSocket>>();

/**
 * Initialize WebSocket Server
 *
 * @param server - HTTP Server instance from Express
 */
export function initializeWebSocket(server: any): void {
  wss = new WebSocketServer({
    server,
    path: '/ws',
    // PROFESSIONAL APPROACH (like Slack, Discord, Teams):
    // - Accept all connections without pre-authentication
    // - Authentication happens AFTER connection via auth message
    // - Avoids cross-origin cookie issues
    // - Client sends userId from already-authenticated state
  });

  wss.on('connection', handleConnection);

  // Heartbeat mechanism (detect dead connections)
  const interval = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;

      if (authWs.isAlive === false) {
        logger.info(`Terminating dead WebSocket connection (userId: ${authWs.userId})`);
        return authWs.terminate();
      }

      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000); // Check every 30 seconds

  wss.on('close', () => {
    logger.info('WebSocket server closing...');
    clearInterval(interval);
  });

  logger.info('✅ WebSocket server initialized on /ws');
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws: WebSocket, req: IncomingMessage): void {
  const authWs = ws as AuthenticatedWebSocket;
  authWs.isAlive = true;

  logger.info('New WebSocket connection attempt');

  // Pong handler (keep-alive)
  authWs.on('pong', () => {
    authWs.isAlive = true;
  });

  // Message handler
  authWs.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());

      // Authentication: Client sends userId after connection
      if (data.type === 'auth' && data.userId) {
        authWs.userId = data.userId;
        registerClient(data.userId, authWs);

        authWs.send(JSON.stringify({
          type: 'auth:success',
          timestamp: new Date().toISOString()
        }));

        logger.info(`✅ WebSocket authenticated: userId=${data.userId}`);
      }
    } catch (error) {
      logger.error('WebSocket message parse error:', error);
    }
  });

  // Connection close handler
  authWs.on('close', () => {
    if (authWs.userId) {
      logger.info(`WebSocket disconnected: userId=${authWs.userId}`);
      unregisterClient(authWs.userId, authWs);
    }
  });

  // Error handler
  authWs.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
}

/**
 * Register a client connection
 */
function registerClient(userId: number, ws: AuthenticatedWebSocket): void {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(ws);

  logger.info(`Client registered: userId=${userId}, total connections=${clients.get(userId)!.size}`);
}

/**
 * Unregister a client connection
 */
function unregisterClient(userId: number, ws: AuthenticatedWebSocket): void {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(ws);
    if (userClients.size === 0) {
      clients.delete(userId);
      logger.info(`All clients disconnected for userId=${userId}`);
    }
  }
}

/**
 * MAIN API: Broadcast Event to specific user(s)
 *
 * This is called from services after mutations to notify connected clients
 *
 * @param event - Event to broadcast
 */
export function broadcastEvent(event: WSEvent): void {
  if (!wss) {
    // Graceful degradation: No WebSocket server (startup phase or disabled)
    return;
  }

  logger.info(`📨 Broadcasting event: ${event.type} (userId=${event.userId})`);

  const message = JSON.stringify(event);
  const sentToUsers = new Set<number>(); // Track who we've sent to (avoid duplicates)
  let totalSent = 0;

  // 1. Send to specific user's connections
  const userClients = clients.get(event.userId);
  if (userClients && userClients.size > 0) {
    userClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        totalSent++;
      }
    });
    sentToUsers.add(event.userId);
    logger.debug(`✅ Event sent to userId=${event.userId} (${userClients.size} connection(s))`);
  } else {
    logger.debug(`No active clients for userId=${event.userId}`);
  }

  // 2. Send to ALL admins (they need to see all events for monitoring)
  try {
    const admins = db.prepare('SELECT id FROM users WHERE role = ? AND deletedAt IS NULL').all('admin') as Array<{ id: number }>;

    admins.forEach(admin => {
      // Skip if we already sent to this user
      if (sentToUsers.has(admin.id)) {
        return;
      }

      const adminClients = clients.get(admin.id);
      if (adminClients && adminClients.size > 0) {
        adminClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            totalSent++;
          }
        });
        sentToUsers.add(admin.id);
        logger.debug(`✅ Event sent to admin userId=${admin.id} (${adminClients.size} connection(s))`);
      }
    });
  } catch (error) {
    logger.error('Failed to send event to admins:', error);
  }

  logger.info(`✅ Event broadcast complete: sent to ${totalSent} connection(s) across ${sentToUsers.size} user(s)`);
}

/**
 * Broadcast to ALL connected clients (admin use case)
 */
export function broadcastToAll(event: Omit<WSEvent, 'userId'>): void {
  if (!wss) return;

  logger.info(`📨 Broadcasting to ALL clients: ${event.type}`);

  const message = JSON.stringify({...event, userId: 0}); // userId=0 for broadcast
  let sentCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });

  logger.info(`✅ Broadcast sent to ${sentCount} client(s)`);
}

/**
 * Get connection statistics (for monitoring)
 */
export function getConnectionStats() {
  const totalConnections = Array.from(clients.values()).reduce((sum, set) => sum + set.size, 0);

  return {
    totalUsers: clients.size,
    totalConnections,
    clients: Array.from(clients.entries()).map(([userId, connections]) => ({
      userId,
      connections: connections.size
    }))
  };
}
