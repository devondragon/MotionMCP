/**
 * Barrel export for all resource modules.
 *
 * Re-exports every public function and type from the decomposed API modules.
 * External consumers can import from './api' instead of individual files.
 */

// Infrastructure
export { ApiClient, getErrorMessage } from './ApiClient';
export { CacheManager } from './CacheManager';
export type { IApiClient, ICacheManager, ResourceContext } from './types';

// Resource modules
export { getWorkspaces } from './workspaces';
export { getUsers, getCurrentUser } from './users';
export { getTasks, getTask, createTask, updateTask, deleteTask, moveTask, unassignTask, getAllUncompletedTasks } from './tasks';
export type { GetTasksOptions } from './tasks';
export { getProjects, getAllProjects, getProject, createProject, updateProject, deleteProject, getProjectByName } from './projects';
export { getComments, createComment } from './comments';
export { getCustomFields, createCustomField, deleteCustomField, addCustomFieldToProject, removeCustomFieldFromProject, addCustomFieldToTask, removeCustomFieldFromTask } from './customFields';
export { getRecurringTasks, createRecurringTask, deleteRecurringTask } from './recurringTasks';
export { getSchedules, getAvailableScheduleNames } from './schedules';
export { getStatuses } from './statuses';
export { searchTasks, searchProjects, resolveProjectIdentifier, resolveUserIdentifier } from './search';
export type { ResolveUserIdentifierOptions } from './search';
