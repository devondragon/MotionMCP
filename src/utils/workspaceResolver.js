/**
 * WorkspaceResolver - Centralized workspace resolution logic
 * 
 * This class handles all workspace resolution patterns used throughout
 * the Motion MCP Server, including ID resolution, name lookups, and
 * fallback to default workspace behavior.
 */

const { ERROR_CODES, DEFAULTS, LOG_LEVELS } = require('./constants');

// MCP-compliant logger helper (will be refactored later)
const mcpLog = (level, message, extra = {}) => {
  const logEntry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    component: 'WorkspaceResolver',
    ...extra
  };
  console.error(JSON.stringify(logEntry));
};

class WorkspaceResolver {
  constructor(motionApiService) {
    if (!motionApiService) {
      throw new Error('MotionApiService is required for WorkspaceResolver');
    }
    this.motionService = motionApiService;
  }

  /**
   * Main workspace resolution method - handles all workspace resolution patterns
   * 
   * @param {Object} args - Arguments containing workspaceId and/or workspaceName
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolved workspace object with id and name
   */
  async resolveWorkspace(args = {}, options = {}) {
    const { workspaceId, workspaceName } = args;
    const { 
      fallbackToDefault = DEFAULTS.WORKSPACE_FALLBACK_TO_DEFAULT,
      validateAccess = DEFAULTS.WORKSPACE_VALIDATE_ACCESS,
      useCache = DEFAULTS.WORKSPACE_USE_CACHE
    } = options;

    mcpLog(LOG_LEVELS.DEBUG, 'Starting workspace resolution', {
      method: 'resolveWorkspace',
      workspaceId,
      workspaceName,
      fallbackToDefault,
      validateAccess
    });

    try {
      let resolvedWorkspace = null;

      // Case 1: Direct workspace ID provided
      if (workspaceId) {
        mcpLog(LOG_LEVELS.DEBUG, 'Resolving by workspace ID', {
          method: 'resolveWorkspace',
          workspaceId
        });
        
        // Get workspace details to return both ID and name
        const workspaces = await this.motionService.getWorkspaces();
        resolvedWorkspace = workspaces.find(w => w.id === workspaceId);
        
        if (!resolvedWorkspace) {
          throw new Error(`Workspace with ID "${workspaceId}" not found`);
        }

      // Case 2: Workspace name provided - resolve to ID
      } else if (workspaceName) {
        mcpLog(LOG_LEVELS.DEBUG, 'Resolving by workspace name', {
          method: 'resolveWorkspace',
          workspaceName
        });
        
        resolvedWorkspace = await this.getWorkspaceByName(workspaceName);

      // Case 3: No workspace specified - fallback to default
      } else if (fallbackToDefault) {
        mcpLog(LOG_LEVELS.DEBUG, 'No workspace specified, using default', {
          method: 'resolveWorkspace',
          fallbackToDefault
        });
        
        resolvedWorkspace = await this.getDefaultWorkspace(useCache);

      // Case 4: No workspace and no fallback allowed
      } else {
        throw new Error('No workspace specified and fallback to default is disabled');
      }

      // Validate access if requested
      if (validateAccess && resolvedWorkspace) {
        await this.validateWorkspaceAccess(resolvedWorkspace.id);
      }

      mcpLog(LOG_LEVELS.INFO, 'Workspace resolution successful', {
        method: 'resolveWorkspace',
        resolvedWorkspaceId: resolvedWorkspace.id,
        resolvedWorkspaceName: resolvedWorkspace.name,
        resolvedFromId: !!workspaceId,
        resolvedFromName: !!workspaceName,
        usedDefault: !workspaceId && !workspaceName
      });

      return resolvedWorkspace;
      
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to resolve workspace', {
        method: 'resolveWorkspace',
        error: error.message,
        workspaceId,
        workspaceName
      });
      throw error;
    }
  }

  /**
   * Validate that a workspace ID is accessible to the current user
   * 
   * @param {string} workspaceId - Workspace ID to validate
   * @returns {Promise<boolean>} True if accessible
   */
  async validateWorkspaceAccess(workspaceId) {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Validating workspace access', {
        method: 'validateWorkspaceAccess',
        workspaceId
      });

      const workspaces = await this.motionService.getWorkspaces();
      const workspace = workspaces.find(w => w.id === workspaceId);
      
      if (!workspace) {
        mcpLog(LOG_LEVELS.WARN, 'Workspace access validation failed - not found', {
          method: 'validateWorkspaceAccess',
          workspaceId
        });
        throw new Error(`Workspace "${workspaceId}" is not accessible or does not exist`);
      }

      mcpLog(LOG_LEVELS.DEBUG, 'Workspace access validation successful', {
        method: 'validateWorkspaceAccess',
        workspaceId,
        workspaceName: workspace.name
      });

      return true;
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to validate workspace access', {
        method: 'validateWorkspaceAccess',
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get the default workspace for the current user
   * 
   * @param {boolean} cached - Whether to use cached result
   * @returns {Promise<Object>} Default workspace object
   */
  async getDefaultWorkspace(cached = DEFAULTS.WORKSPACE_USE_CACHE) {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Getting default workspace', {
        method: 'getDefaultWorkspace',
        cached
      });

      const workspaces = await this.motionService.getWorkspaces();

      if (!workspaces || workspaces.length === 0) {
        throw new Error('No workspaces available');
      }

      // Log all available workspaces for debugging
      mcpLog(LOG_LEVELS.DEBUG, 'Available workspaces', {
        method: 'getDefaultWorkspace',
        workspaces: workspaces.map(w => ({ id: w.id, name: w.name, type: w.type }))
      });

      // Prefer the first workspace, but look for personal workspace first
      let defaultWorkspace = workspaces[0];

      // Look for a personal or individual workspace first
      const personalWorkspace = workspaces.find(w =>
        w.type === 'INDIVIDUAL' &&
        (w.name.toLowerCase().includes('personal') || w.name.toLowerCase().includes('my'))
      );

      if (personalWorkspace) {
        defaultWorkspace = personalWorkspace;
        mcpLog(LOG_LEVELS.INFO, 'Selected personal workspace as default', {
          method: 'getDefaultWorkspace',
          workspaceId: defaultWorkspace.id,
          workspaceName: defaultWorkspace.name,
          type: defaultWorkspace.type
        });
      } else {
        mcpLog(LOG_LEVELS.INFO, 'Selected first available workspace as default', {
          method: 'getDefaultWorkspace',
          workspaceId: defaultWorkspace.id,
          workspaceName: defaultWorkspace.name,
          type: defaultWorkspace.type
        });
      }

      return defaultWorkspace;
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to get default workspace', {
        method: 'getDefaultWorkspace',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get workspace by name (case-insensitive)
   * 
   * @param {string} workspaceName - Name of the workspace
   * @returns {Promise<Object>} Workspace object
   */
  async getWorkspaceByName(workspaceName) {
    try {
      mcpLog(LOG_LEVELS.DEBUG, 'Getting workspace by name', {
        method: 'getWorkspaceByName',
        workspaceName
      });

      const workspaces = await this.motionService.getWorkspaces();
      const workspace = workspaces.find(w => w.name.toLowerCase() === workspaceName.toLowerCase());

      if (!workspace) {
        throw new Error(`Workspace with name "${workspaceName}" not found`);
      }

      mcpLog(LOG_LEVELS.INFO, 'Found workspace by name', {
        method: 'getWorkspaceByName',
        workspaceName,
        workspaceId: workspace.id
      });

      return workspace;
    } catch (error) {
      mcpLog(LOG_LEVELS.ERROR, 'Failed to find workspace by name', {
        method: 'getWorkspaceByName',
        workspaceName,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = WorkspaceResolver;