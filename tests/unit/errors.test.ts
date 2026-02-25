import { describe, it, expect, vi } from 'vitest';
import { AxiosError } from 'axios';
import {
  ValidationError,
  WorkspaceError,
  UserFacingError,
  isCodedError,
  extractErrorInfo,
  formatMcpError,
  formatMcpSuccess,
  createUserFacingError,
  createErrorContext
} from '../../src/utils/errors';
import { ERROR_CODES } from '../../src/utils/constants';

// Helper to create a fake AxiosError with a given status code
function fakeAxiosError(status: number, message = 'Request failed'): AxiosError {
  const error = new AxiosError(message, AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
    status,
    data: { message },
    statusText: 'Error',
    headers: {},
    config: {} as any
  } as any);
  return error;
}

describe('ValidationError', () => {
  it('sets code to INVALID_PARAMETERS', () => {
    const err = new ValidationError('bad input');
    expect(err.code).toBe(ERROR_CODES.INVALID_PARAMETERS);
    expect(err.name).toBe('ValidationError');
    expect(err.message).toBe('bad input');
  });

  it('stores parameter and context', () => {
    const err = new ValidationError('missing field', 'email', { form: 'signup' });
    expect(err.parameter).toBe('email');
    expect(err.context).toEqual({ form: 'signup' });
  });

  it('defaults parameter to null and context to {}', () => {
    const err = new ValidationError('oops');
    expect(err.parameter).toBeNull();
    expect(err.context).toEqual({});
  });
});

describe('WorkspaceError', () => {
  it('defaults code to WORKSPACE_NOT_FOUND', () => {
    const err = new WorkspaceError('not found');
    expect(err.code).toBe(ERROR_CODES.WORKSPACE_NOT_FOUND);
    expect(err.name).toBe('WorkspaceError');
  });

  it('accepts a custom error code', () => {
    const err = new WorkspaceError('denied', ERROR_CODES.WORKSPACE_ACCESS_DENIED, { ws: '123' });
    expect(err.code).toBe(ERROR_CODES.WORKSPACE_ACCESS_DENIED);
    expect(err.context).toEqual({ ws: '123' });
  });
});

describe('UserFacingError', () => {
  it('stores user and technical messages', () => {
    const err = new UserFacingError('Something went wrong', 'NullPointerException at line 42');
    expect(err.userMessage).toBe('Something went wrong');
    expect(err.technicalMessage).toBe('NullPointerException at line 42');
    expect(err.message).toBe('Something went wrong'); // super(userMessage)
    expect(err.name).toBe('UserFacingError');
  });

  it('defaults context to {} when not provided', () => {
    const err = new UserFacingError('msg', 'tech');
    expect(err.context).toEqual({});
  });

  it('stores provided context', () => {
    const ctx = { action: 'fetch', resourceType: 'task' };
    const err = new UserFacingError('msg', 'tech', undefined, ctx);
    expect(err.context).toEqual(ctx);
  });

  it('defaults code to INTERNAL_ERROR when no original error', () => {
    const err = new UserFacingError('msg', 'tech');
    expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(err.statusCode).toBeUndefined();
  });

  it('defaults code to INTERNAL_ERROR for non-Axios original error', () => {
    const err = new UserFacingError('msg', 'tech', new Error('plain'));
    expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(err.statusCode).toBeUndefined();
  });

  it('uses explicit statusCode when provided', () => {
    const err = new UserFacingError('msg', 'tech', undefined, {}, 404);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('explicit statusCode overrides Axios-extracted value', () => {
    const err = new UserFacingError('msg', 'tech', fakeAxiosError(500), {}, 429);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
  });

  it('falls back to Axios extraction when statusCode not provided', () => {
    const err = new UserFacingError('msg', 'tech', fakeAxiosError(401));
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ERROR_CODES.AUTH_FAILED);
  });

  describe('httpStatusToErrorCode mapping (via Axios originalError)', () => {
    it('maps 401 to AUTH_FAILED', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(401));
      expect(err.code).toBe(ERROR_CODES.AUTH_FAILED);
      expect(err.statusCode).toBe(401);
    });

    it('maps 403 to ACCESS_DENIED', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(403));
      expect(err.code).toBe(ERROR_CODES.ACCESS_DENIED);
      expect(err.statusCode).toBe(403);
    });

    it('maps 404 to RESOURCE_NOT_FOUND', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(404));
      expect(err.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
    });

    it('maps 400 to INVALID_PARAMETERS', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(400));
      expect(err.code).toBe(ERROR_CODES.INVALID_PARAMETERS);
    });

    it('maps 422 to INVALID_PARAMETERS', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(422));
      expect(err.code).toBe(ERROR_CODES.INVALID_PARAMETERS);
    });

    it('maps 429 to RATE_LIMIT_EXCEEDED', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(429));
      expect(err.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });

    it('maps 500 to MOTION_API_ERROR', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(500));
      expect(err.code).toBe(ERROR_CODES.MOTION_API_ERROR);
    });

    it('maps 502 to MOTION_API_ERROR', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(502));
      expect(err.code).toBe(ERROR_CODES.MOTION_API_ERROR);
    });

    it('maps 503 to MOTION_API_ERROR', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(503));
      expect(err.code).toBe(ERROR_CODES.MOTION_API_ERROR);
    });

    it('maps unknown status to INTERNAL_ERROR', () => {
      const err = new UserFacingError('msg', 'tech', fakeAxiosError(418));
      expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });
});

