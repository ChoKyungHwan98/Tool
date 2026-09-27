import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('R7 product-facing information architecture', () => {
  it('starts from projects, exposes four product areas, and hides internal architecture terms', async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), 'StudioWorkbench.tsx'), 'utf8');
    for (const label of ['프로젝트', '기획서', '발표자료', 'AI 학습', '모델 관리', '후보 비교', 'AI 사용 내역', '변경 기록']) expect(source).toContain(label);
    for (const label of ['사람 평가', '학습 가능 여부', '검증 전', '이 모델 사용', '이전 모델로 되돌리기']) expect(source).toContain(label);
    for (const internal of ['SlideIR', 'InformationPlan', 'CompositionPlan', 'RenderTree', 'Harness', 'Teacher ID']) expect(source).not.toContain(internal);
    expect(source).toContain("useState<'projects' | 'project' | 'workspace'");
    expect(source).toContain("surface !== 'none'");
  });

  it('keeps AI quality tools on the home and asks for the authoring mode only on first project entry', async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), 'StudioWorkbench.tsx'), 'utf8');
    for (const label of ['전체 프로젝트', 'AI 품질 관리', '새 프로젝트', '기획서 모드', '발표 모드']) expect(source).toContain(label);
    expect(source).toContain('NewProjectDialog');
    expect(source).toContain('className="project-mode-grid"');
    expect(source).toContain("openArea('기획서')");
    expect(source).toContain("openArea('발표자료')");
    expect(source).toContain("setScreen('learning')");
    expect(source).toContain("setScreen('models')");
    expect(source).toContain('rememberedProjectMode');
    expect(source).toContain('localStorage.setItem(projectModeKey');
    expect(source).not.toContain('className="authoring-home"');
    expect(source).toContain('className="slide-navigator"');
    expect(source).toContain('원고 편집');
    expect(source).not.toContain('<section className="recent-work">');
    expect(source).not.toContain('setMode(newProjectMode)');
    expect(source).not.toContain('window.prompt');
  });

  it('uses the shared review-home visual language without decorative brand or project count', async () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(resolve(directory, 'StudioWorkbench.tsx'), 'utf8');
    const styles = await readFile(resolve(directory, 'styles.css'), 'utf8');
    expect(source).toContain('<div className="studio-home-brand"><b>PPT 디자이너</b></div>');
    expect(source).not.toContain('<HomeIcon kind="projects"/><b>전체 프로젝트</b>');
    expect(source).not.toContain('<HomeIcon kind="recent"/><b>최근 작업</b>');
    expect(source).not.toContain('setProjectScope');
    expect(source).toContain('<nav aria-label="프로젝트 관리"><button className="is-active" type="button"><b>전체 프로젝트</b></button></nav>');
    expect(source).not.toContain('<em>{projects.length}</em>');
    expect(source).not.toContain('<span>AI 품질 관리</span>');
    for (const token of ['#F2F4F6', '#191F28', '#333D4B', '#8B95A1', '#3182F6', '#E5E8EB']) expect(styles).toContain(token);
    expect(styles).toContain('grid-template-columns:260px minmax(0,1fr)');
    expect(styles).toContain('font-size: 14px;');
    expect(styles).toContain('.studio-home-heading h1 {line-height: 1.5;}');
    expect(styles).toContain('.studio-home-main::-webkit-scrollbar {width: 10px;}');
    expect(styles).toContain('font-synthesis: weight style small-caps;');
    expect(styles).toContain('text-rendering: auto;');
    expect(styles).toMatch(/\.studio-home-shell\s*\{[^}]*border-radius:\s*16px;[^}]*overflow:\s*hidden;/);
    expect(styles).toContain('html:has(.studio-home-shell) {background: #F2F2F4;}');
    expect(source).toContain('<input className="studio-home-search" aria-label="프로젝트 검색"');
    expect(source).not.toContain('<HomeIcon kind="search"/>');
    expect(styles).toContain('background-position: calc(100% - 12px) center;');
    expect(styles).toContain('justify-content: flex-start;\n  line-height: normal;\n  padding: 12px 20px;');
    expect(styles).toContain('.project-overview>header {display: block;}');
  });
});
