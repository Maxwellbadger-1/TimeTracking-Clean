/**
 * Comprehensive Debug Logger
 * Logs all critical data flow points to help diagnose issues
 */

interface DebugLog {
  timestamp: string;
  location: string;
  data: any;
}

class DebugLogger {
  private logs: DebugLog[] = [];
  private enabled = true;

  log(location: string, data: any) {
    if (!this.enabled) return;

    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      location,
      data,
    };

    this.logs.push(log);

    // Console output with clear formatting
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 LOCATION: ${location}
⏰ TIME: ${log.timestamp}
📦 DATA:
${JSON.stringify(data, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  getLogs() {
    return this.logs;
  }

  getReport() {
    return {
      totalLogs: this.logs.length,
      logs: this.logs,
      summary: this.generateSummary(),
    };
  }

  private generateSummary() {
    const byLocation: Record<string, number> = {};
    this.logs.forEach(log => {
      byLocation[log.location] = (byLocation[log.location] || 0) + 1;
    });
    return byLocation;
  }

  clear() {
    this.logs = [];
  }

  downloadReport() {
    const report = this.getReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-report-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const debugLogger = new DebugLogger();

// Make it available globally for easy access in browser console
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger;
}
