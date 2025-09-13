import { BaseHandler } from './base/BaseHandler';
import { McpToolResponse } from '../types/mcp';
import { MotionSchedulesArgs } from '../types/mcp-tool-args';
import { formatScheduleList } from '../utils';

export class ScheduleHandler extends BaseHandler {
  async handle(args: MotionSchedulesArgs): Promise<McpToolResponse> {
    try {
      const { userId, startDate, endDate } = args;
      return await this.handleList(userId, startDate, endDate);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private async handleList(userId?: string, startDate?: string, endDate?: string): Promise<McpToolResponse> {
    // Validate date formats if provided
    const isValidDate = (dateStr: string | undefined): boolean => {
      if (!dateStr) return true; // Optional fields are valid when not provided
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    };

    if (!isValidDate(startDate)) {
      return this.handleError(new Error('startDate must be a valid date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z")'));
    }

    if (!isValidDate(endDate)) {
      return this.handleError(new Error('endDate must be a valid date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z")'));
    }

    // Validate date range logic if both dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        return this.handleError(new Error('startDate must be before or equal to endDate'));
      }
    }

    const schedules = await this.motionService.getSchedules(userId, startDate, endDate);
    return formatScheduleList(schedules);
  }
}