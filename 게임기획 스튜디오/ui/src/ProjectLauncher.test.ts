import { describe, expect, it } from 'vitest';
import { canCombineProjectEntries, dissolveProjectFolder, dropProjectEntry, reconcileProjectLayout, removeProjectFromFolder, type ProjectLauncherEntry } from './ProjectLauncher';

const folder = (id: string, projectIds: string[]): ProjectLauncherEntry => ({ kind: 'folder', id, name: '새 폴더', projectIds });

describe('project launcher layout', () => {
  it('keeps user order and appends a new project', () => {
    const stored: ProjectLauncherEntry[] = [{ kind: 'project', id: 'b' }, { kind: 'project', id: 'a' }];
    expect(reconcileProjectLayout(stored, ['a', 'b', 'c'])).toEqual([
      { kind: 'project', id: 'b' }, { kind: 'project', id: 'a' }, { kind: 'project', id: 'c' },
    ]);
  });

  it('cleans deleted projects and dissolves a one-project folder', () => {
    const stored: ProjectLauncherEntry[] = [{ kind: 'folder', id: 'f', name: '전투', projectIds: ['a', 'deleted'] }];
    expect(reconcileProjectLayout(stored, ['a'])).toEqual([{ kind: 'project', id: 'a' }]);
  });

  it('creates a folder when one project is dropped on another', () => {
    const result = dropProjectEntry([
      { kind: 'project', id: 'a' }, { kind: 'project', id: 'b' },
    ], 'project:b', 'project:a', true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'folder', name: '새 폴더', projectIds: ['a', 'b'] });
  });

  it('reorders projects when dropped near an edge', () => {
    const result = dropProjectEntry([
      { kind: 'project', id: 'a' }, { kind: 'project', id: 'b' }, { kind: 'project', id: 'c' },
    ], 'project:c', 'project:a', false);
    expect(result.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });

  it('never merges a folder into another folder', () => {
    const result = dropProjectEntry([folder('f1', ['a', 'b']), folder('f2', ['c', 'd'])], 'folder:f1', 'folder:f2', true, true);
    expect(result.filter((entry) => entry.kind === 'folder')).toHaveLength(2);
    expect(result.map((entry) => entry.id)).toEqual(['f2', 'f1']);
  });

  it('never merges a folder into a project and only reorders instead', () => {
    const result = dropProjectEntry([folder('f1', ['a', 'b']), { kind: 'project', id: 'c' }], 'folder:f1', 'project:c', true, true);
    expect(result).toEqual([{ kind: 'project', id: 'c' }, folder('f1', ['a', 'b'])]);
  });

  it('marks only project sources as combinable so the drop highlight cannot lie', () => {
    expect(canCombineProjectEntries({ kind: 'project', id: 'a' }, folder('f1', ['b', 'c']))).toBe(true);
    expect(canCombineProjectEntries({ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' })).toBe(true);
    expect(canCombineProjectEntries(folder('f1', ['a', 'b']), folder('f2', ['c', 'd']))).toBe(false);
    expect(canCombineProjectEntries(folder('f1', ['a', 'b']), { kind: 'project', id: 'c' })).toBe(false);
    expect(canCombineProjectEntries({ kind: 'project', id: 'a' }, { kind: 'project', id: 'a' })).toBe(false);
  });

  it('keeps every project when a folder is deleted from the context menu', () => {
    const entries: ProjectLauncherEntry[] = [{ kind: 'project', id: 'a' }, folder('f1', ['b', 'c'])];
    expect(dissolveProjectFolder(entries, 'f1')).toEqual([{ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' }, { kind: 'project', id: 'c' }]);
    expect(dissolveProjectFolder(entries, 'missing')).toEqual(entries);
  });
  it('takes a project out of a folder and puts it back on the grid', () => {
    const entries: ProjectLauncherEntry[] = [folder('f1', ['a', 'b', 'c']), { kind: 'project', id: 'd' }];
    expect(removeProjectFromFolder(entries, 'f1', 'b')).toEqual([folder('f1', ['a', 'c']), { kind: 'project', id: 'd' }, { kind: 'project', id: 'b' }]);
  });

  it('unwraps the folder when taking out leaves a single project', () => {
    expect(removeProjectFromFolder([folder('f1', ['a', 'b'])], 'f1', 'b')).toEqual([{ kind: 'project', id: 'a' }, { kind: 'project', id: 'b' }]);
  });

  it('ignores a take-out request for a project the folder does not hold', () => {
    const entries: ProjectLauncherEntry[] = [folder('f1', ['a', 'b'])];
    expect(removeProjectFromFolder(entries, 'f1', 'zzz')).toEqual(entries);
    expect(removeProjectFromFolder(entries, 'missing', 'a')).toEqual(entries);
  });
});
