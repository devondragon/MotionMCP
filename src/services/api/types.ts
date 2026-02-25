/**
 * Shared interfaces for the decomposed MotionApiService modules.
 *
 * These types enable resource modules to access the API client and caches
 * without depending on the monolithic MotionApiService class.
 */

import { AxiosInstance, AxiosResponse } from 'axios';
import { z } from 'zod';
import { SimpleCache } from '../../utils/cache';
import {
  MotionWorkspace,
  MotionProject,
  MotionUser,
  MotionComment,
  MotionCustomField,
  MotionRecurringTask,
  MotionSchedule,
  MotionStatus,
  MotionPaginatedResponse,
} from '../../types/motion';
import { TruncationInfo } from '../../types/mcp';
import { UserFacingError } from '../../utils/errors';

/**
 * API client interface — provides HTTP request infrastructure.
 *
 * The `client` property is exposed because all existing code uses the pattern:
 *   `requestWithRetry(() => client.get(...))`
 * where the request lambda captures the AxiosInstance directly.
 */
export interface IApiClient {
  /** The underlying Axios instance (needed for building request lambdas). */
  readonly client: AxiosInstance;

  /** Wraps an axios request with retry + exponential backoff (GET only). */
  requestWithRetry<T>(request: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>>;

  /** Validates API response data against a Zod schema. */
  validateResponse<T>(data: unknown, schema: z.ZodSchema<T>, context: string): T;

  /** Formats API errors with user-friendly messages. */
  formatApiError(
    error: unknown,
    action: string,
    resourceType?: 'task' | 'project' | 'workspace' | 'user' | 'comment' | 'custom field' | 'recurring task' | 'schedule' | 'status',
    resourceId?: string,
    resourceName?: string,
  ): UserFacingError;

  /** Merge truncation metadata from multiple paginated sources. */
  mergeTruncationMetadata(
    aggregate: TruncationInfo | undefined,
    source: TruncationInfo | undefined,
  ): TruncationInfo | undefined;
}

/**
 * Cache manager interface — typed accessors for all 9 cache instances.
 */
export interface ICacheManager {
  readonly workspace: SimpleCache<MotionWorkspace[]>;
  readonly user: SimpleCache<MotionUser[]>;
  readonly project: SimpleCache<MotionProject[]>;
  readonly singleProject: SimpleCache<MotionProject>;
  readonly comment: SimpleCache<MotionPaginatedResponse<MotionComment>>;
  readonly customField: SimpleCache<MotionCustomField[]>;
  readonly recurringTask: SimpleCache<MotionRecurringTask[]>;
  readonly schedule: SimpleCache<MotionSchedule[]>;
  readonly status: SimpleCache<MotionStatus[]>;
}

/**
 * Context object passed to every resource module function.
 * Provides access to the API client and cache manager.
 */
export interface ResourceContext {
  readonly api: IApiClient;
  readonly cache: ICacheManager;
}
