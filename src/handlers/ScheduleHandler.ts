import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionSchedulesArgs } from '../types/mcp-tool-args';
import { formatScheduleList } from '../utils';

export class ScheduleHandler extends BaseHandler {
  async handle(_args: MotionSchedulesArgs): Promise<McpToolResponse> {
    try {
      return await this.handleList();
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(): Promise<McpToolResponse> {
    const schedules = await this.motionService.getSchedules();
    return formatScheduleList(schedules);
  }
}
