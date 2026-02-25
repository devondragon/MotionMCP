/**
 * Facade contract test — compile-time type assertions that verify all public
 * method signatures on MotionApiService remain intact after refactoring.
 *
 * This test uses TypeScript's type system: if any method signature changes,
 * the file won't compile and `npm test` (vitest) will fail.
 */
import { describe, it, expect } from 'vitest';
import type { MotionApiService } from '../../src/services/motionApi';
import type {
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
  MotionPaginatedResponse,
} from '../../src/types/motion';
import type { ListResult } from '../../src/types/mcp';
import type { ValidPriority } from '../../src/utils/constants';

// ---------------------------------------------------------------------------
// Type-level assertions: each assignment enforces the exact method signature.
// If a method is removed, renamed, or its signature changes, TypeScript
// reports a compile error here — before any runtime test executes.
// ---------------------------------------------------------------------------

type AssertMethod<T> = T; // identity — forces TS to evaluate the type

// Workspace methods
type _getWorkspaces = AssertMethod<
  (this: MotionApiService, ids?: string[]) => Promise<MotionWorkspace[]>
>;
const _tw1: _getWorkspaces = null! as MotionApiService['getWorkspaces'];

// User methods
type _getUsers = AssertMethod<
  (this: MotionApiService, workspaceId?: string, teamId?: string) => Promise<MotionUser[]>
>;
const _tu1: _getUsers = null! as MotionApiService['getUsers'];

type _getCurrentUser = AssertMethod<
  (this: MotionApiService) => Promise<MotionUser>
>;
const _tu2: _getCurrentUser = null! as MotionApiService['getCurrentUser'];

// Task methods
type _getTasks = AssertMethod<
  (this: MotionApiService, options: {
    workspaceId?: string;
    projectId?: string;
    name?: string;
    status?: string | string[];
    includeAllStatuses?: boolean;
    assigneeId?: string;
    priority?: ValidPriority;
    dueDate?: string;
    labels?: string[];
    limit?: number;
    maxPages?: number;
  }) => Promise<ListResult<MotionTask>>
>;
const _tt1: _getTasks = null! as MotionApiService['getTasks'];

type _getTask = AssertMethod<
  (this: MotionApiService, taskId: string) => Promise<MotionTask>
>;
const _tt2: _getTask = null! as MotionApiService['getTask'];

type _createTask = AssertMethod<
  (this: MotionApiService, taskData: MotionTaskCreateData) => Promise<MotionTask>
>;
const _tt3: _createTask = null! as MotionApiService['createTask'];

type _updateTask = AssertMethod<
  (this: MotionApiService, taskId: string, updates: MotionTaskUpdateData) => Promise<MotionTask>
>;
const _tt4: _updateTask = null! as MotionApiService['updateTask'];

type _deleteTask = AssertMethod<
  (this: MotionApiService, taskId: string) => Promise<void>
>;
const _tt5: _deleteTask = null! as MotionApiService['deleteTask'];

type _moveTask = AssertMethod<
  (this: MotionApiService, taskId: string, targetWorkspaceId: string, assigneeId?: string) => Promise<MotionTask | undefined>
>;
const _tt6: _moveTask = null! as MotionApiService['moveTask'];

type _unassignTask = AssertMethod<
  (this: MotionApiService, taskId: string) => Promise<MotionTask | undefined>
>;
const _tt7: _unassignTask = null! as MotionApiService['unassignTask'];

type _getAllUncompletedTasks = AssertMethod<
  (this: MotionApiService, limit?: number, assigneeId?: string) => Promise<ListResult<MotionTask>>
>;
const _tt8: _getAllUncompletedTasks = null! as MotionApiService['getAllUncompletedTasks'];

// Project methods
type _getProjects = AssertMethod<
  (this: MotionApiService, workspaceId: string, options?: { maxPages?: number; limit?: number }) => Promise<ListResult<MotionProject>>
>;
const _tp1: _getProjects = null! as MotionApiService['getProjects'];

type _getAllProjects = AssertMethod<
  (this: MotionApiService) => Promise<ListResult<MotionProject>>
>;
const _tp2: _getAllProjects = null! as MotionApiService['getAllProjects'];

type _getProject = AssertMethod<
  (this: MotionApiService, projectId: string) => Promise<MotionProject>
>;
const _tp3: _getProject = null! as MotionApiService['getProject'];

type _createProject = AssertMethod<
  (this: MotionApiService, projectData: Partial<MotionProject>) => Promise<MotionProject>
