import { describe, expect, it } from 'vitest';
import { canCombineHomeEntries, dissolveHomeFolder, dropHomeEntry, reconcileHomeLayout, removeFromHomeFolder, sanitizeHomeLayout, type HomeEntry } from './ProjectHomeLauncher.js';

const folder = (id: string, projectIds: string[]): HomeEntry => ({ kind: 'folder', id, name: '새 폴더', projectIds });

describe('PPT project home layout', () => {
  it('keeps saved order and appends new projects', () => { expect(reconcileHomeLayout([{ kind: 'project', id: 'b' }], ['a', 'b', 'c']).map((entry) => entry.id)).toEqual(['b', 'a', 'c']); });
  it('combines projects into a folder and dissolves it after deletion', () => { const entries: HomeEntry[] = [{ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' }]; const foldered = dropHomeEntry(entries, 'project:a', 'project:b', true, false); expect(foldered[0]).toMatchObject({ kind: 'folder', projectIds: ['b', 'a'] }); expect(reconcileHomeLayout(foldered, ['a'])).toEqual([{ kind: 'project', id: 'a' }]); });
  it('ignores malformed saved folders instead of crashing the home screen', () => { expect(sanitizeHomeLayout([{ kind: 'folder', id: 'broken', name: '폴더' }, { kind: 'project', id: 'a' }, null])).toEqual([{ kind: 'project', id: 'a' }]); });

  it('never merges a folder into another folder', () => {
    const entries: HomeEntry[] = [folder('f1', ['a', 'b']), folder('f2', ['c', 'd'])];
    const dropped = dropHomeEntry(entries, 'folder:f1', 'folder:f2', true, true);
    expect(dropped.filter((entry) => entry.kind === 'folder')).toHaveLength(2);
    expect(dropped.map((entry) => entry.id)).toEqual(['f2', 'f1']);
  });

  it('never merges a folder into a project and only reorders instead', () => {
    const entries: HomeEntry[] = [folder('f1', ['a', 'b']), { kind: 'project', id: 'c' }];
    const dropped = dropHomeEntry(entries, 'folder:f1', 'project:c', true, true);
    expect(dropped).toEqual([{ kind: 'project', id: 'c' }, folder('f1', ['a', 'b'])]);
  });

  it('marks only project sources as combinable so the drop highlight cannot lie', () => {
    expect(canCombineHomeEntries({ kind: 'project', id: 'a' }, folder('f1', ['b', 'c']))).toBe(true);
    expect(canCombineHomeEntries({ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' })).toBe(true);
    expect(canCombineHomeEntries(folder('f1', ['a', 'b']), folder('f2', ['c', 'd']))).toBe(false);
    expect(canCombineHomeEntries(folder('f1', ['a', 'b']), { kind: 'project', id: 'c' })).toBe(false);
    expect(canCombineHomeEntries({ kind: 'project', id: 'a' }, { kind: 'project', id: 'a' })).toBe(false);
  });

  it('keeps every project when a folder is deleted from the context menu', () => {
    const entries: HomeEntry[] = [{ kind: 'project', id: 'a' }, folder('f1', ['b', 'c'])];
    expect(dissolveHomeFolder(entries, 'f1')).toEqual([{ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' }, { kind: 'project', id: 'c' }]);
    expect(dissolveHomeFolder(entries, 'missing')).toEqual(entries);
  });
  it('takes a project out of a folder and puts it back on the grid', () => {
    const entries: HomeEntry[] = [folder('f1', ['a', 'b', 'c']), { kind: 'project', id: 'd' }];
    expect(removeFromHomeFolder(entries, 'f1', 'b')).toEqual([folder('f1', ['a', 'c']), { kind: 'project', id: 'd' }, { kind: 'project', id: 'b' }]);
  });

  it('unwraps the folder when taking out leaves a single project', () => {
    const entries: HomeEntry[] = [folder('f1', ['a', 'b'])];
    expect(removeFromHomeFolder(entries, 'f1', 'b')).toEqual([{ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' }]);
  });

  it('ignores a take-out request for a project the folder does not hold', () => {
    const entries: HomeEntry[] = [folder('f1', ['a', 'b'])];
    expect(removeFromHomeFolder(entries, 'f1', 'zzz')).toEqual(entries);
    expect(removeFromHomeFolder(entries, 'missing', 'a')).toEqual(entries);
  });
});
