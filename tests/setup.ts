/**
 * Test setup - mock logger to silence console output during tests
 */
import { vi } from 'vitest';

// Mock the logger module to prevent console noise during tests
vi.mock('../src/utils/logger', () => ({
  mcpLog: vi.fn()
}));