describe('isCodedError', () => {
  it('returns true for ValidationError', () => {
    expect(isCodedError(new ValidationError('bad'))).toBe(true);
  });

  it('returns true for WorkspaceError', () => {
    expect(isCodedError(new WorkspaceError('missing'))).toBe(true);
  });

  it('returns true for UserFacingError', () => {
    expect(isCodedError(new UserFacingError('msg', 'tech'))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isCodedError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isCodedError('string')).toBe(false);
    expect(isCodedError(null)).toBe(false);
    expect(isCodedError(undefined)).toBe(false);
    expect(isCodedError(42)).toBe(false);
  });
});

describe('extractErrorInfo', () => {
  it('extracts code and context from ValidationError', () => {
    const err = new ValidationError('bad param', 'name', { field: 'name' });
    const info = extractErrorInfo(err);
    expect(info).toEqual({
      message: 'bad param',
      code: ERROR_CODES.INVALID_PARAMETERS,
      context: { field: 'name' }
    });
  });

  it('extracts code and context from WorkspaceError', () => {
    const err = new WorkspaceError('ws missing', ERROR_CODES.NO_DEFAULT_WORKSPACE, { count: 0 });
    const info = extractErrorInfo(err);
    expect(info).toEqual({
      message: 'ws missing',
      code: ERROR_CODES.NO_DEFAULT_WORKSPACE,
      context: { count: 0 }
    });
  });

  it('extracts code and context from UserFacingError', () => {
    const err = new UserFacingError('user msg', 'tech msg', undefined, { action: 'fetch' });
    const info = extractErrorInfo(err);
    expect(info).toEqual({
      message: 'user msg',
      code: ERROR_CODES.INTERNAL_ERROR,
      context: { action: 'fetch' }
    });
  });

  it('falls back to INTERNAL_ERROR for plain Error', () => {
    const info = extractErrorInfo(new Error('oops'));
    expect(info).toEqual({
      message: 'oops',
      code: ERROR_CODES.INTERNAL_ERROR,
      context: {}
    });
  });

  it('handles non-Error values', () => {
    const info = extractErrorInfo('string error');
    expect(info).toEqual({
      message: 'string error',
      code: ERROR_CODES.INTERNAL_ERROR,
      context: {}
    });
  });
});

