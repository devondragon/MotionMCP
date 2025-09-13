import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionProjectsArgs } from '../types/mcp-tool-args';
import {
  formatMcpSuccess,
  parseProjectArgs,
  formatProjectList,
  formatDetailResponse
} from '../utils';

interface CreateProjectParams {
  name?: string;
  workspaceId?: string;
  workspaceName?: string;
  description?: string;
  color?: string;
  status?: string;
}

interface ListProjectParams {
  workspaceId?: string;
  workspaceName?: string;
  allWorkspaces?: boolean;
}

interface GetProjectParams {
  projectId?: string;
}

export class ProjectHandler extends BaseHandler {
  async handle(args: MotionProjectsArgs): Promise<McpToolResponse> {
    try {
      const { operation, ...params } = args;

      switch(operation) {
        case 'create':
          return await this.handleCreate(params as CreateProjectParams);
        case 'list':
          return await this.handleList(params as ListProjectParams);
        case 'get':
          return await this.handleGet(params as GetProjectParams);
        default:
          return this.handleUnknownOperation(operation);
      }
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleCreate(params: CreateProjectParams): Promise<McpToolResponse> {
    if (!params.name) {
      return this.handleError(new Error("Project name is required for create operation"));
    }

    const projectData = parseProjectArgs(params as unknown as Record<string, unknown>);
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: projectData.workspaceId,
      workspaceName: projectData.workspaceName
    });

    const project = await this.motionService.createProject({
      ...projectData,
      workspaceId: workspace.id
    });

    return formatMcpSuccess(`Successfully created project "${project.name}" (ID: ${project.id})`);
  }

  private async handleList(params: ListProjectParams): Promise<McpToolResponse> {
    // If allWorkspaces is true and no specific workspace is provided, list all projects
    if (params.allWorkspaces && !params.workspaceId && !params.workspaceName) {
      const allProjects = await this.motionService.getAllProjects();
      return formatProjectList(allProjects, 'All Workspaces');
    }

    // Otherwise, use the existing single-workspace logic
    const workspace = await this.workspaceResolver.resolveWorkspace({
      workspaceId: params.workspaceId,
      workspaceName: params.workspaceName
    });

    const projects = await this.motionService.getProjects(workspace.id);
    return formatProjectList(projects, workspace.name);
  }

  private async handleGet(params: GetProjectParams): Promise<McpToolResponse> {
    if (!params.projectId) {
      return this.handleError(new Error("Project ID is required for get operation"));
    }

    const projectDetails = await this.motionService.getProject(params.projectId);
    return formatDetailResponse(projectDetails, `Project details for "${projectDetails.name}"`);
  }
}