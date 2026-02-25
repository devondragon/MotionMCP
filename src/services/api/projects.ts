/**
 * Project resource module — getProjects, getAllProjects, getProject, createProject,
 * updateProject, deleteProject, getProjectByName
 */

import { AxiosResponse, isAxiosError } from 'axios';
import { MotionProject } from '../../types/motion';
import { LOG_LEVELS, createMinimalPayload, LIMITS } from '../../utils/constants';
import { UserFacingError } from '../../utils/errors';
import { mcpLog } from '../../utils/logger';
import { fetchAllPages as fetchAllPagesNew } from '../../utils/paginationNew';
import { unwrapApiResponse } from '../../utils/responseWrapper';
import { TruncationInfo, ListResult } from '../../types/mcp';
import { ResourceContext } from './types';
import { getErrorMessage } from './ApiClient';
import { getWorkspaces } from './workspaces';

export async function getProjects(ctx: ResourceContext, workspaceId: string, options?: { maxPages?: number; limit?: number }): Promise<ListResult<MotionProject>> {
  const { maxPages = LIMITS.MAX_PAGES, limit } = options || {};

  // Validate limit parameter if provided
  if (limit !== undefined && (limit < 0 || !Number.isInteger(limit))) {
    throw new Error('limit must be a non-negative integer');
  }

  const cacheKey = `projects:workspace:${workspaceId}:maxPages:${maxPages ?? 'default'}:limit:${limit ?? 'none'}`;

  // Check cache - return items only (no stale truncation info)
  const cachedItems = ctx.cache.project.get(cacheKey);
  if (cachedItems !== null) {
    return { items: cachedItems };
  }

  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from Motion API', {
      method: 'getProjects',
      workspaceId,
      maxPages,
      limit
    });

    // Create a fetch function for potential pagination
    const fetchPage = async (cursor?: string) => {
      const params = new URLSearchParams();
      params.append('workspaceId', workspaceId);
      if (cursor) {
        params.append('cursor', cursor);
      }

      const queryString = params.toString();
      const url = `/projects?${queryString}`;

      return ctx.api.requestWithRetry(() => ctx.api.client.get(url));
    };

    try {
      // Attempt pagination-aware fetch with new response wrapper
      const paginatedResult = await fetchAllPagesNew<MotionProject>(fetchPage, 'projects', {
        maxPages,
        logProgress: false,
        ...(limit ? { maxItems: limit } : {})
      });

      const projects = paginatedResult.items;

      mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully with pagination', {
        method: 'getProjects',
        totalCount: projects.length,
        hasMore: paginatedResult.hasMore,
        workspaceId
      });

      // Cache only items, not truncation metadata
      ctx.cache.project.set(cacheKey, projects);
      return { items: projects, truncation: paginatedResult.truncation };
    } catch (paginationError) {
      // Fallback to simple fetch if pagination fails — results may be incomplete
      mcpLog(LOG_LEVELS.WARN, 'Pagination failed, falling back to single-page fetch', {
        method: 'getProjects',
        error: paginationError instanceof Error ? paginationError.message : String(paginationError)
      });
    }

    // Use new response wrapper for single page fallback
    const response = await fetchPage();
    const unwrapped = unwrapApiResponse<MotionProject>(response.data, 'projects');
    let projects = unwrapped.data;

    mcpLog(LOG_LEVELS.INFO, 'Projects fetched successfully (single page)', {
      method: 'getProjects',
      count: projects.length,
      workspaceId
    });

    // Do not cache fallback results. If pagination failed, this may be only the first page.
    return { items: projects, truncation: { wasTruncated: true, returnedCount: projects.length, reason: 'error' } };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch projects', {
      method: 'getProjects',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
    });
    throw ctx.api.formatApiError(error, 'fetch', 'project');
  }
}

