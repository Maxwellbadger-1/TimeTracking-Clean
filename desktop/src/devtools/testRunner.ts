/**
 * Test Runner Infrastructure
 *
 * Executes tests, manages concurrency, handles timeouts
 */

import { TestResult } from '../store/devToolStore';

export interface TestCase {
  id: string;
  name: string;
  category: string;
  description?: string;
  skip?: boolean;
  timeout?: number;
  run: () => Promise<void>;
}

export interface TestRunnerOptions {
  parallel?: boolean;
  maxConcurrent?: number;
  timeout?: number;
  onTestStart?: (test: TestCase) => void;
  onTestComplete?: (result: TestResult) => void;
  onProgress?: (completed: number, total: number) => void;
}

export class TestRunner {
  private options: Required<TestRunnerOptions>;
  private aborted = false;

  constructor(options: TestRunnerOptions = {}) {
    this.options = {
      parallel: options.parallel ?? true,
      maxConcurrent: options.maxConcurrent ?? 5,
      timeout: options.timeout ?? 30000,
      onTestStart: options.onTestStart ?? (() => {}),
      onTestComplete: options.onTestComplete ?? (() => {}),
      onProgress: options.onProgress ?? (() => {}),
    };
  }

  async runTests(tests: TestCase[]): Promise<TestResult[]> {
    this.aborted = false;
    const results: TestResult[] = [];

    if (this.options.parallel) {
      results.push(...(await this.runParallel(tests)));
    } else {
      results.push(...(await this.runSequential(tests)));
    }

    return results;
  }

  abort(): void {
    this.aborted = true;
  }

  private async runSequential(tests: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let completed = 0;

    for (const test of tests) {
      if (this.aborted) break;

      const result = await this.runSingleTest(test);
      results.push(result);
      completed++;
      this.options.onProgress(completed, tests.length);
    }

    return results;
  }

  private async runParallel(tests: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const queue = [...tests];
    let completed = 0;

    const runNext = async (): Promise<void> => {
      while (queue.length > 0 && !this.aborted) {
        const test = queue.shift();
        if (!test) break;

        const result = await this.runSingleTest(test);
        results.push(result);
        completed++;
        this.options.onProgress(completed, tests.length);
      }
    };

    // Create concurrent workers
    const workers = Array.from({ length: this.options.maxConcurrent }, () =>
      runNext()
    );
    await Promise.all(workers);

    return results;
  }

  private async runSingleTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    // Skip test if marked
    if (test.skip) {
      return {
        id: test.id,
        name: test.name,
        category: test.category,
        status: 'skipped',
        timestamp: Date.now(),
      };
    }

    // Notify start
    this.options.onTestStart(test);

    const result: TestResult = {
      id: test.id,
      name: test.name,
      category: test.category,
      status: 'running',
      timestamp: startTime,
    };

    try {
      // Run test with timeout
      const timeout = test.timeout ?? this.options.timeout;
      await this.runWithTimeout(test.run(), timeout);

      // Test passed
      result.status = 'passed';
      result.duration = Date.now() - startTime;
    } catch (error) {
      // Test failed
      result.status = 'failed';
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);
      result.details =
        error instanceof Error && error.stack ? error.stack : undefined;
    }

    // Notify completion
    this.options.onTestComplete(result);

    return result;
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Test timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }
}

/**
 * Test Assertion Helpers
 */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

export const assert = {
  isTrue: (value: boolean, message?: string) => {
    if (value !== true) {
      throw new AssertionError(message || `Expected true, got ${value}`);
    }
  },

  isFalse: (value: boolean, message?: string) => {
    if (value !== false) {
      throw new AssertionError(message || `Expected false, got ${value}`);
    }
  },

  equals: <T>(actual: T, expected: T, message?: string) => {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${expected}, got ${actual}`
      );
    }
  },

  notEquals: <T>(actual: T, expected: T, message?: string) => {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected not to equal ${expected}, but got ${actual}`
      );
    }
  },

  deepEquals: <T>(actual: T, expected: T, message?: string) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new AssertionError(
        message || `Expected ${expectedStr}, got ${actualStr}`
      );
    }
  },

  exists: <T>(value: T, message?: string) => {
    if (value === null || value === undefined) {
      throw new AssertionError(
        message || `Expected value to exist, got ${value}`
      );
    }
  },

  isNull: (value: unknown, message?: string) => {
    if (value !== null) {
      throw new AssertionError(message || `Expected null, got ${value}`);
    }
  },

  isUndefined: (value: unknown, message?: string) => {
    if (value !== undefined) {
      throw new AssertionError(message || `Expected undefined, got ${value}`);
    }
  },

  throws: async (fn: () => Promise<void> | void, message?: string) => {
    try {
      await fn();
      throw new AssertionError(message || 'Expected function to throw');
    } catch (error) {
      // Expected behavior - function threw
      if (error instanceof AssertionError && error.message.includes('Expected function to throw')) {
        throw error; // Re-throw if it's our assertion error
      }
      // Otherwise, test passed
    }
  },

  notThrows: async (fn: () => Promise<void> | void, message?: string) => {
    try {
      await fn();
    } catch (error) {
      throw new AssertionError(
        message || `Expected function not to throw, but got: ${error}`
      );
    }
  },

  includes: <T>(array: T[], value: T, message?: string) => {
    if (!array.includes(value)) {
      throw new AssertionError(
        message || `Expected array to include ${value}`
      );
    }
  },

  notIncludes: <T>(array: T[], value: T, message?: string) => {
    if (array.includes(value)) {
      throw new AssertionError(
        message || `Expected array not to include ${value}`
      );
    }
  },

  hasProperty: <T extends object>(
    obj: T,
    property: keyof T,
    message?: string
  ) => {
    if (!(property in obj)) {
      throw new AssertionError(
        message || `Expected object to have property ${String(property)}`
      );
    }
  },

  lengthEquals: <T>(array: T[], length: number, message?: string) => {
    if (array.length !== length) {
      throw new AssertionError(
        message || `Expected length ${length}, got ${array.length}`
      );
    }
  },

  greaterThan: (actual: number, expected: number, message?: string) => {
    if (actual <= expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be greater than ${expected}`
      );
    }
  },

  lessThan: (actual: number, expected: number, message?: string) => {
    if (actual >= expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be less than ${expected}`
      );
    }
  },

  matches: (actual: string, pattern: RegExp, message?: string) => {
    if (!pattern.test(actual)) {
      throw new AssertionError(
        message || `Expected "${actual}" to match ${pattern}`
      );
    }
  },

  isType: (value: unknown, type: string, message?: string) => {
    if (typeof value !== type) {
      throw new AssertionError(
        message || `Expected type ${type}, got ${typeof value}`
      );
    }
  },

  statusCode: (response: { status?: number }, expected: number, message?: string) => {
    if (response.status !== expected) {
      throw new AssertionError(
        message || `Expected status ${expected}, got ${response.status}`
      );
    }
  },

  success: (response: { success?: boolean }, message?: string) => {
    if (response.success !== true) {
      throw new AssertionError(
        message || `Expected success=true, got ${response.success}`
      );
    }
  },

  fail: (message: string) => {
    throw new AssertionError(message);
  },
};
