import { describe, expect, it } from 'vitest';
import { formatCustomFieldSuccess, formatDetailResponse } from '../src/utils';

describe('responseFormatters', () => {
  it('formats detail response with all fields when field list is omitted', () => {
    const res = formatDetailResponse(
      { id: 'p1', name: 'Project A', workspaceId: 'w1' },
      'Project details for "Project A"'
    );
    const text = (res.content?.[0] as any)?.text || '';

    expect(text).toContain('- Id: p1');
    expect(text).toContain('- Name: Project A');
    expect(text).toContain('- WorkspaceId: w1');
  });

  it('does not render remove_from_undefined tips', () => {
    const res = formatCustomFieldSuccess('added', undefined, undefined, {
      id: 'val_1',
      type: 'text',
      value: 'hello'
    });
    const text = (res.content?.[0] as any)?.text || '';

    expect(text).not.toContain('remove_from_undefined');
    expect(text).toContain('Value ID: val_1');
  });
});