describe('formatMcpError', () => {
  it('formats ValidationError with code', () => {
    const err = new ValidationError('missing name');
    const result = formatMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Error [INVALID_PARAMETERS]: missing name'
    });
  });

  it('formats WorkspaceError with code', () => {
    const err = new WorkspaceError('not found');
    const result = formatMcpError(err);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Error [WORKSPACE_NOT_FOUND]: not found'
    });
  });

  it('formats UserFacingError with HTTP-derived code', () => {
    const err = new UserFacingError('Unable to load task', 'tech', fakeAxiosError(404));
    const result = formatMcpError(err);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Error [RESOURCE_NOT_FOUND]: Unable to load task'
    });
  });

  it('formats plain Error with INTERNAL_ERROR', () => {
    const result = formatMcpError(new Error('something broke'));
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Error [INTERNAL_ERROR]: something broke'
    });
  });

  it('handles non-Error values', () => {
    const result = formatMcpError('a string');
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Error [INTERNAL_ERROR]: a string'
    });
  });

  it('falls back to default message when error message is empty', () => {
    const result = formatMcpError(new Error(''));
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Error [INTERNAL_ERROR]: An unknown error occurred'
    });
  });
});

describe('formatMcpSuccess', () => {
  it('formats a success response', () => {
    const result = formatMcpSuccess('Task created successfully');
    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Task created successfully'
    });
  });
});

describe('createErrorContext', () => {
  it('creates context with all fields', () => {
    const ctx = createErrorContext('fetch', 'task', 'abc123', 'My Task');
    expect(ctx).toEqual({
      action: 'fetch',
      resourceType: 'task',
      resourceId: 'abc123',
      resourceName: 'My Task'
    });
  });

  it('creates context with only required field', () => {
    const ctx = createErrorContext('list');
    expect(ctx).toEqual({
      action: 'list',
      resourceType: undefined,
      resourceId: undefined,
      resourceName: undefined
    });
  });
});

describe('createUserFacingError', () => {
  it('creates error with user-friendly message for Axios 404', () => {
    const axiosErr = fakeAxiosError(404);
    const ctx = createErrorContext('fetch', 'task', 'abc123');
    const err = createUserFacingError(axiosErr, ctx);

    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.userMessage).toContain('Unable to load task');
    expect(err.userMessage).toContain('not found');
    expect(err.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('creates error with user-friendly message for Axios 401', () => {
    const axiosErr = fakeAxiosError(401);
    const ctx = createErrorContext('update', 'project');
    const err = createUserFacingError(axiosErr, ctx);

    expect(err.userMessage).toContain('Authentication failed');
    expect(err.code).toBe(ERROR_CODES.AUTH_FAILED);
  });

  it('creates error with user-friendly message for Axios 403', () => {
    const axiosErr = fakeAxiosError(403);
    const ctx = createErrorContext('delete', 'task');
    const err = createUserFacingError(axiosErr, ctx);

    expect(err.userMessage).toContain('permission');
    expect(err.code).toBe(ERROR_CODES.ACCESS_DENIED);
  });

  it('creates generic message for non-Axios error', () => {
    const err = createUserFacingError(new Error('something'), createErrorContext('fetch', 'task'));

    expect(err.userMessage).toContain('Unable to load task');
    expect(err.technicalMessage).toBe('something');
    expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
  });

  it('creates generic message for string error', () => {
    const err = createUserFacingError('raw string', createErrorContext('create', 'comment'));

    expect(err.technicalMessage).toBe('raw string');
    expect(err.userMessage).toContain('Unable to create comment');
  });

  it('includes resource name in message when provided', () => {
    const axiosErr = fakeAxiosError(404);
    const ctx = createErrorContext('fetch', 'project', undefined, 'My Project');
    const err = createUserFacingError(axiosErr, ctx);

    expect(err.userMessage).toContain('"My Project"');
  });

  it('includes resource ID in message when provided', () => {
    const axiosErr = fakeAxiosError(404);
    const ctx = createErrorContext('fetch', 'task', 'task-789');
    const err = createUserFacingError(axiosErr, ctx);

    expect(err.userMessage).toContain('(ID: task-789)');
  });

  it('propagates statusCode from Axios error', () => {
    const err = createUserFacingError(fakeAxiosError(429), createErrorContext('fetch', 'task'));
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
  });
});
