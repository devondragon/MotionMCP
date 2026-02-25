/**
 * MotionApiService — thin facade that delegates to resource modules.
 *
 * All business logic lives in `src/services/api/*.ts` modules. This class
 * preserves the original public API surface so existing consumers (handlers,
 * tests) don't need to change.
 */

import {
  MotionWorkspace,
  MotionProject,
  MotionTask,
  MotionTaskCreateData,
  MotionTaskUpdateData,
  MotionUser,
  MotionComment,
  CreateCommentData,
  MotionCustomField,
  MotionCustomFieldValue,
  CreateCustomFieldData,
  MotionRecurringTask,
  CreateRecurringTaskData,
  MotionSchedule,
  MotionStatus,
  MotionPaginatedResponse
} from '../types/motion';
import { ListResult } from '../types/mcp';
import { ApiClient } from './api/ApiClient';
import { CacheManager } from './api/CacheManager';
import type { IApiClient, ResourceContext } from './api/types';

// Resource module imports
import { getWorkspaces as _getWorkspaces } from './api/workspaces';
import { getUsers as _getUsers, getCurrentUser as _getCurrentUser } from './api/users';
import { getTasks as _getTasks, getTask as _getTask, createTask as _createTask, updateTask as _updateTask, deleteTask as _deleteTask, moveTask as _moveTask, unassignTask as _unassignTask, getAllUncompletedTasks as _getAllUncompletedTasks } from './api/tasks';
import type { GetTasksOptions } from './api/tasks';
import { getProjects as _getProjects, getAllProjects as _getAllProjects, getProject as _getProject, createProject as _createProject, updateProject as _updateProject, deleteProject as _deleteProject, getProjectByName as _getProjectByName } from './api/projects';
import { getComments as _getComments, createComment as _createComment } from './api/comments';
import { getCustomFields as _getCustomFields, createCustomField as _createCustomField, deleteCustomField as _deleteCustomField, addCustomFieldToProject as _addCustomFieldToProject, removeCustomFieldFromProject as _removeCustomFieldFromProject, addCustomFieldToTask as _addCustomFieldToTask, removeCustomFieldFromTask as _removeCustomFieldFromTask } from './api/customFields';
import { getRecurringTasks as _getRecurringTasks, createRecurringTask as _createRecurringTask, deleteRecurringTask as _deleteRecurringTask } from './api/recurringTasks';
import { getSchedules as _getSchedules, getAvailableScheduleNames as _getAvailableScheduleNames } from './api/schedules';
import { getStatuses as _getStatuses } from './api/statuses';
import { searchTasks as _searchTasks, searchProjects as _searchProjects, resolveProjectIdentifier as _resolveProjectIdentifier, resolveUserIdentifier as _resolveUserIdentifier } from './api/search';
import type { ResolveUserIdentifierOptions } from './api/search';

export class MotionApiService {
  private _api: IApiClient;
  private _cache: CacheManager;

  constructor(apiKey?: string) {
    this._api = new ApiClient(apiKey);
    this._cache = new CacheManager();
  }

  /** ResourceContext for delegating to extracted resource modules. */
  private get _ctx(): ResourceContext {
    return { api: this._api, cache: this._cache };
  }

  // ========================================
  // WORKSPACE API METHODS
  // ========================================

  async getWorkspaces(ids?: string[]): Promise<MotionWorkspace[]> {
    return _getWorkspaces(this._ctx, ids);
  }

  // ========================================
  // USER API METHODS
  // ========================================

  async getUsers(workspaceId?: string, teamId?: string): Promise<MotionUser[]> {
    return _getUsers(this._ctx, workspaceId, teamId);
  }

  async getCurrentUser(): Promise<MotionUser> {
    return _getCurrentUser(this._ctx);
  }

  // ========================================
  // TASK API METHODS
  // ========================================

  async getTasks(options: GetTasksOptions): Promise<ListResult<MotionTask>> {
    return _getTasks(this._ctx, options);
  }

  async getTask(taskId: string): Promise<MotionTask> {
    return _getTask(this._ctx, taskId);
  }

  async createTask(taskData: MotionTaskCreateData): Promise<MotionTask> {
    return _createTask(this._ctx, taskData);
  }

  async updateTask(taskId: string, updates: MotionTaskUpdateData): Promise<MotionTask> {
    return _updateTask(this._ctx, taskId, updates);
  }

  async deleteTask(taskId: string): Promise<void> {
    return _deleteTask(this._ctx, taskId);
  }

  async moveTask(taskId: string, targetWorkspaceId: string, assigneeId?: string): Promise<MotionTask | undefined> {
    return _moveTask(this._ctx, taskId, targetWorkspaceId, assigneeId);
  }

  async unassignTask(taskId: string): Promise<MotionTask | undefined> {
    return _unassignTask(this._ctx, taskId);
  }

  async getAllUncompletedTasks(limit?: number, assigneeId?: string): Promise<ListResult<MotionTask>> {
    return _getAllUncompletedTasks(this._ctx, limit, assigneeId);
  }