export async function getAllProjects(ctx: ResourceContext): Promise<ListResult<MotionProject>> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching projects from all workspaces', {
      method: 'getAllProjects'
    });

    const allWorkspaces = await getWorkspaces(ctx);
    const allProjects: MotionProject[] = [];
    let aggregateTruncation: TruncationInfo | undefined;

    for (const workspace of allWorkspaces) {
      try {
        const { items, truncation } = await getProjects(ctx, workspace.id);
        allProjects.push(...items);
        aggregateTruncation = ctx.api.mergeTruncationMetadata(aggregateTruncation, truncation);
      } catch (workspaceError: unknown) {
        // Log error but continue with other workspaces
        mcpLog(LOG_LEVELS.WARN, 'Failed to fetch projects from workspace', {
          method: 'getAllProjects',
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          error: getErrorMessage(workspaceError)
        });
      }
    }

    mcpLog(LOG_LEVELS.INFO, 'All projects fetched successfully', {
      method: 'getAllProjects',
      totalProjects: allProjects.length,
      workspaceCount: allWorkspaces.length
    });

    if (aggregateTruncation) {
      aggregateTruncation.returnedCount = allProjects.length;
    }
    return { items: allProjects, truncation: aggregateTruncation };
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch projects from all workspaces', {
      method: 'getAllProjects',
      error: getErrorMessage(error)
    });
    throw ctx.api.formatApiError(error, 'fetch', 'project');
  }
}

export async function getProject(ctx: ResourceContext, projectId: string): Promise<MotionProject> {
  const cacheKey = `project:${projectId}`;

  return ctx.cache.singleProject.withCache(cacheKey, async () => {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Fetching single project from Motion API', {
        method: 'getProject',
        projectId
      });

      const response: AxiosResponse<MotionProject> = await ctx.api.requestWithRetry(() => ctx.api.client.get(`/projects/${projectId}`));

      mcpLog(LOG_LEVELS.INFO, 'Successfully fetched project', {
        method: 'getProject',
        projectId,
        projectName: response.data.name
      });

      return response.data;
    } catch (error: unknown) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch project', {
        method: 'getProject',
        projectId,
        error: getErrorMessage(error),
        apiStatus: isAxiosError(error) ? error.response?.status : undefined,
        apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
      });
      throw ctx.api.formatApiError(error, 'fetch', 'project', projectId);
    }
  });
}

export async function createProject(ctx: ResourceContext, projectData: Partial<MotionProject>): Promise<MotionProject> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Creating project in Motion API', {
      method: 'createProject',
      projectName: projectData.name,
      workspaceId: projectData.workspaceId
    });

    if (!projectData.workspaceId) {
      throw new UserFacingError(
        'Workspace ID is required to create a project',
        'Workspace ID is required to create a project',
        undefined,
        undefined,
        400
      );
    }

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalPayload = createMinimalPayload(projectData);

    // Debug logging: log the exact payload being sent to API
    mcpLog(LOG_LEVELS.DEBUG, 'API payload for project creation', {
      method: 'createProject',
      payload: JSON.stringify(minimalPayload, null, 2)
    });

    const response: AxiosResponse<MotionProject> = await ctx.api.requestWithRetry(() => ctx.api.client.post('/projects', minimalPayload));

    // Invalidate cache after successful creation
    ctx.cache.project.invalidate(`projects:workspace:${projectData.workspaceId}`);

    mcpLog(LOG_LEVELS.INFO, 'Project created successfully', {
      method: 'createProject',
      projectId: response.data.id,
      projectName: response.data.name
    });

    return response.data;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to create project', {
      method: 'createProject',
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined,
      fullErrorResponse: isAxiosError(error) ? JSON.stringify(error.response?.data, null, 2) : undefined
    });
    throw ctx.api.formatApiError(error, 'create', 'project', undefined, projectData.name);
  }
}

// Note: Project update/delete are not in the public API docs but appear to be functional
export async function updateProject(ctx: ResourceContext, projectId: string, updates: Partial<MotionProject>): Promise<MotionProject> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Updating project in Motion API', {
      method: 'updateProject',
      projectId,
      updates: Object.keys(updates)
    });

    // Create minimal payload by removing empty/null values to avoid validation errors
    const minimalUpdates = createMinimalPayload(updates);
    const response: AxiosResponse<MotionProject> = await ctx.api.requestWithRetry(() => ctx.api.client.patch(`/projects/${projectId}`, minimalUpdates));

    // Invalidate cache after successful update
    ctx.cache.project.invalidate(`projects:workspace:${response.data.workspaceId}`);
    ctx.cache.singleProject.invalidate(`project:${projectId}`);

    mcpLog(LOG_LEVELS.INFO, 'Project updated successfully', {
      method: 'updateProject',
      projectId,
      projectName: response.data.name
    });

    return response.data;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to update project', {
      method: 'updateProject',
      projectId,
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
    });
    throw ctx.api.formatApiError(error, 'update', 'project', projectId);
  }
}

