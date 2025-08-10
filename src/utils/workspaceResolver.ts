/**
 * WorkspaceResolver - Centralized workspace resolution logic
 * 
 * This class handles all workspace resolution patterns used throughout
 * the Motion MCP Server, including ID resolution, name lookups, and
 * fallback to default workspace behavior.
 */

import { ERROR_CODES, DEFAULTS, LOG_LEVELS, LogLevel } from './constants';
import { MotionWorkspace } from '../types/motion';
import { WorkspaceError } from './errorHandling';

// MCP-compliant logger helper (will be refactored later)
const mcpLog = (level: LogLevel, message: string, extra: Record<string, any> = {}): void => {
  const logEntry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    component: 'WorkspaceResolver',
    ...extra
  };
  console.error(JSON.stringify(logEntry));
};

interface WorkspaceResolverOptions {
  fallbackToDefault?: boolean;
  validateAccess?: boolean;
  useCache?: boolean;
}

interface WorkspaceArgs {
  workspaceId?: string | null;
  workspaceName?: string | null;
}

export class WorkspaceResolver {
  private motionService: any; // Will be properly typed when motionApi is converted

  constructor(motionApiService: any) {
    if (!motionApiService) {
      throw new Error('MotionApiService is required for WorkspaceResolver');
    }
    this.motionService = motionApiService;
  }

