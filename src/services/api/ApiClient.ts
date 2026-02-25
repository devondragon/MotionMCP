/**
 * ApiClient — HTTP request infrastructure extracted from MotionApiService.
 *
 * Handles Axios setup, request interceptors, retry with exponential backoff,
 * response validation, and error formatting.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { z } from 'zod';
import { LOG_LEVELS, RETRY_CONFIG, API_CONFIG } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { TruncationInfo } from '../../types/mcp';
import { MotionApiErrorResponse } from '../../types/motion';
import { createUserFacingError, createErrorContext, UserFacingError } from '../../utils/errors';
import { VALIDATION_CONFIG } from '../../schemas/motion';
import { IApiClient } from './types';

/** Helper to get error message from unknown error type. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class ApiClient implements IApiClient {
  public readonly client: AxiosInstance;

  constructor(apiKey?: string) {
    const resolvedApiKey = apiKey || process.env.MOTION_API_KEY;

    if (!resolvedApiKey) {
      mcpLog(LOG_LEVELS.ERROR, 'Motion API key not found in environment variables', {
        component: 'MotionApiService',
        method: 'constructor'
      });
      throw new Error('MOTION_API_KEY environment variable is required');
    }

    const baseUrl = 'https://api.usemotion.com/v1';

    mcpLog(LOG_LEVELS.INFO, 'Initializing Motion API service', {
      component: 'MotionApiService',
      baseUrl
    });

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-API-Key': resolvedApiKey,
        'Content-Type': 'application/json'
      },
      timeout: API_CONFIG.TIMEOUT_MS
    });

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        mcpLog(LOG_LEVELS.INFO, 'Motion API response successful', {
          url: response.config?.url,
          method: response.config?.method?.toUpperCase(),
          status: response.status,
          component: 'MotionApiService'
        });
        return response;
      },
      (error: AxiosError<MotionApiErrorResponse>) => {
        const errorData = error.response?.data;
        const errorDetails = {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          apiMessage: errorData?.message,
          apiCode: errorData?.code,
          errorMessage: error.message,
          component: 'MotionApiService'
        };

        mcpLog(LOG_LEVELS.ERROR, 'Motion API request failed', errorDetails);

        // Re-throw original AxiosError so requestWithRetry can detect it
        // via axios.isAxiosError() for retry/rate-limit handling
        return Promise.reject(error);
      }
    );
  }

  validateResponse<T>(
    data: unknown,
    schema: z.ZodSchema<T>,
    context: string
  ): T {
    if (VALIDATION_CONFIG.mode === 'off') {
      return data as T;
    }

    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = {
          context,
          validationErrors: error.issues,
          ...(VALIDATION_CONFIG.includeDataInLogs ? { receivedData: data } : {})
        };

        if (VALIDATION_CONFIG.logErrors) {
          mcpLog(LOG_LEVELS.WARN, `API response validation failed for ${context}`, errorDetails);
        }

        if (VALIDATION_CONFIG.mode === 'strict') {
          throw new Error(`Invalid API response structure for ${context}: ${error.message}`);
        }

        // Lenient mode: return original data and hope for the best
        return data as T;
      }
      throw error;
    }
  }

  formatApiError(
    error: unknown,
    action: string,
    resourceType?: 'task' | 'project' | 'workspace' | 'user' | 'comment' | 'custom field' | 'recurring task' | 'schedule' | 'status',
    resourceId?: string,
    resourceName?: string
  ): UserFacingError {
    const context = createErrorContext(action, resourceType, resourceId, resourceName);
    return createUserFacingError(error, context);
  }

  async requestWithRetry<T>(request: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        return await request();
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error; // Not a network error, re-throw immediately
        }

        const status = error.response?.status;
        const requestMethod = error.config?.method?.toUpperCase() || 'GET';
        const isSafeMethod = requestMethod === 'GET';
        const isNetworkError = !error.response;
        const isRetryableStatus = status === 429 || (status !== undefined && status >= 500);
        const isRetryable = isSafeMethod && (isNetworkError || isRetryableStatus);

        if (!isRetryable || attempt === RETRY_CONFIG.MAX_RETRIES) {
          mcpLog(LOG_LEVELS.WARN, `Request failed and will not be retried`, {
            status,
            httpMethod: requestMethod,
            attempt,
            maxRetries: RETRY_CONFIG.MAX_RETRIES,
            isRetryable,
            component: 'MotionApiService',
            method: 'requestWithRetry'
          });
          throw error; // Final attempt failed or error is not retryable
        }

        // Handle Retry-After header for 429
        const retryAfterHeaderRaw = error.response?.headers['retry-after'];
        const retryAfterHeader = Array.isArray(retryAfterHeaderRaw) ? retryAfterHeaderRaw[0] : retryAfterHeaderRaw;
        let delay = 0;
        if (status === 429 && retryAfterHeader) {
          const retryAfterSeconds = Number(retryAfterHeader);
          if (!isNaN(retryAfterSeconds) && retryAfterSeconds >= 0) {
            delay = retryAfterSeconds * 1000;
          } else {
            const retryAfterDate = Date.parse(retryAfterHeader);
            if (!isNaN(retryAfterDate)) {
              delay = Math.max(0, retryAfterDate - Date.now());
            }
          }
        }

        // If no Retry-After header, use exponential backoff with jitter
        if (delay === 0) {
          const backoff = RETRY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
          const jitter = backoff * RETRY_CONFIG.JITTER_FACTOR * Math.random();
          delay = Math.min(backoff + jitter, RETRY_CONFIG.MAX_BACKOFF_MS);
        }

        mcpLog(LOG_LEVELS.INFO, `Request failed, retrying`, {
          attempt,
          maxRetries: RETRY_CONFIG.MAX_RETRIES,
          delayMs: Math.round(delay),
          error: error.message,
          status,
          httpMethod: requestMethod,
          isNetworkError,
          component: 'MotionApiService',
          method: 'requestWithRetry'
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript requires a return or throw
    throw new Error('Max retries exceeded');
  }

  mergeTruncationMetadata(
    aggregate: TruncationInfo | undefined,
    source: TruncationInfo | undefined
  ): TruncationInfo | undefined {
    if (!source?.wasTruncated) {
      return aggregate;
    }

    if (!aggregate?.wasTruncated) {
      return { ...source };
    }

    const merged: TruncationInfo = { ...aggregate, wasTruncated: true };

    if (aggregate.reason !== source.reason) {
      delete merged.reason;
      delete merged.limit;
      return merged;
    }

    if (source.reason !== undefined) {
      merged.reason = source.reason;
    }

    if (aggregate.limit !== source.limit) {
      delete merged.limit;
    } else if (source.limit !== undefined) {
      merged.limit = source.limit;
    }

    return merged;
  }
}
