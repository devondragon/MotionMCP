/**
 * CacheManager — all 9 typed cache instances for the Motion API service.
 *
 * Each cache has a per-resource TTL defined in CACHE_TTL (src/utils/constants.ts).
 */

import { SimpleCache } from '../../utils/cache';
import { CACHE_TTL } from '../../utils/constants';
import {
  MotionWorkspace,
  MotionProject,
  MotionUser,
  MotionComment,
  MotionCustomField,
  MotionRecurringTask,
  MotionSchedule,
  MotionStatus,
  MotionPaginatedResponse,
} from '../../types/motion';
import { ICacheManager } from './types';

export class CacheManager implements ICacheManager {
  readonly workspace: SimpleCache<MotionWorkspace[]>;
  readonly user: SimpleCache<MotionUser[]>;
  readonly project: SimpleCache<MotionProject[]>;
  readonly singleProject: SimpleCache<MotionProject>;
  readonly comment: SimpleCache<MotionPaginatedResponse<MotionComment>>;
  readonly customField: SimpleCache<MotionCustomField[]>;
  readonly recurringTask: SimpleCache<MotionRecurringTask[]>;
  readonly schedule: SimpleCache<MotionSchedule[]>;
  readonly status: SimpleCache<MotionStatus[]>;

  constructor() {
    this.workspace = new SimpleCache(CACHE_TTL.WORKSPACES);
    this.user = new SimpleCache(CACHE_TTL.USERS);
    this.project = new SimpleCache(CACHE_TTL.PROJECTS);
    this.singleProject = new SimpleCache(CACHE_TTL.PROJECTS);
    this.comment = new SimpleCache(CACHE_TTL.COMMENTS);
    this.customField = new SimpleCache(CACHE_TTL.CUSTOM_FIELDS);
    this.recurringTask = new SimpleCache(CACHE_TTL.RECURRING_TASKS);
    this.schedule = new SimpleCache(CACHE_TTL.SCHEDULES);
    this.status = new SimpleCache(CACHE_TTL.STATUSES);
  }
}