  /**
   * Main workspace resolution method - handles all workspace resolution patterns
   */
  async resolveWorkspace(
    args: WorkspaceArgs = {}, 
    options: WorkspaceResolverOptions = {}
  ): Promise<MotionWorkspace> {
    const { workspaceId, workspaceName } = args;
    const { 
      fallbackToDefault = DEFAULTS.WORKSPACE_FALLBACK_TO_DEFAULT,
      validateAccess = DEFAULTS.WORKSPACE_VALIDATE_ACCESS
      // useCache = DEFAULTS.WORKSPACE_USE_CACHE // Will be used in future caching implementation
    } = options;

    mcpLog(LOG_LEVELS.DEBUG, 'Starting workspace resolution', {
      method: 'resolveWorkspace',
      workspaceId,
      workspaceName,
      fallbackToDefault,
      validateAccess
    });

    try {
      let resolvedWorkspace: MotionWorkspace | null = null;

      // Case 1: Direct workspace ID provided
      if (workspaceId) {
        mcpLog(LOG_LEVELS.DEBUG, 'Resolving by workspace ID', {
          method: 'resolveWorkspace',
          workspaceId
        });
        
        if (validateAccess) {
          resolvedWorkspace = await this.resolveByWorkspaceId(workspaceId);
        } else {
          // When not validating, just return the ID as-is
          resolvedWorkspace = { 
            id: workspaceId, 
            name: workspaceId,
            type: 'unknown'
          };
        }
      }
      
      // Case 2: Workspace name provided
      else if (workspaceName) {
        mcpLog(LOG_LEVELS.DEBUG, 'Resolving by workspace name', {
          method: 'resolveWorkspace',
          workspaceName
        });
        resolvedWorkspace = await this.resolveByWorkspaceName(workspaceName);
      }
      
      // Case 3: Fallback to default workspace
      else if (fallbackToDefault) {
        mcpLog(LOG_LEVELS.DEBUG, 'Falling back to default workspace', {
          method: 'resolveWorkspace'
        });
        resolvedWorkspace = await this.resolveDefaultWorkspace();
      }

      // Case 4: No workspace could be resolved
      if (!resolvedWorkspace) {
        throw new WorkspaceError(
          'No workspace specified and no default workspace available',
          ERROR_CODES.NO_DEFAULT_WORKSPACE,
          { fallbackToDefault }
        );
      }

      mcpLog(LOG_LEVELS.INFO, 'Workspace resolved successfully', {
        method: 'resolveWorkspace',
        resolvedId: resolvedWorkspace.id,
        resolvedName: resolvedWorkspace.name
      });

      return resolvedWorkspace;
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to resolve workspace', {
        method: 'resolveWorkspace',
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
        workspaceName
      });
      throw error;
    }
  }

  /**
   * Resolve workspace by ID - validates the workspace exists
   */
  private async resolveByWorkspaceId(workspaceId: string): Promise<MotionWorkspace> {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching workspace by ID', {
      method: 'resolveByWorkspaceId',
      workspaceId
    });

    try {
      const workspaces = await this.motionService.getWorkspaces();
      const workspace = workspaces.find((w: MotionWorkspace) => w.id === workspaceId);
      
      if (!workspace) {
        throw new WorkspaceError(
          `Workspace with ID "${workspaceId}" not found`,
          ERROR_CODES.WORKSPACE_NOT_FOUND,
          { workspaceId, availableCount: workspaces.length }
        );
      }

      mcpLog(LOG_LEVELS.INFO, 'Workspace found by ID', {
        method: 'resolveByWorkspaceId',
        workspaceId,
        workspaceName: workspace.name
      });

      return workspace;
    } catch (error) {
      if (error instanceof WorkspaceError) {
        throw error;
      }
      
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch workspace by ID', {
        method: 'resolveByWorkspaceId',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new WorkspaceError(
        `Failed to validate workspace ID "${workspaceId}"`,
        ERROR_CODES.WORKSPACE_ACCESS_DENIED,
        { workspaceId }
      );
    }
  }

  /**
   * Resolve workspace by name - finds matching workspace
   */
  private async resolveByWorkspaceName(workspaceName: string): Promise<MotionWorkspace> {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching workspace by name', {
      method: 'resolveByWorkspaceName',
      workspaceName
    });

    try {
      const workspaces = await this.motionService.getWorkspaces();
      
      // Exact match first
      let workspace = workspaces.find((w: MotionWorkspace) => 
        w.name === workspaceName
      );
      
      // Case-insensitive match as fallback
      if (!workspace) {
        const lowerName = workspaceName.toLowerCase();
        workspace = workspaces.find((w: MotionWorkspace) => 
          w.name.toLowerCase() === lowerName
        );
      }
      
      if (!workspace) {
        // Provide helpful error with available workspace names
        const availableNames = workspaces.map((w: MotionWorkspace) => w.name).join(', ');
        throw new WorkspaceError(
          `Workspace "${workspaceName}" not found. Available workspaces: ${availableNames}`,
          ERROR_CODES.WORKSPACE_NOT_FOUND,
          { 
            requestedName: workspaceName,
            availableWorkspaces: workspaces.map((w: MotionWorkspace) => ({
              id: w.id,
              name: w.name
            }))
          }
        );
      }

      mcpLog(LOG_LEVELS.INFO, 'Workspace found by name', {
        method: 'resolveByWorkspaceName',
        workspaceName,
        workspaceId: workspace.id
      });

      return workspace;
    } catch (error) {
      if (error instanceof WorkspaceError) {
        throw error;
      }
      
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch workspace by name', {
        method: 'resolveByWorkspaceName',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new WorkspaceError(
        `Failed to resolve workspace name "${workspaceName}"`,
        ERROR_CODES.MOTION_API_ERROR,
        { workspaceName }
      );
    }
  }

  /**
   * Resolve default workspace - gets the first available workspace
   */
  private async resolveDefaultWorkspace(): Promise<MotionWorkspace> {
    mcpLog(LOG_LEVELS.DEBUG, 'Fetching default workspace', {
      method: 'resolveDefaultWorkspace'
    });

    try {
      const workspaces = await this.motionService.getWorkspaces();
      
      if (!workspaces || workspaces.length === 0) {
        throw new WorkspaceError(
          'No workspaces available',
          ERROR_CODES.NO_DEFAULT_WORKSPACE
        );
      }

      // Use the first workspace as default
      const defaultWorkspace = workspaces[0];
      
      mcpLog(LOG_LEVELS.INFO, 'Using default workspace', {
        method: 'resolveDefaultWorkspace',
        workspaceId: defaultWorkspace.id,
        workspaceName: defaultWorkspace.name
      });

      return defaultWorkspace;
    } catch (error) {
      if (error instanceof WorkspaceError) {
        throw error;
      }
      
      mcpLog(LOG_LEVELS.ERROR, 'Failed to fetch default workspace', {
        method: 'resolveDefaultWorkspace',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new WorkspaceError(
        'Failed to fetch default workspace',
        ERROR_CODES.MOTION_API_ERROR
      );
    }
  }
}