/**
 * Search and resolution module — searchTasks, searchProjects,
 * resolveProjectIdentifier, resolveUserIdentifier
 */

import { MotionTask, MotionProject, MotionUser } from '../../types/motion';
import { LOG_LEVELS, LIMITS } from '../../utils/constants';
import { mcpLog } from '../../utils/logger';
import { calculateAdaptiveFetchLimit } from '../../utils/paginationNew';
import { TruncationInfo, ListResult } from '../../types/mcp';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';
import { getWorkspaces } from './workspaces';
import { getTasks } from './tasks';
import { getProjects, getProject, getProjectByName } from './projects';
import { getUsers } from './users';

export interface ResolveUserIdentifierOptions {
  strictWorkspace?: boolean;
}

export async function searchTasks(ctx: ResourceContext, query: string, workspaceId: string, limit?: number): Promise<ListResult<MotionTask>> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Searching tasks', {
      method: 'searchTasks',
      query,
      workspaceId,
      limit
    });

    // Apply search limit to prevent resource exhaustion
    const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
    const lowerQuery = query.toLowerCase();
    const allMatchingTasks: MotionTask[] = [];
    let aggregateTruncation: TruncationInfo | undefined;

    // First, search in the specified workspace
    const { items: primaryTasks, truncation: primaryTruncation } = await getTasks(ctx, {
      workspaceId,
      limit: calculateAdaptiveFetchLimit(allMatchingTasks.length, effectiveLimit),
      maxPages: LIMITS.MAX_PAGES
    });
    aggregateTruncation = ctx.api.mergeTruncationMetadata(aggregateTruncation, primaryTruncation);
    const primaryMatches = primaryTasks.filter(task =>
      task.name?.toLowerCase().includes(lowerQuery) ||
      task.description?.toLowerCase().includes(lowerQuery)
    );

    allMatchingTasks.push(...primaryMatches.slice(0, effectiveLimit));

    mcpLog(LOG_LEVELS.DEBUG, 'Primary workspace search completed', {
      method: 'searchTasks',
      query,
      primaryWorkspaceId: workspaceId,
      primaryMatches: primaryMatches.length,
      keptMatches: allMatchingTasks.length
    });

    // If we haven't reached the limit, search other workspaces
    if (allMatchingTasks.length < effectiveLimit) {
      try {
        const allWorkspaces = await getWorkspaces(ctx);
        const otherWorkspaces = allWorkspaces.filter(w => w.id !== workspaceId);

        for (const workspace of otherWorkspaces) {
          if (allMatchingTasks.length >= effectiveLimit) break;

          try {
            // Calculate fetch limit before API call (defense-in-depth)
            const fetchLimit = calculateAdaptiveFetchLimit(allMatchingTasks.length, effectiveLimit);
            if (fetchLimit <= 0) break;

            mcpLog(LOG_LEVELS.DEBUG, 'Searching additional workspace for tasks', {
              method: 'searchTasks',
              query,
              searchingWorkspaceId: workspace.id,
              searchingWorkspaceName: workspace.name,
              remainingNeeded: effectiveLimit - allMatchingTasks.length
            });

            const { items: workspaceTasks, truncation: wsTruncation } = await getTasks(ctx, {
              workspaceId: workspace.id,
              limit: fetchLimit,
              maxPages: LIMITS.MAX_PAGES
            });
            aggregateTruncation = ctx.api.mergeTruncationMetadata(aggregateTruncation, wsTruncation);
            const workspaceMatches = workspaceTasks.filter(task =>
              task.name?.toLowerCase().includes(lowerQuery) ||
              task.description?.toLowerCase().includes(lowerQuery)
            );

            // Only add as many as we still need
            const remaining = effectiveLimit - allMatchingTasks.length;
            allMatchingTasks.push(...workspaceMatches.slice(0, remaining));

            if (workspaceMatches.length > 0) {
              mcpLog(LOG_LEVELS.DEBUG, 'Found additional matches in workspace', {
                method: 'searchTasks',
                query,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                matches: workspaceMatches.length,
                keptMatches: Math.min(workspaceMatches.length, remaining)
              });
            }
          } catch (workspaceError: unknown) {
            // Log error but continue searching other workspaces
            mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for tasks', {
              method: 'searchTasks',
              query,
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              error: getErrorMessage(workspaceError)
            });
          }
        }
      } catch (workspaceListError: unknown) {
        mcpLog(LOG_LEVELS.WARN, 'Failed to get workspace list for cross-workspace search', {
          method: 'searchTasks',
          query,
          error: getErrorMessage(workspaceListError)
        });
      }
    }

    // Results are already limited during collection, no need to slice again
    mcpLog(LOG_LEVELS.INFO, 'Task search completed across all workspaces', {
      method: 'searchTasks',
      query,
      returnedResults: allMatchingTasks.length,
      limit: effectiveLimit
    });

    if (aggregateTruncation) {
      aggregateTruncation.returnedCount = allMatchingTasks.length;
    }
    return { items: allMatchingTasks, truncation: aggregateTruncation };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to search tasks', {
      method: 'searchTasks',
      query,
      error: getErrorMessage(error)
    });
    throw ctx.api.formatApiError(error, 'search', 'task');
  }
}

export async function searchProjects(ctx: ResourceContext, query: string, workspaceId: string, limit?: number): Promise<ListResult<MotionProject>> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Searching projects', {
      method: 'searchProjects',
      query,
      workspaceId,
      limit
    });

    // Apply search limit to prevent resource exhaustion
    const effectiveLimit = limit || LIMITS.MAX_SEARCH_RESULTS;
    const lowerQuery = query.toLowerCase();
    const allMatchingProjects: MotionProject[] = [];
    let aggregateTruncation: TruncationInfo | undefined;

    // First, search in the specified workspace
    const { items: primaryProjects, truncation: primaryTruncation } = await getProjects(ctx, workspaceId, {
      maxPages: LIMITS.MAX_PAGES,
      limit: calculateAdaptiveFetchLimit(allMatchingProjects.length, effectiveLimit)
    });
    aggregateTruncation = ctx.api.mergeTruncationMetadata(aggregateTruncation, primaryTruncation);
    const primaryMatches = primaryProjects.filter(project =>
      project.name?.toLowerCase().includes(lowerQuery) ||
      project.description?.toLowerCase().includes(lowerQuery)
    );

    allMatchingProjects.push(...primaryMatches.slice(0, effectiveLimit));

    mcpLog(LOG_LEVELS.DEBUG, 'Primary workspace search completed', {
      method: 'searchProjects',
      query,
      primaryWorkspaceId: workspaceId,
      primaryMatches: primaryMatches.length,
      keptMatches: allMatchingProjects.length
    });

    // If we haven't reached the limit, search other workspaces
    if (allMatchingProjects.length < effectiveLimit) {
      try {
        const allWorkspaces = await getWorkspaces(ctx);
        const otherWorkspaces = allWorkspaces.filter(w => w.id !== workspaceId);

        for (const workspace of otherWorkspaces) {
          if (allMatchingProjects.length >= effectiveLimit) break;

          try {
            // Calculate fetch limit before API call (defense-in-depth)
            const fetchLimit = calculateAdaptiveFetchLimit(allMatchingProjects.length, effectiveLimit);
            if (fetchLimit <= 0) break;

            mcpLog(LOG_LEVELS.DEBUG, 'Searching additional workspace for projects', {
              method: 'searchProjects',
              query,
              searchingWorkspaceId: workspace.id,
              searchingWorkspaceName: workspace.name,
              remainingNeeded: effectiveLimit - allMatchingProjects.length
            });

            const { items: workspaceProjects, truncation: wsTruncation } = await getProjects(ctx, workspace.id, {
              maxPages: LIMITS.MAX_PAGES,
              limit: fetchLimit
            });
            aggregateTruncation = ctx.api.mergeTruncationMetadata(aggregateTruncation, wsTruncation);
            const workspaceMatches = workspaceProjects.filter(project =>
              project.name?.toLowerCase().includes(lowerQuery) ||
              project.description?.toLowerCase().includes(lowerQuery)
            );

            // Only add as many as we still need
            const remaining = effectiveLimit - allMatchingProjects.length;
            allMatchingProjects.push(...workspaceMatches.slice(0, remaining));

            if (workspaceMatches.length > 0) {
              mcpLog(LOG_LEVELS.DEBUG, 'Found additional matches in workspace', {
                method: 'searchProjects',
                query,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                matches: workspaceMatches.length,
                keptMatches: Math.min(workspaceMatches.length, remaining)
              });
            }
          } catch (workspaceError: unknown) {
            // Log error but continue searching other workspaces
            mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for projects', {
              method: 'searchProjects',
              query,
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              error: getErrorMessage(workspaceError)
            });
          }
        }
      } catch (workspaceListError: unknown) {
        mcpLog(LOG_LEVELS.WARN, 'Failed to get workspace list for cross-workspace search', {
          method: 'searchProjects',
          query,
          error: getErrorMessage(workspaceListError)
        });
      }
    }

    // Results are already limited during collection, no need to slice again
    mcpLog(LOG_LEVELS.INFO, 'Project search completed across all workspaces', {
      method: 'searchProjects',
      query,
      returnedResults: allMatchingProjects.length,
      limit: effectiveLimit
    });

    if (aggregateTruncation) {
      aggregateTruncation.returnedCount = allMatchingProjects.length;
    }
    return { items: allMatchingProjects, truncation: aggregateTruncation };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to search projects', {
      method: 'searchProjects',
      query,
      error: getErrorMessage(error)
    });
    throw ctx.api.formatApiError(error, 'search', 'project');
  }
}

