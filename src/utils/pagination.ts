/**
 * Pagination Utilities - Shared pagination logic for Motion API calls
 * 
 * Provides utilities to handle cursor-based and offset-based pagination
 * consistently across all API endpoints.
 */

import { AxiosResponse } from 'axios';
import { mcpLog } from './logger';
import { LOG_LEVELS } from './constants';

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalFetched: number;
}

export interface PaginationMeta {
  nextCursor?: string;
  hasMore?: boolean;
  total?: number;
  page?: number;
  limit?: number;
}

export interface CursorPaginationOptions {
  maxPages?: number;
  pageSize?: number;
  logProgress?: boolean;
}

export interface PaginatedApiResponse<T> {
  meta?: PaginationMeta;
  items?: T[];
  tasks?: T[];
  projects?: T[];
  users?: T[];
  comments?: T[];
  customFields?: T[];
  recurringTasks?: T[];
  schedules?: T[];
  statuses?: T[];
}

/**
 * Generic cursor-based pagination handler
 * Automatically fetches all pages or up to maxPages limit
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<AxiosResponse<PaginatedApiResponse<T>>>,
  options: CursorPaginationOptions = {}
): Promise<PaginatedResponse<T>> {
  const { maxPages = 10, logProgress = true } = options;
  
  let allItems: T[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  let hasMore = true;
  
  while (hasMore && pageCount < maxPages) {
    try {
      if (logProgress && pageCount > 0) {
        mcpLog(LOG_LEVELS.DEBUG, `Fetching page ${pageCount + 1}`, { cursor });
      }
      
      const response = await fetchPage(cursor);
      const data = response.data;
      
      // Extract items from various possible response structures
      const pageItems = extractItemsFromResponse(data);
      allItems = allItems.concat(pageItems);
      
      // Update pagination state
      cursor = data.meta?.nextCursor;
      hasMore = !!cursor && pageItems.length > 0;
      pageCount++;
      
      if (logProgress) {
        mcpLog(LOG_LEVELS.DEBUG, `Page ${pageCount} fetched`, {
          pageItems: pageItems.length,
          totalItems: allItems.length,
          hasMore,
          nextCursor: cursor
        });
      }
      
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, `Pagination failed on page ${pageCount + 1}`, {
        error: error instanceof Error ? error.message : String(error),
        cursor
      });
      
      // Return what we have so far
      break;
    }
  }
  
  if (pageCount >= maxPages && hasMore) {
    mcpLog(LOG_LEVELS.WARN, `Reached maximum page limit (${maxPages})`, {
      totalFetched: allItems.length,
      finalCursor: cursor
    });
  }
  
  return {
    items: allItems,
    nextCursor: cursor,
    hasMore,
    totalFetched: allItems.length
  };
}

/**
 * Extract items from various API response structures
 * Handles the different ways Motion API can structure responses
 */
function extractItemsFromResponse<T>(data: PaginatedApiResponse<T>): T[] {
  // Try different possible array locations
  if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
  if (data.projects && Array.isArray(data.projects)) return data.projects;
  if (data.users && Array.isArray(data.users)) return data.users;
  if (data.comments && Array.isArray(data.comments)) return data.comments;
  if (data.customFields && Array.isArray(data.customFields)) return data.customFields;
  if (data.recurringTasks && Array.isArray(data.recurringTasks)) return data.recurringTasks;
  if (data.schedules && Array.isArray(data.schedules)) return data.schedules;
  if (data.statuses && Array.isArray(data.statuses)) return data.statuses;
  if (data.items && Array.isArray(data.items)) return data.items;
  
  // Fallback: if data itself is an array
  if (Array.isArray(data)) return data as T[];
  
  // No items found
  return [];
}

/**
 * Simple pagination for APIs that might not have explicit pagination
 * but could benefit from batching large requests
 */
export interface BatchOptions {
  batchSize?: number;
  maxBatches?: number;
  delayMs?: number;
}

export async function fetchInBatches<T, TParams>(
  fetchBatch: (params: TParams, offset: number, limit: number) => Promise<T[]>,
  params: TParams,
  options: BatchOptions = {}
): Promise<T[]> {
  const { batchSize = 100, maxBatches = 10, delayMs = 100 } = options;
  
  let allItems: T[] = [];
  let offset = 0;
  let batchCount = 0;
  let hasMore = true;
  
  while (hasMore && batchCount < maxBatches) {
    try {
      const batchItems = await fetchBatch(params, offset, batchSize);
      
      if (batchItems.length === 0) {
        hasMore = false;
      } else {
        allItems = allItems.concat(batchItems);
        offset += batchSize;
        batchCount++;
        
        // Small delay to be API-friendly
        if (delayMs > 0 && hasMore) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        // If we got fewer items than batch size, we've reached the end
        if (batchItems.length < batchSize) {
          hasMore = false;
        }
      }
      
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, `Batch fetch failed at offset ${offset}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      break;
    }
  }
  
  return allItems;
}

/**
 * Check if a response indicates more pages are available
 */
export function hasMorePages<T>(response: PaginatedApiResponse<T>): boolean {
  return !!(response.meta?.nextCursor || response.meta?.hasMore);
}

/**
 * Get pagination info from response
 */
export function getPaginationInfo<T>(response: PaginatedApiResponse<T>): PaginationMeta | null {
  return response.meta || null;
}