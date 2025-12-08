/**
 * DevTool Panel Component
 *
 * Comprehensive QA testing dashboard with:
 * - Test execution
 * - Real-time results
 * - Statistics
 * - Export functionality
 */

import { useState } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Download,
  Settings,
  X,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Copy,
  FileText,
  Filter,
} from 'lucide-react';
import { useDevToolStore } from '../../store/devToolStore';
import { TestRunner } from '../../devtools/testRunner';
import { allTests, getTestsByCategory } from '../../devtools/tests';

export default function DevToolPanel() {
  const {
    settings,
    isRunning,
    testResults,
    categories,
    isVisible,
    setVisible,
    startTests,
    stopTests,
    clearResults,
    addTestResult,
    updateTestResult,
    getStatistics,
  } = useDevToolStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [testRunner, setTestRunner] = useState<TestRunner | null>(null);
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const stats = getStatistics();

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Run all tests
  const handleRunAll = async () => {
    startTests();
    clearResults();

    const runner = new TestRunner({
      parallel: settings.parallelExecution,
      maxConcurrent: settings.maxConcurrent,
      timeout: settings.testTimeout,
      onTestStart: (test) => {
        addTestResult({
          id: test.id,
          name: test.name,
          category: test.category,
          status: 'running',
          timestamp: Date.now(),
        });
      },
      onTestComplete: (result) => {
        updateTestResult(result.id, result);
      },
      onProgress: (completed, total) => {
        console.log(`Progress: ${completed}/${total}`);
      },
    });

    setTestRunner(runner);

    try {
      await runner.runTests(allTests);
    } finally {
      stopTests();
      setTestRunner(null);
    }
  };

  // Run tests for specific category
  const handleRunCategory = async (categoryId: string) => {
    startTests(categoryId);

    const testsToRun = getTestsByCategory(categoryId);

    const runner = new TestRunner({
      parallel: settings.parallelExecution,
      maxConcurrent: settings.maxConcurrent,
      timeout: settings.testTimeout,
      onTestStart: (test) => {
        addTestResult({
          id: test.id,
          name: test.name,
          category: test.category,
          status: 'running',
          timestamp: Date.now(),
        });
      },
      onTestComplete: (result) => {
        updateTestResult(result.id, result);
      },
    });

    setTestRunner(runner);

    try {
      await runner.runTests(testsToRun);
    } finally {
      stopTests();
      setTestRunner(null);
    }
  };

  // Stop running tests
  const handleStop = () => {
    if (testRunner) {
      testRunner.abort();
    }
    stopTests();
  };

  // Export results as JSON (all or failed only)
  const handleExportJSON = (onlyFailed = false) => {
    const resultsToExport = onlyFailed
      ? testResults.filter((r) => r.status === 'failed')
      : testResults;

    const exportData = {
      timestamp: new Date().toISOString(),
      filter: onlyFailed ? 'failed-only' : 'all',
      statistics: stats,
      results: resultsToExport,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = onlyFailed ? 'failed' : 'all';
    a.download = `devtool-results-${suffix}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export failed tests as readable text
  const handleExportFailedText = () => {
    const failedTests = testResults.filter((r) => r.status === 'failed');

    if (failedTests.length === 0) {
      alert('Keine fehlgeschlagenen Tests zum Exportieren!');
      return;
    }

    let text = '='.repeat(80) + '\n';
    text += 'FEHLGESCHLAGENE TESTS - DEVTOOL BERICHT\n';
    text += '='.repeat(80) + '\n\n';
    text += `Zeitstempel: ${new Date().toISOString()}\n`;
    text += `Anzahl: ${failedTests.length} fehlgeschlagene Tests\n`;
    text += `Success Rate: ${stats.successRate.toFixed(1)}%\n\n`;

    failedTests.forEach((test, index) => {
      text += '-'.repeat(80) + '\n';
      text += `${index + 1}. ${test.name}\n`;
      text += '-'.repeat(80) + '\n';
      text += `Test-ID: ${test.id}\n`;
      text += `Kategorie: ${test.category}\n`;
      text += `Status: FAILED ❌\n`;
      if (test.duration) {
        text += `Dauer: ${test.duration}ms\n`;
      }
      text += `\nFehler:\n${test.error || 'Kein Fehlertext verfügbar'}\n`;
      if (test.details) {
        text += `\nDetails:\n${test.details}\n`;
      }
      text += '\n';
    });

    text += '='.repeat(80) + '\n';
    text += 'ENDE DES BERICHTS\n';
    text += '='.repeat(80) + '\n';

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devtool-failed-tests-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy failed tests to clipboard
  const handleCopyFailed = async () => {
    const failedTests = testResults.filter((r) => r.status === 'failed');

    if (failedTests.length === 0) {
      alert('Keine fehlgeschlagenen Tests zum Kopieren!');
      return;
    }

    let text = 'FEHLGESCHLAGENE TESTS:\n\n';
    failedTests.forEach((test, index) => {
      text += `${index + 1}. [${test.category}] ${test.name}\n`;
      text += `   ID: ${test.id}\n`;
      text += `   Fehler: ${test.error || 'N/A'}\n\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Kopieren fehlgeschlagen. Bitte Browser-Berechtigungen prüfen.');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              QA Dev Tool
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Comprehensive Test Suite
            </span>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Statistics Bar */}
        <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.passed}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.failed}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.running}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Running</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.skipped}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Skipped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Success</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
          {!isRunning ? (
            <button
              onClick={handleRunAll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Run All Tests
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}

          <button
            onClick={clearResults}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>

          <button
            onClick={() => setShowOnlyFailed(!showOnlyFailed)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showOnlyFailed
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            {showOnlyFailed ? 'Show All' : 'Only Failed'}
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[200px]">
              <button
                onClick={() => handleExportJSON(false)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export All (JSON)
              </button>
              <button
                onClick={() => handleExportJSON(true)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Failed (JSON)
              </button>
              <button
                onClick={handleExportFailedText}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Export Failed (Text)
              </button>
            </div>
          </div>

          <button
            onClick={handleCopyFailed}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              copySuccess
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Copy className="w-4 h-4" />
            {copySuccess ? 'Copied!' : 'Copy Failed'}
          </button>

          {isRunning && (
            <div className="ml-auto flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Running tests...</span>
            </div>
          )}
        </div>

        {/* Test Categories & Results */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {categories.map((category) => {
              const isExpanded = expandedCategories.has(category.id);
              const categoryResults = testResults
                .filter((r) => r.category === category.id)
                .filter((r) => !showOnlyFailed || r.status === 'failed');

              return (
                <div
                  key={category.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Category Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {category.passed}
                        </span>
                        {' / '}
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {category.failed}
                        </span>
                        {' / '}
                        <span className="text-gray-500 dark:text-gray-400">
                          {category.testCount}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunCategory(category.id);
                        }}
                        disabled={isRunning}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-3 h-3" />
                        Run
                      </button>
                    </div>
                  </div>

                  {/* Category Results */}
                  {isExpanded && categoryResults.length > 0 && (
                    <div className="p-4 space-y-2 bg-white dark:bg-gray-800">
                      {categoryResults.map((result) => (
                        <div
                          key={result.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            result.status === 'passed'
                              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                              : result.status === 'failed'
                              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                              : result.status === 'running'
                              ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                          }`}
                        >
                          {result.status === 'passed' && (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          )}
                          {result.status === 'failed' && (
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                          )}
                          {result.status === 'running' && (
                            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                          )}
                          {result.status === 'skipped' && (
                            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {result.name}
                            </div>
                            {result.error && (
                              <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {result.error}
                              </div>
                            )}
                          </div>

                          {result.duration !== undefined && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {result.duration}ms
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
