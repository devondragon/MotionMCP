/**
 * Centralized MCP-compliant logger
 * Outputs structured JSON logs to stderr as required by MCP protocol
 */

import { LogLevel } from './constants';

const SENSITIVE_FIELDS = ['apiKey', 'password', 'token', 'secret', 'authorization'];

/**
 * Sanitizes sensitive information from log data
 */
function sanitizeLogData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Check if key contains sensitive field names
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * MCP-compliant logger that outputs to stderr in JSON format
 * @param level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param message - Log message
 * @param extra - Additional context data
 */
export const mcpLog = (level: LogLevel, message: string, extra: Record<string, any> = {}): void => {
  const sanitizedExtra = sanitizeLogData(extra);
  
  const logEntry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...sanitizedExtra
  };
  
  // MCP servers should log to stderr in JSON format
  console.error(JSON.stringify(logEntry));
};