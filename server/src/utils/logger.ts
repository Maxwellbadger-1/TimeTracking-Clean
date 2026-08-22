/**
 * Production-Grade Logger using Pino
 *
 * Features:
 * - Environment-based log levels
 * - Structured JSON logging in production
 * - Pretty formatting in development
 * - High performance (5-10x faster than Winston)
 * - Zero overhead in production
 */

import pino from 'pino';

// Determine log level based on environment
const getLogLevel = (): string => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

// Create logger instance
const logger = pino({
  level: getLogLevel(),

  // Pretty formatting in development only
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined, // JSON in production (for log aggregation tools)

  // Base context
  base: {
    env: process.env.NODE_ENV || 'development',
  },

  // Redact sensitive fields
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie'],
    censor: '[REDACTED]',
  },

  /**
   * WR-06 (Code-Review Phase 11, Durchlauf 2): Fehler-Serializer für BEIDE Schlüssel.
   *
   * WARUM: pino wendet seinen Fehler-Serializer von Haus aus ausschließlich auf den
   * Schlüssel `err` an. Ein `Error` unter `error` — im Projekt an über 25 Stellen so
   * geschrieben — ging stattdessen durch `JSON.stringify`. `message` und `stack` sind auf
   * `Error` nicht aufzählbar; im Log stand deshalb `"error": {}`. Ein Lauf meldete damit
   * "übersprungen", ohne die geringste Angabe darüber, WAS schiefging.
   *
   * Statt über 25 Aufrufstellen einzeln umzuschreiben (und die nächste falsch
   * geschriebene wieder zu verlieren), trägt hier BEIDES: `err` wie bisher, `error`
   * zusätzlich. Die im Befund namentlich genannten sechs Zeilen sind trotzdem auf `err`
   * umgestellt — die Dauerlösung ersetzt nicht die richtige Schreibweise, sie fängt nur
   * die übrigen Stellen auf.
   *
   * `pino.stdSerializers.err` gibt Werte, die keine `Error`-Instanz sind, unverändert
   * zurück (nachgeprüft mit pino-std-serializers, s. `logger.error({ error:
   * validation.error }, …)` in `timeEntryService.ts:575`, wo eine Zeichenkette steht).
   * Die Ergänzung ist damit für Nicht-Fehler-Werte wirkungslos.
   */
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Create child logger with additional context
 * Useful for adding userId, requestId, etc.
 */
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

export default logger;