>;
const _tp4: _createProject = null! as MotionApiService['createProject'];

type _updateProject = AssertMethod<
  (this: MotionApiService, projectId: string, updates: Partial<MotionProject>) => Promise<MotionProject>
>;
const _tp5: _updateProject = null! as MotionApiService['updateProject'];

type _deleteProject = AssertMethod<
  (this: MotionApiService, projectId: string) => Promise<void>
>;
const _tp6: _deleteProject = null! as MotionApiService['deleteProject'];

type _getProjectByName = AssertMethod<
  (this: MotionApiService, projectName: string, workspaceId?: string) => Promise<MotionProject | undefined>
>;
const _tp7: _getProjectByName = null! as MotionApiService['getProjectByName'];

// Comment methods
type _getComments = AssertMethod<
  (this: MotionApiService, taskId: string, cursor?: string) => Promise<MotionPaginatedResponse<MotionComment>>
>;
const _tc1: _getComments = null! as MotionApiService['getComments'];

type _createComment = AssertMethod<
  (this: MotionApiService, commentData: CreateCommentData) => Promise<MotionComment>
>;
const _tc2: _createComment = null! as MotionApiService['createComment'];

// Custom field methods
type _getCustomFields = AssertMethod<
  (this: MotionApiService, workspaceId: string) => Promise<MotionCustomField[]>
>;
const _tcf1: _getCustomFields = null! as MotionApiService['getCustomFields'];

type _createCustomField = AssertMethod<
  (this: MotionApiService, workspaceId: string, fieldData: CreateCustomFieldData) => Promise<MotionCustomField>
>;
const _tcf2: _createCustomField = null! as MotionApiService['createCustomField'];

type _deleteCustomField = AssertMethod<
  (this: MotionApiService, workspaceId: string, fieldId: string) => Promise<{ success: boolean }>
>;
const _tcf3: _deleteCustomField = null! as MotionApiService['deleteCustomField'];

type _addCustomFieldToProject = AssertMethod<
  (this: MotionApiService, projectId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string) => Promise<MotionCustomFieldValue>
>;
const _tcf4: _addCustomFieldToProject = null! as MotionApiService['addCustomFieldToProject'];

type _removeCustomFieldFromProject = AssertMethod<
  (this: MotionApiService, projectId: string, valueId: string) => Promise<{ success: boolean }>
>;
const _tcf5: _removeCustomFieldFromProject = null! as MotionApiService['removeCustomFieldFromProject'];

type _addCustomFieldToTask = AssertMethod<
  (this: MotionApiService, taskId: string, fieldId: string, value?: string | number | boolean | string[] | null, fieldType?: string) => Promise<MotionCustomFieldValue>
>;
const _tcf6: _addCustomFieldToTask = null! as MotionApiService['addCustomFieldToTask'];

type _removeCustomFieldFromTask = AssertMethod<
  (this: MotionApiService, taskId: string, valueId: string) => Promise<{ success: boolean }>
>;
const _tcf7: _removeCustomFieldFromTask = null! as MotionApiService['removeCustomFieldFromTask'];

// Recurring task methods
type _getRecurringTasks = AssertMethod<
  (this: MotionApiService, workspaceId?: string, options?: { maxPages?: number; limit?: number }) => Promise<ListResult<MotionRecurringTask>>
>;
const _trt1: _getRecurringTasks = null! as MotionApiService['getRecurringTasks'];

type _createRecurringTask = AssertMethod<
  (this: MotionApiService, taskData: CreateRecurringTaskData) => Promise<MotionRecurringTask>
>;
const _trt2: _createRecurringTask = null! as MotionApiService['createRecurringTask'];

type _deleteRecurringTask = AssertMethod<
  (this: MotionApiService, recurringTaskId: string) => Promise<{ success: boolean }>
>;
const _trt3: _deleteRecurringTask = null! as MotionApiService['deleteRecurringTask'];

// Schedule methods
type _getSchedules = AssertMethod<
  (this: MotionApiService) => Promise<MotionSchedule[]>
>;
const _ts1: _getSchedules = null! as MotionApiService['getSchedules'];

type _getAvailableScheduleNames = AssertMethod<
  (this: MotionApiService, workspaceId?: string) => Promise<string[]>
>;
const _ts2: _getAvailableScheduleNames = null! as MotionApiService['getAvailableScheduleNames'];

// Status methods
type _getStatuses = AssertMethod<
  (this: MotionApiService, workspaceId?: string) => Promise<MotionStatus[]>