/**
 * Resolves a project identifier (either projectId or projectName) to a MotionProject
 * Searches across all workspaces if not found in the specified workspace
 */
export async function resolveProjectIdentifier(
  ctx: ResourceContext,
  identifier: { projectId?: string; projectName?: string },
  workspaceId?: string
): Promise<MotionProject | undefined> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Resolving project identifier', {
      method: 'resolveProjectIdentifier',
      projectId: identifier.projectId,
      projectName: identifier.projectName,
      workspaceId
    });

    // If projectId is provided, try to get it directly
    if (identifier.projectId) {
      try {
        const project = await getProject(ctx, identifier.projectId);
        mcpLog(LOG_LEVELS.INFO, 'Project resolved by ID', {
          method: 'resolveProjectIdentifier',
          projectId: identifier.projectId,
          projectName: project.name,
          workspaceId: project.workspaceId
        });
        return project;
      } catch (error: unknown) {
        mcpLog(LOG_LEVELS.WARN, 'Failed to resolve project by ID', {
          method: 'resolveProjectIdentifier',
          projectId: identifier.projectId,
          error: getErrorMessage(error)
        });
        // Fall through to projectName resolution if projectId fails
      }
    }

    // If projectName is provided (or projectId failed), resolve by name across workspaces
    if (identifier.projectName) {
      const project = await getProjectByName(ctx, identifier.projectName, workspaceId);
      if (project) {
        mcpLog(LOG_LEVELS.INFO, 'Project resolved by name across workspaces', {
          method: 'resolveProjectIdentifier',
          projectName: identifier.projectName,
          projectId: project.id,
          foundInWorkspaceId: project.workspaceId
        });
        return project;
      }
    }

    mcpLog(LOG_LEVELS.WARN, 'Failed to resolve project identifier', {
      method: 'resolveProjectIdentifier',
      projectId: identifier.projectId,
      projectName: identifier.projectName,
      workspaceId
    });

    return undefined;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Error resolving project identifier', {
      method: 'resolveProjectIdentifier',
      projectId: identifier.projectId,
      projectName: identifier.projectName,
      error: getErrorMessage(error)
    });
    throw error;
  }
}

