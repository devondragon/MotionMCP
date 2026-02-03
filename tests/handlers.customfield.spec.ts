import { describe, it, expect, vi } from 'vitest';
import { CustomFieldHandler } from '../src/handlers';
import type { HandlerContext } from '../src/handlers/base/HandlerInterface';
import type { MotionCustomFieldsArgs } from '../src/types/mcp-tool-args';

function makeContext() {
  const motionService = {
    getCustomFields: vi.fn().mockResolvedValue([
      { id: 'cf1', name: 'Priority Score', field: 'number' },
      { id: 'cf2', name: 'Category', field: 'select', metadata: { options: ['A', 'B', 'C'] } },
    ]),
    createCustomField: vi.fn().mockResolvedValue({ id: 'cf3', name: 'New Field', field: 'text' }),
    deleteCustomField: vi.fn().mockResolvedValue(undefined),
    addCustomFieldToProject: vi.fn().mockResolvedValue(undefined),
    removeCustomFieldFromProject: vi.fn().mockResolvedValue(undefined),
    addCustomFieldToTask: vi.fn().mockResolvedValue(undefined),
    removeCustomFieldFromTask: vi.fn().mockResolvedValue(undefined),
  } as any;

  const ctx: HandlerContext = {
    motionService,
    workspaceResolver: {} as any,
    validator: {} as any,
  };
  return { ctx, motionService };
}

describe('CustomFieldHandler', () => {
  describe('list operation', () => {
    it('lists custom fields with workspaceId', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = { operation: 'list', workspaceId: 'ws1' };

      const res = await handler.handle(args);

      expect(motionService.getCustomFields).toHaveBeenCalledWith('ws1');
      expect(res.isError).toBeFalsy();
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('cf1');
      expect(text).toContain('cf2');
      expect(text).toContain('number');
      expect(text).toContain('select');
    });

    it('returns error when workspaceId is missing', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = { operation: 'list' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Workspace ID is required');
    });
  });

  describe('create operation', () => {
    it('creates a custom field successfully', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'create',
        workspaceId: 'ws1',
        name: 'New Field',
        field: 'text',
      };

      const res = await handler.handle(args);

      expect(motionService.createCustomField).toHaveBeenCalledWith('ws1', {
        name: 'New Field',
        field: 'text',
      });
      expect(res.isError).toBeFalsy();
    });

    it('creates select field with options', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'create',
        workspaceId: 'ws1',
        name: 'Status',
        field: 'select',
        options: ['Active', 'Inactive'],
      };

      const res = await handler.handle(args);

      expect(motionService.createCustomField).toHaveBeenCalledWith('ws1', {
        name: 'Status',
        field: 'select',
        metadata: { options: ['Active', 'Inactive'] },
      });
      expect(res.isError).toBeFalsy();
    });

    it('returns error when required params missing', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = { operation: 'create', workspaceId: 'ws1' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('name');
    });

    it('returns error when field name too long', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'create',
        workspaceId: 'ws1',
        name: 'x'.repeat(300),
        field: 'text',
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('exceeds');
    });

    it('returns error when options provided for non-select field', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'create',
        workspaceId: 'ws1',
        name: 'Count',
        field: 'number',
        options: ['one', 'two'],
      };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Options parameter only allowed');
    });
  });

  describe('delete operation', () => {
    it('deletes a custom field successfully', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'delete',
        workspaceId: 'ws1',
        fieldId: 'cf1',
      };

      const res = await handler.handle(args);

      expect(motionService.deleteCustomField).toHaveBeenCalledWith('ws1', 'cf1');
      expect(res.isError).toBeFalsy();
    });

    it('returns error when fieldId missing', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = { operation: 'delete', workspaceId: 'ws1' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('field ID');
    });
  });

  describe('add_to_project operation', () => {
    it('adds custom field to project', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'add_to_project',
        projectId: 'proj1',
        fieldId: 'cf1',
        value: 'test value',
      };

      const res = await handler.handle(args);

      expect(motionService.addCustomFieldToProject).toHaveBeenCalledWith('proj1', 'cf1', 'test value');
      expect(res.isError).toBeFalsy();
    });

    it('returns error when projectId missing', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = { operation: 'add_to_project', fieldId: 'cf1' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Project ID');
    });
  });

  describe('remove_from_project operation', () => {
    it('removes custom field from project', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'remove_from_project',
        projectId: 'proj1',
        fieldId: 'cf1',
      };

      const res = await handler.handle(args);

      expect(motionService.removeCustomFieldFromProject).toHaveBeenCalledWith('proj1', 'cf1');
      expect(res.isError).toBeFalsy();
    });
  });

  describe('add_to_task operation', () => {
    it('adds custom field to task', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'add_to_task',
        taskId: 'task1',
        fieldId: 'cf1',
        value: '42',
      };

      const res = await handler.handle(args);

      expect(motionService.addCustomFieldToTask).toHaveBeenCalledWith('task1', 'cf1', '42');
      expect(res.isError).toBeFalsy();
    });

    it('returns error when taskId missing', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = { operation: 'add_to_task', fieldId: 'cf1' };

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Task ID');
    });
  });

  describe('remove_from_task operation', () => {
    it('removes custom field from task', async () => {
      const { ctx, motionService } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args: MotionCustomFieldsArgs = {
        operation: 'remove_from_task',
        taskId: 'task1',
        fieldId: 'cf1',
      };

      const res = await handler.handle(args);

      expect(motionService.removeCustomFieldFromTask).toHaveBeenCalledWith('task1', 'cf1');
      expect(res.isError).toBeFalsy();
    });
  });

  describe('unknown operation', () => {
    it('returns error for unknown operation', async () => {
      const { ctx } = makeContext();
      const handler = new CustomFieldHandler(ctx);
      const args = { operation: 'invalid' } as any;

      const res = await handler.handle(args);

      expect(res.isError).toBe(true);
      const text = (res.content?.[0] as any)?.text || '';
      expect(text).toContain('Unknown operation');
    });
  });
});
