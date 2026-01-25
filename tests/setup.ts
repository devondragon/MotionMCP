/**
 * Test setup - silence console output during tests
 */
import { vi, beforeEach } from 'vitest';

// Silence console.error globally to prevent logger noise during tests
// Individual tests can override this by spying on console.error themselves
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
