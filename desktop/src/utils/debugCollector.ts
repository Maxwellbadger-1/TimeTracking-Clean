/**
 * Debug Collector - Sammelt Debug-Logs und speichert sie
 */

import { debugLogger } from './debugLogger';

export function collectDebugReport() {
  const report = debugLogger.getReport();

  // Analyse der Logs
  const analysis = {
    timestamp: new Date().toISOString(),
    summary: report.summary,
    totalLogs: report.totalLogs,

    // API Requests
    apiRequests: report.logs
      .filter(log => log.location === 'useInfiniteTimeEntries:API_REQUEST')
      .map(log => ({
        time: log.timestamp,
        url: log.data.url,
        filters: log.data.filters,
        pageParam: log.data.pageParam,
      })),

    // API Responses
    apiResponses: report.logs
      .filter(log =>
        log.location === 'useInfiniteTimeEntries:API_RESPONSE_PAGINATED' ||
        log.location === 'useInfiniteTimeEntries:API_RESPONSE_ARRAY'
      )
      .map(log => ({
        time: log.timestamp,
        type: log.location.includes('ARRAY') ? 'array' : 'paginated',
        rowCount: log.data.rowCount,
        total: log.data.total,
        hasMore: log.data.hasMore,
        cursor: log.data.cursor,
        dateRange: {
          first: log.data.firstEntry?.date,
          last: log.data.lastEntry?.date,
        },
      })),

    // Next Page Params
    nextPageDecisions: report.logs
      .filter(log => log.location === 'useInfiniteTimeEntries:GET_NEXT_PAGE_PARAM')
      .map(log => ({
        time: log.timestamp,
        hasMore: log.data.hasMore,
        cursor: log.data.cursor,
        willFetchNext: log.data.willFetchNext,
      })),

    // Filter States
    filterStates: report.logs
      .filter(log => log.location === 'TimeEntriesPage:FILTER_STATE')
      .map(log => ({
        time: log.timestamp,
        userRole: log.data.userRole,
        filterEmployee: log.data.filterEmployee,
        apiUserId: log.data.apiUserId,
        dateRangePreset: log.data.dateRangePreset,
        startDate: log.data.startDate,
        endDate: log.data.endDate,
      })),

    // Flattened Entries
    flattenedEntries: report.logs
      .filter(log => log.location === 'TimeEntriesPage:FLATTENED_ENTRIES')
      .map(log => ({
        time: log.timestamp,
        totalLoaded: log.data.totalLoaded,
        pagesCount: log.data.pagesCount,
        hasNextPage: log.data.hasNextPage,
        lastPageHasMore: log.data.lastPageHasMore,
        pagesDetails: log.data.pagesDetails,
        dateRange: log.data.dateRange,
      })),

    // Filtered & Sorted
    filteredEntries: report.logs
      .filter(log => log.location === 'TimeEntriesPage:FILTERED_AND_SORTED')
      .map(log => ({
        time: log.timestamp,
        totalLoaded: log.data.totalLoaded,
        afterLocationFilter: log.data.afterLocationFilter,
        filterLocation: log.data.filterLocation,
        sortBy: log.data.sortBy,
        dateRange: log.data.dateRangeAfterSort,
      })),

    // Probleme identifizieren
    issues: [] as string[],
  };

  // Automatische Problem-Erkennung
  if (analysis.apiResponses.length > 0) {
    const lastResponse = analysis.apiResponses[analysis.apiResponses.length - 1];
    if (lastResponse.hasMore && analysis.nextPageDecisions.length > 0) {
      const lastDecision = analysis.nextPageDecisions[analysis.nextPageDecisions.length - 1];
      if (!lastDecision.willFetchNext) {
        analysis.issues.push(
          `❌ PROBLEM: Backend sagt hasMore=true, aber fetchNext wird NICHT aufgerufen!`
        );
      }
    }
  }

  if (analysis.flattenedEntries.length > 0) {
    const lastFlattened = analysis.flattenedEntries[analysis.flattenedEntries.length - 1];
    if (lastFlattened.hasNextPage === false && lastFlattened.lastPageHasMore === true) {
      analysis.issues.push(
        `❌ PROBLEM: React Query hasNextPage=false, aber Backend lastPageHasMore=true!`
      );
    }
  }

  if (analysis.apiRequests.length > 5) {
    const uniqueUrls = new Set(analysis.apiRequests.map(r => r.url));
    if (uniqueUrls.size < analysis.apiRequests.length / 2) {
      analysis.issues.push(
        `⚠️ WARNUNG: Viele duplizierte API Requests (${analysis.apiRequests.length} requests, nur ${uniqueUrls.size} unique URLs)`
      );
    }
  }

  return {
    fullReport: report,
    analysis,
  };
}

// Export Funktion für Browser Console
if (typeof window !== 'undefined') {
  (window as any).collectDebugReport = collectDebugReport;
  (window as any).downloadDebugReport = () => {
    const report = collectDebugReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-analysis-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('✅ Debug Report downloaded!');
  };
}