  // ========================================
  // PROJECT API METHODS
  // ========================================

  async getProjects(workspaceId: string, options?: { maxPages?: number; limit?: number }): Promise<ListResult<MotionProject>> {
    return _getProjects(this._ctx, workspaceId, options);
  }

  async getAllProjects(): Promise<ListResult<MotionProject>> {
    return _getAllProjects(this._ctx);
  }

  async getProject(projectId: string): Promise<MotionProject> {
    return _getProject(this._ctx, projectId);
  }

  async createProject(projectData: Partial<MotionProject>): Promise<MotionProject> {
    return _createProject(this._ctx, projectData);
  }

  async updateProject(projectId: string, updates: Partial<MotionProject>): Promise<MotionProject> {
    return _updateProject(this._ctx, projectId, updates);
  }

  async deleteProject(projectId: string): Promise<void> {
    return _deleteProject(this._ctx, projectId);
  }

  async getProjectByName(projectName: string, workspaceId?: string): Promise<MotionProject | undefined> {
    return _getProjectByName(this._ctx, projectName, workspaceId);
  }

  // ========================================
  // COMMENT API METHODS
  // ========================================

  async getComments(taskId: string, cursor?: string): Promise<MotionPaginatedResponse<MotionComment>> {
    return _getComments(this._ctx, taskId, cursor);
  }

  async createComment(commentData: CreateCommentData): Promise<MotionComment> {
    return _createComment(this._ctx, commentData);
  }

  // ========================================
  // CUSTOM FIELD API METHODS
  // ========================================

  async getCustomFields(workspaceId: string): Promise<MotionCustomField[]> {
    return _getCustomFields(this._ctx, workspaceId);
  }

  async createCustomField(workspaceId: string, fieldData: CreateCustomFieldData): Promise<MotionCustomField> {
    return _createCustomField(this._ctx, workspaceId, fieldData);
  }

  async deleteCustomField(workspaceId: string, fieldId: string): Promise<{ success: boolean }> {
    return _deleteCustomField(this._ctx, workspaceId, fieldId);
  }

  async addCustomFieldToProject(projectId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string): Promise<MotionCustomFieldValue> {
    return _addCustomFieldToProject(this._ctx, projectId, fieldId, value, fieldType);
  }

  async removeCustomFieldFromProject(projectId: string, valueId: string): Promise<{ success: boolean }> {
    return _removeCustomFieldFromProject(this._ctx, projectId, valueId);
  }

  async addCustomFieldToTask(taskId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string): Promise<MotionCustomFieldValue> {
    return _addCustomFieldToTask(this._ctx, taskId, fieldId, value, fieldType);
  }

  async removeCustomFieldFromTask(taskId: string, valueId: string): Promise<{ success: boolean }> {
    return _removeCustomFieldFromTask(this._ctx, taskId, valueId);
  }

  // ========================================
  // RECURRING TASK API METHODS
  // ========================================

  async getRecurringTasks(workspaceId?: string, options?: { maxPages?: number; limit?: number }): Promise<ListResult<MotionRecurringTask>> {
    return _getRecurringTasks(this._ctx, workspaceId, options);
  }

  async createRecurringTask(taskData: CreateRecurringTaskData): Promise<MotionRecurringTask> {
    return _createRecurringTask(this._ctx, taskData);
  }

  async deleteRecurringTask(recurringTaskId: string): Promise<{ success: boolean }> {
    return _deleteRecurringTask(this._ctx, recurringTaskId);
  }

  // ========================================
  // SCHEDULE API METHODS
  // ========================================

  async getAvailableScheduleNames(workspaceId?: string): Promise<string[]> {
    return _getAvailableScheduleNames(this._ctx, workspaceId);
  }

  async getSchedules(): Promise<MotionSchedule[]> {
    return _getSchedules(this._ctx);
  }

  // ========================================
  // STATUS API METHODS
  // ========================================

  async getStatuses(workspaceId?: string): Promise<MotionStatus[]> {
    return _getStatuses(this._ctx, workspaceId);
  }

  // ========================================
  // SEARCH AND RESOLUTION METHODS
  // ========================================

  async searchTasks(query: string, workspaceId: string, limit?: number): Promise<ListResult<MotionTask>> {
    return _searchTasks(this._ctx, query, workspaceId, limit);
  }

  async searchProjects(query: string, workspaceId: string, limit?: number): Promise<ListResult<MotionProject>> {
    return _searchProjects(this._ctx, query, workspaceId, limit);
  }

  async resolveProjectIdentifier(
    identifier: { projectId?: string; projectName?: string },
    workspaceId?: string
  ): Promise<MotionProject | undefined> {
    return _resolveProjectIdentifier(this._ctx, identifier, workspaceId);
  }

  async resolveUserIdentifier(
    identifier: { userId?: string; userName?: string },
    workspaceId?: string,
    options?: ResolveUserIdentifierOptions
  ): Promise<MotionUser | undefined> {
    return _resolveUserIdentifier(this._ctx, identifier, workspaceId, options);
  }
}