/**
 * Resolves a user identifier (either userId or userName/email) to a MotionUser
 * Searches across all workspaces if not found in the specified workspace unless strictWorkspace is true
 */
export async function resolveUserIdentifier(
  ctx: ResourceContext,
  identifier: { userId?: string; userName?: string },
  workspaceId?: string,
  options?: ResolveUserIdentifierOptions
): Promise<MotionUser | undefined> {
  try {
    const strictWorkspace = options?.strictWorkspace === true;
    mcpLog(LOG_LEVELS.DEBUG, 'Resolving user identifier', {
      method: 'resolveUserIdentifier',
      userId: identifier.userId,
      userName: identifier.userName,
      workspaceId,
      strictWorkspace
    });

    // Build ordered workspace IDs: specified workspace first (or only when strict).
    const allWorkspaces = await getWorkspaces(ctx);
    let orderedWorkspaceIds: string[];
    if (workspaceId) {
      if (strictWorkspace) {
        orderedWorkspaceIds = [workspaceId];
      } else {
        const allWorkspaceIds = allWorkspaces.map(workspace => workspace.id);
        if (allWorkspaceIds.includes(workspaceId)) {
          const otherWorkspaceIds = allWorkspaceIds.filter(id => id !== workspaceId);
          orderedWorkspaceIds = [workspaceId, ...otherWorkspaceIds];
        } else {
          // Keep prior behavior when workspaceId is unknown: search known workspaces.
          orderedWorkspaceIds = allWorkspaceIds;
        }
      }
    } else {
      orderedWorkspaceIds = allWorkspaces.map(workspace => workspace.id);
    }

    // If userId is provided, search by ID
    if (identifier.userId) {
      for (const searchWorkspaceId of orderedWorkspaceIds) {
        try {
          const users = await getUsers(ctx, searchWorkspaceId);
          const user = users.find(u => u.id === identifier.userId);
          if (user) {
            mcpLog(LOG_LEVELS.INFO, 'User resolved by ID', {
              method: 'resolveUserIdentifier',
              userId: identifier.userId,
              userName: user.name,
              foundInWorkspaceId: searchWorkspaceId
            });
            return user;
          }
        } catch (workspaceError: unknown) {
          mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for user by ID', {
            method: 'resolveUserIdentifier',
            userId: identifier.userId,
            workspaceId: searchWorkspaceId,
            error: getErrorMessage(workspaceError)
          });
        }
      }
    }

    // If userName is provided, search by name/email
    if (identifier.userName) {
      const searchTerm = identifier.userName.toLowerCase();

      for (const searchWorkspaceId of orderedWorkspaceIds) {
        try {
          const users = await getUsers(ctx, searchWorkspaceId);
          const user = users.find(u =>
            u.name?.toLowerCase().includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm)
          );
          if (user) {
            mcpLog(LOG_LEVELS.INFO, 'User resolved by name/email', {
              method: 'resolveUserIdentifier',
              userName: identifier.userName,
              userId: user.id,
              foundInWorkspaceId: searchWorkspaceId
            });
            return user;
          }
        } catch (workspaceError: unknown) {
          mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for user by name', {
            method: 'resolveUserIdentifier',
            userName: identifier.userName,
            workspaceId: searchWorkspaceId,
            error: getErrorMessage(workspaceError)
          });
        }
      }
    }

    mcpLog(LOG_LEVELS.WARN, 'Failed to resolve user identifier', {
      method: 'resolveUserIdentifier',
      userId: identifier.userId,
      userName: identifier.userName,
      workspaceId
    });

    return undefined;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Error resolving user identifier', {
      method: 'resolveUserIdentifier',
      userId: identifier.userId,
      userName: identifier.userName,
      error: getErrorMessage(error)
    });
    throw error;
  }
}