// Note: Project delete is not in the public API docs but appears to be functional
export async function deleteProject(ctx: ResourceContext, projectId: string): Promise<void> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Deleting project from Motion API', {
      method: 'deleteProject',
      projectId
    });

    await ctx.api.requestWithRetry(() => ctx.api.client.delete(`/projects/${projectId}`));

    // Invalidate all project caches since we don't know the workspace ID
    ctx.cache.project.invalidate();
    ctx.cache.singleProject.invalidate(`project:${projectId}`);

    mcpLog(LOG_LEVELS.INFO, 'Project deleted successfully', {
      method: 'deleteProject',
      projectId
    });
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to delete project', {
      method: 'deleteProject',
      projectId,
      error: getErrorMessage(error),
      apiStatus: isAxiosError(error) ? error.response?.status : undefined,
      apiMessage: isAxiosError(error) ? error.response?.data?.message : undefined
    });
    throw ctx.api.formatApiError(error, 'delete', 'project', projectId);
  }
}

export async function getProjectByName(ctx: ResourceContext, projectName: string, workspaceId?: string): Promise<MotionProject | undefined> {
  try {
    mcpLog(LOG_LEVELS.DEBUG, 'Finding project by name', {
      method: 'getProjectByName',
      projectName,
      workspaceId
    });

    // First, search in the specified workspace (if provided)
    if (workspaceId) {
      const { items: projects } = await getProjects(ctx, workspaceId);
      const project = projects.find(p => p.name === projectName);

      if (project) {
        mcpLog(LOG_LEVELS.INFO, 'Project found by name in specified workspace', {
          method: 'getProjectByName',
          projectName,
          projectId: project.id,
          workspaceId
        });
        return project;
      }
    }

    // If not found in specified workspace (or none specified), search across all other workspaces
    mcpLog(LOG_LEVELS.DEBUG, 'Project not found in specified workspace, searching all workspaces', {
      method: 'getProjectByName',
      projectName,
      specifiedWorkspaceId: workspaceId
    });

    const allWorkspaces = await getWorkspaces(ctx);
    const otherWorkspaces = allWorkspaces.filter(w => w.id !== workspaceId);

    for (const workspace of otherWorkspaces) {
      try {
        mcpLog(LOG_LEVELS.DEBUG, 'Searching workspace for project', {
          method: 'getProjectByName',
          projectName,
          searchingWorkspaceId: workspace.id,
          searchingWorkspaceName: workspace.name
        });

        const { items: workspaceProjects } = await getProjects(ctx, workspace.id);
        const foundProject = workspaceProjects.find(p => p.name === projectName);

        if (foundProject) {
          mcpLog(LOG_LEVELS.WARN, 'Project found by name in different workspace', {
            method: 'getProjectByName',
            projectName,
            projectId: foundProject.id,
            foundInWorkspaceId: workspace.id,
            foundInWorkspaceName: workspace.name,
            originalWorkspaceId: workspaceId
          });
          return foundProject;
        }
      } catch (workspaceError: unknown) {
        // Log error but continue searching other workspaces
        mcpLog(LOG_LEVELS.WARN, 'Failed to search workspace for project', {
          method: 'getProjectByName',
          projectName,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          error: getErrorMessage(workspaceError)
        });
      }
    }

    // Project not found in any workspace
    mcpLog(LOG_LEVELS.WARN, 'Project not found by name in any workspace', {
      method: 'getProjectByName',
      projectName,
      searchedWorkspaces: [workspaceId, ...otherWorkspaces.map(w => w.id)],
      totalWorkspacesSearched: allWorkspaces.length
    });

    return undefined;
  } catch (error: unknown) {
    mcpLog(LOG_LEVELS.ERROR, 'Failed to find project by name', {
      method: 'getProjectByName',
      projectName,
      error: getErrorMessage(error)
    });
    throw error;
  }
}