>;
const _tst1: _getStatuses = null! as MotionApiService['getStatuses'];

// Search methods
type _searchTasks = AssertMethod<
  (this: MotionApiService, query: string, workspaceId: string, limit?: number) => Promise<ListResult<MotionTask>>
>;
const _tsr1: _searchTasks = null! as MotionApiService['searchTasks'];

type _searchProjects = AssertMethod<
  (this: MotionApiService, query: string, workspaceId: string, limit?: number) => Promise<ListResult<MotionProject>>
>;
const _tsr2: _searchProjects = null! as MotionApiService['searchProjects'];

// Resolution methods
type _resolveProjectIdentifier = AssertMethod<
  (this: MotionApiService, identifier: { projectId?: string; projectName?: string }, workspaceId?: string) => Promise<MotionProject | undefined>
>;
const _tr1: _resolveProjectIdentifier = null! as MotionApiService['resolveProjectIdentifier'];

type _resolveUserIdentifier = AssertMethod<
  (this: MotionApiService, identifier: { userId?: string; userName?: string }, workspaceId?: string, options?: { strictWorkspace?: boolean }) => Promise<MotionUser | undefined>
>;
const _tr2: _resolveUserIdentifier = null! as MotionApiService['resolveUserIdentifier'];

// ---------------------------------------------------------------------------
// Runtime smoke test: the class should be importable and constructible
// (without an API key it throws, which is expected behavior).
// ---------------------------------------------------------------------------
describe('MotionApiService facade contract', () => {
  it('should export MotionApiService class', async () => {
    const mod = await import('../../src/services/motionApi');
    expect(mod.MotionApiService).toBeDefined();
    expect(typeof mod.MotionApiService).toBe('function');
  });

  it('should throw without API key', async () => {
    const origKey = process.env.MOTION_API_KEY;
    delete process.env.MOTION_API_KEY;
    try {
      // MotionApiService checks env at construction time, and the module is
      // already imported above, so we can just construct a new instance.
      const mod = await import('../../src/services/motionApi');
      expect(() => new mod.MotionApiService()).toThrow('MOTION_API_KEY');
    } finally {
      if (origKey !== undefined) {
        process.env.MOTION_API_KEY = origKey;
      }
    }
  });

  it('should have all 37 public methods', async () => {
    const mod = await import('../../src/services/motionApi');
    // Set env temporarily for construction
    const origKey = process.env.MOTION_API_KEY;
    process.env.MOTION_API_KEY = 'test-key-for-contract';
    try {
      const service = new mod.MotionApiService();
      const expectedMethods = [
        'getWorkspaces',
        'getUsers', 'getCurrentUser',
        'getTasks', 'getTask', 'createTask', 'updateTask', 'deleteTask', 'moveTask', 'unassignTask', 'getAllUncompletedTasks',
        'getProjects', 'getAllProjects', 'getProject', 'createProject', 'updateProject', 'deleteProject', 'getProjectByName',
        'getComments', 'createComment',
        'getCustomFields', 'createCustomField', 'deleteCustomField',
        'addCustomFieldToProject', 'removeCustomFieldFromProject',
        'addCustomFieldToTask', 'removeCustomFieldFromTask',
        'getRecurringTasks', 'createRecurringTask', 'deleteRecurringTask',
        'getSchedules', 'getAvailableScheduleNames',
        'getStatuses',
        'searchTasks', 'searchProjects',
        'resolveProjectIdentifier', 'resolveUserIdentifier',
      ];

      for (const method of expectedMethods) {
        expect(typeof (service as any)[method]).toBe('function');
      }
      expect(expectedMethods.length).toBe(37);
    } finally {
      if (origKey === undefined) {
        delete process.env.MOTION_API_KEY;
      } else {
        process.env.MOTION_API_KEY = origKey;
      }
    }
  });
});

// Suppress "unused variable" warnings — these exist only for type checking
void [_tw1, _tu1, _tu2, _tt1, _tt2, _tt3, _tt4, _tt5, _tt6, _tt7, _tt8,
  _tp1, _tp2, _tp3, _tp4, _tp5, _tp6, _tp7, _tc1, _tc2,
  _tcf1, _tcf2, _tcf3, _tcf4, _tcf5, _tcf6, _tcf7,
  _trt1, _trt2, _trt3, _ts1, _ts2, _tst1, _tsr1, _tsr2, _tr1, _tr2];
