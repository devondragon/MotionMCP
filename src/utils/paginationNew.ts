/**
 * Enhanced Pagination Utilities with Proper Response Wrapper Support
 * 
 * This replaces the old pagination utility with proper handling of Motion API's
 * inconsistent response patterns using the ResponseWrapper utility.
 */

import { AxiosResponse } from 'axios';
import { mcpLog } from './logger';
import { LOG_LEVELS, LIMITS } from './constants';
import { unwrapApiResponse, supportsPagination, UnwrappedResponse } from './responseWrapper';
// MotionPaginationMeta is imported from responseWrapper via UnwrappedResponse

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalFetched: number;
}

export interface CursorPaginationOptions {
  maxPages?: number;
  pageSize?: number;
  logProgress?: boolean;
  maxItems?: number; // Maximum total items to collect to prevent memory exhaustion
}

/**
 * Enhanced pagination handler that properly uses response wrapper
 * 
 * @param fetchPage - Function that fetches a single page of data
 * @param apiEndpoint - The API endpoint name for proper response unwrapping
 * @param options - Pagination options
 * @returns All items from all pages with pagination metadata
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<AxiosResponse<any>>,
  apiEndpoint: string,
  options: CursorPaginationOptions = {}
): Promise<PaginatedResponse<T>> {
  const { maxPages = LIMITS.MAX_PAGES, logProgress = true, maxItems = LIMITS.MAX_PAGE_SIZE * 10 } = options;
  
  let allItems: T[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  let hasMore = true;
  
  // Infinite loop protection - ensure we never fetch more than absolute max pages
  const absoluteMaxPages = Math.min(maxPages, LIMITS.ABSOLUTE_MAX_PAGES); // Hard limit to prevent infinite loops
  
  while (hasMore && pageCount < absoluteMaxPages) {
    // Pre-fetch early termination: skip fetch if we've already reached maxItems
    if (allItems.length >= maxItems) {
      hasMore = false;
      break;
    }

    try {
      if (logProgress && pageCount > 0) {
        mcpLog(LOG_LEVELS.DEBUG, `Fetching page ${pageCount + 1} for ${apiEndpoint}`, {
          cursor,
          pageCount,
          itemsSoFar: allItems.length
        });
      }

      const response = await fetchPage(cursor);
      const unwrapped = unwrapApiResponse<T>(response.data, apiEndpoint);
      
      // Enforce page size limit to prevent memory exhaustion
      if (unwrapped.data.length > LIMITS.MAX_PAGE_SIZE) {
        mcpLog(LOG_LEVELS.WARN, `Page size ${unwrapped.data.length} exceeds maximum allowed ${LIMITS.MAX_PAGE_SIZE}, truncating`, {
          pageNumber: pageCount + 1,
          endpoint: apiEndpoint,
          originalSize: unwrapped.data.length,
          truncatedSize: LIMITS.MAX_PAGE_SIZE
        });
        unwrapped.data = unwrapped.data.slice(0, LIMITS.MAX_PAGE_SIZE);
      }
      
      // Add items to our collection, but check memory limits first
      const itemsToAdd = unwrapped.data;
      if (allItems.length + itemsToAdd.length > maxItems) {
        // Limit reached - add only what fits
        const remainingSlots = maxItems - allItems.length;
        if (remainingSlots > 0) {
          allItems.push(...itemsToAdd.slice(0, remainingSlots));
        }
        
        mcpLog(LOG_LEVELS.WARN, `Memory limit reached for ${apiEndpoint}, stopping pagination`, {
          totalItems: allItems.length,
          maxItems,
          pageCount: pageCount + 1,
          endpoint: apiEndpoint
        });
        
        hasMore = false;
      } else {
        allItems.push(...itemsToAdd);
      }
      pageCount++;
      
      // Determine if there are more pages
      if (unwrapped.meta?.nextCursor) {
        const newCursor = unwrapped.meta.nextCursor;
        
        // Additional safety: detect cursor not advancing (API bug protection)
        if (pageCount > 1 && cursor === newCursor) {
          mcpLog(LOG_LEVELS.WARN, `Cursor not advancing for ${apiEndpoint}, stopping pagination`, {
            oldCursor: cursor,
            newCursor,
            pageCount,
            endpoint: apiEndpoint
          });
          hasMore = false;
        } else {
          cursor = newCursor;
        }
      } else {
        hasMore = false;
      }
      
      // If we got no items on this page, stop
      if (unwrapped.data.length === 0) {
        hasMore = false;
      }
      
      if (logProgress) {
        mcpLog(LOG_LEVELS.DEBUG, `Page ${pageCount} fetched for ${apiEndpoint}`, {
          pageItems: unwrapped.data.length,
          totalItems: allItems.length,
          hasMore,
          nextCursor: cursor,
          endpoint: apiEndpoint
        });
      }
      
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, `Failed to fetch page ${pageCount + 1} for ${apiEndpoint}`, {
        error: error instanceof Error ? error.message : String(error),
        pageCount,
        cursor,
        endpoint: apiEndpoint
      });
      
      // Don't completely fail - return what we have so far
      hasMore = false;
    }
  }
  
  if (pageCount >= absoluteMaxPages && hasMore) {
    mcpLog(LOG_LEVELS.WARN, `Reached maximum page limit for ${apiEndpoint}`, {
      maxPages: absoluteMaxPages,
      totalItems: allItems.length,
      endpoint: apiEndpoint
    });
  }
  
  return {
    items: allItems,
    nextCursor: cursor,
    hasMore: hasMore && pageCount < absoluteMaxPages,
    totalFetched: allItems.length
  };
}

/**
 * Fetches a single page with proper response unwrapping
 * 
 * @param fetchPage - Function that fetches a single page
 * @param apiEndpoint - The API endpoint name for proper response unwrapping
 * @param cursor - Optional cursor for the specific page
 * @returns Single page of data with pagination metadata
 */
export async function fetchSinglePage<T>(
  fetchPage: (cursor?: string) => Promise<AxiosResponse<any>>,
  apiEndpoint: string,
  cursor?: string
): Promise<UnwrappedResponse<T>> {
  const response = await fetchPage(cursor);
  return unwrapApiResponse<T>(response.data, apiEndpoint);
}

/**
 * Check if an endpoint supports pagination
 */
export function endpointSupportsPagination(apiEndpoint: string): boolean {
  return supportsPagination(apiEndpoint);
}

// Legacy compatibility exports (to be removed when migration is complete)
export { UnwrappedResponse } from './responseWrapper';