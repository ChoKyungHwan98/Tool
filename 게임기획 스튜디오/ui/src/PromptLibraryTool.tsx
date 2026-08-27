import { useEffect, useMemo, useRef, useState } from 'react';
import { studioBridge } from './bridge';
import { Icon } from './icons';
import { composePrompt, extractPromptVariables, filterAndSortPrompts } from './promptLibrary';
import type { PromptHistoryEntry, PromptLibraryState, SavedPrompt } from './types';

type PromptDraft = Pick<SavedPrompt,
  'id' | 'title' | 'description' | 'content' | 'category' | 'tags' | 'target'
  | 'model' | 'temperature' | 'variableDefaults' | 'beginning' | 'ending'
  | 'negativePrompt' | 'searchOptions' | 'removeDuplicateTags'>;

const emptyDraft = (): PromptDraft => ({
  id: '', title: '', description: '', content: '', category: '', tags: [], target: '',
  model: '', temperature: 0.2, variableDefaults: {}, beginning: '', ending: '',
  negativePrompt: '', searchOptions: '', removeDuplicateTags: true,
});

const requestId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function relativeTime(iso: string | null) {
  if (!iso) return '아직 사용 안 함';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

export function PromptLibraryTool() {
  const [library, setLibrary] = useState<PromptLibraryState>();
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<PromptDraft>(emptyDraft);
  const [tagText, setTagText] = useState('');
  const [compositionRevision, setCompositionRevision] = useState(0);
  const [notice, setNotice] = useState('저장 프롬프트와 설정은 다음 실행에도 남습니다.');
  const pendingTitle = useRef('');

  useEffect(() => {
    const unsubscribe = studioBridge.subscribe((message) => {
      if (message.type !== 'prompt:state') return;
      setLibrary(message.library);
      setHistory(message.history);
      if (pendingTitle.current) {
        const saved = message.library.prompts.find((item) => item.title === pendingTitle.current);
        if (saved) {
          setDraft(saved);
          setTagText(saved.tags.join(', '));
        }
        pendingTitle.current = '';
      }
    });
    studioBridge.send({ type: 'prompt:getState', requestId: requestId('prompt-state') });
    return unsubscribe;
  }, []);

  const variables = useMemo(() => extractPromptVariables([
    draft.beginning, draft.searchOptions, draft.content, draft.ending, draft.negativePrompt,
  ].join('\n')), [draft]);
  const visiblePrompts = useMemo(() => filterAndSortPrompts(
    library?.prompts ?? [], query, library?.settings.sortBy ?? 'lastUsed',
  ), [library, query]);
  const composition = useMemo(() => composePrompt(draft), [draft, compositionRevision]);
  const canSave = draft.title.trim().length > 0 && draft.content.trim().length > 0;

  const selectPrompt = (prompt: SavedPrompt) => {
    setDraft(prompt);
    setTagText(prompt.tags.join(', '));
    setNotice(`${prompt.title} 설정을 불러왔습니다.`);
  };

  const savePrompt = () => {
    if (!canSave) return;
    pendingTitle.current = draft.title.trim();
    studioBridge.send({
      type: 'prompt:save', requestId: requestId('prompt-save'),
      prompt: {
        ...draft, title: draft.title.trim(), content: draft.content.trim(),
        tags: tagText.split(',').map((item) => item.trim()).filter(Boolean),
      },
    });
    setNotice('프롬프트 본문과 사용 설정을 저장했습니다.');
  };

  const usePrompt = async () => {
    if (!draft.id || !composition.combinedText.trim() || !library) return;
    try {
      if (library.settings.copyOnUse) await navigator.clipboard.writeText(composition.combinedText);
      studioBridge.send({ type: 'prompt:use', requestId: requestId('prompt-use'), promptId: draft.id, renderedText: composition.combinedText });
      setNotice(library.settings.copyOnUse ? '완성된 프롬프트를 복사하고 이번 세션 기록에 남겼습니다.' : '이번 세션 사용 기록에 남겼습니다.');
    } catch {
      setNotice('클립보드 복사 권한을 확인해 주세요. 사용 기록은 추가하지 않았습니다.');
    }
  };

  const deletePrompt = () => {
    if (!draft.id || !window.confirm(`'${draft.title}' 프롬프트를 보관함에서 삭제할까요?`)) return;
    studioBridge.send({ type: 'prompt:delete', requestId: requestId('prompt-delete'), promptId: draft.id });
    setDraft(emptyDraft());
    setTagText('');
    setNotice('저장 프롬프트를 삭제했습니다.');
  };

  const updateSetting = (settings: Partial<PromptLibraryState['settings']>) => {
    studioBridge.send({ type: 'prompt:updateSettings', requestId: requestId('prompt-settings'), settings });
  };

  if (!library) return <div className="prompt-loading">프롬프트 보관함을 불러오고 있습니다.</div>;

  return (
    <div className="prompt-tool">
      <header className="prompt-tool-header">
        <div><span>PROMBOT 방식 · 로컬 재설계</span><h1>프롬프트 빌더</h1><p>{notice}</p></div>
        <div className="prompt-session-policy"><Icon name="tray" /><span><strong>세션 기록 {history.length}개</strong><small>X로 숨겨도 유지 · 완전 종료 시 삭제</small></span></div>
      </header>

      <div className="prompt-tool-layout">
        <aside className="prompt-list-panel">
          <div className="prompt-panel-title"><span><strong>저장 프롬프트</strong><small>{library.prompts.length}개</small></span><button onClick={() => { setDraft(emptyDraft()); setTagText(''); }} title="새 프롬프트"><Icon name="plus" /></button></div>
          <label className="prompt-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·태그·내용 검색" /></label>
          <select className="prompt-sort" value={library.settings.sortBy} onChange={(event) => updateSetting({ sortBy: event.target.value as PromptLibraryState['settings']['sortBy'] })} aria-label="프롬프트 정렬">
            <option value="lastUsed">최근 사용순</option><option value="updated">최근 수정순</option><option value="title">이름순</option>
          </select>
          <div className="prompt-list">
            {visiblePrompts.map((prompt) => <button key={prompt.id} className={draft.id === prompt.id ? 'active' : ''} onClick={() => selectPrompt(prompt)}><span><strong>{prompt.title}</strong><small>{prompt.category || '분류 없음'} · {relativeTime(prompt.lastUsedAt)}</small></span><em>{prompt.usageCount}</em></button>)}
            {visiblePrompts.length === 0 && <div className="prompt-list-empty"><Icon name="prompt" /><span>{query ? '검색 결과가 없습니다.' : '첫 프롬프트를 만들어 보세요.'}</span></div>}
          </div>
        </aside>

        <main className="prompt-editor-panel">
          <div className="prompt-editor-heading"><span><small>{draft.id ? '저장된 프리셋 편집' : '새 프리셋'}</small><strong>{draft.title || '이름을 입력하세요'}</strong></span><div><button className="prompt-delete" disabled={!draft.id} onClick={deletePrompt}>삭제</button><button disabled={!canSave} onClick={savePrompt}><Icon name="save" /> 저장</button><button className="prompt-use" disabled={!draft.id || !composition.combinedText.trim()} onClick={usePrompt}><Icon name="copy" /> {library.settings.copyOnUse ? '복사하고 사용' : '사용 기록'}</button></div></div>
          <div className="prompt-editor-scroll">
            <div className="prompt-field-grid"><label><span>이름</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="예: 보스 패턴 리뷰" /></label><label><span>분류</span><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="전투, 시스템, 문서" /></label></div>
            <label className="prompt-field"><span>설명</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="언제 사용하는 프롬프트인지" /></label>
            <section className="prompt-composer">
              <header><span><strong>프롬프트 조합</strong><small>시작 + 포함 조건 + 본문 + 끝 · {'<A|B>'}는 조합할 때 하나를 고릅니다.</small></span><label><input type="checkbox" checked={draft.removeDuplicateTags} onChange={(event) => setDraft({ ...draft, removeDuplicateTags: event.target.checked })} /> 중복 태그 제거</label></header>
              <div className="prompt-field-grid">
                <label className="prompt-field"><span>시작 프롬프트</span><textarea className="prompt-mini-textarea" value={draft.beginning} onChange={(event) => setDraft({ ...draft, beginning: event.target.value })} placeholder="best quality, {{대상}}" /></label>
                <label className="prompt-field"><span>포함·제외 조건 · 제외는 ~태그</span><textarea className="prompt-mini-textarea" value={draft.searchOptions} onChange={(event) => setDraft({ ...draft, searchOptions: event.target.value })} placeholder="boss, full body, ~watermark" /></label>
              </div>
              <label className="prompt-field"><span>본문 프롬프트 · 변수는 {'{{변수명}}'}으로 작성</span><textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="{{대상}}의 <Idle|Attack|Recover> 상태, dramatic lighting" /></label>
              <div className="prompt-field-grid">
                <label className="prompt-field"><span>끝 프롬프트</span><textarea className="prompt-mini-textarea" value={draft.ending} onChange={(event) => setDraft({ ...draft, ending: event.target.value })} placeholder="highres, detailed" /></label>
                <label className="prompt-field"><span>네거티브 프롬프트</span><textarea className="prompt-mini-textarea" value={draft.negativePrompt} onChange={(event) => setDraft({ ...draft, negativePrompt: event.target.value })} placeholder="low quality, watermark, text" /></label>
              </div>
            </section>
            <div className="prompt-field-grid prompt-settings-grid"><label><span>대상 도구</span><input value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })} placeholder="ChatGPT, Claude, 이미지 모델" /></label><label><span>선호 모델</span><input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="비워두면 매번 선택" /></label><label><span>Temperature</span><input type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(event) => setDraft({ ...draft, temperature: Math.max(0, Math.min(2, Number(event.target.value))) })} /></label></div>
            <label className="prompt-field"><span>태그 · 쉼표로 구분</span><input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="FSM, 보스, 검증" /></label>
            {variables.length > 0 && <section className="prompt-variables"><header><strong>변수 값</strong><span>{variables.length}개</span></header><div>{variables.map((name) => <label key={name}><span>{name}</span><input value={draft.variableDefaults[name] ?? ''} onChange={(event) => setDraft({ ...draft, variableDefaults: { ...draft.variableDefaults, [name]: event.target.value } })} placeholder={`${name} 값`} /></label>)}</div></section>}
            <section className="prompt-preview"><header><span><strong>완성 결과</strong><small>변수 치환 · 동적 선택 · 제외 · 중복 제거</small></span><button onClick={() => setCompositionRevision((current) => current + 1)}><Icon name="spark" /> 다시 조합</button></header><pre>{composition.combinedText || '프롬프트를 입력하면 완성 결과가 표시됩니다.'}</pre>{(composition.includedTags.length > 0 || composition.excludedTags.length > 0) && <footer><span>포함 {composition.includedTags.length}</span><span>제외 {composition.excludedTags.length}</span></footer>}</section>
          </div>
        </main>

        <aside className="prompt-history-panel">
          <div className="prompt-panel-title"><span><strong>이번 실행 기록</strong><small>프로세스 메모리 전용</small></span><Icon name="clock" /></div>
          <div className="prompt-history-note">창을 X로 닫아 트레이에 숨겨도 남습니다. 트레이의 ‘완전 종료’ 또는 설정의 ‘프로그램 완전 종료’ 후에는 복원되지 않습니다.</div>
          <div className="prompt-history-list">{history.map((entry) => <button key={entry.id} onClick={() => void navigator.clipboard.writeText(entry.renderedText)} title="이 기록을 다시 복사"><span><strong>{entry.title}</strong><small>{relativeTime(entry.usedAt)}</small></span><p>{entry.renderedText}</p><Icon name="copy" /></button>)}{history.length === 0 && <div className="prompt-history-empty"><Icon name="clock" /><strong>아직 사용 기록이 없습니다.</strong><span>저장한 프롬프트를 사용하면 이 실행 동안만 표시됩니다.</span></div>}</div>
          <div className="prompt-global-settings"><label><input type="checkbox" checked={library.settings.copyOnUse} onChange={(event) => updateSetting({ copyOnUse: event.target.checked })} /><span><strong>사용 시 클립보드 복사</strong><small>이 설정은 다음 실행에도 유지됩니다.</small></span></label><label><span><strong>기록 최대 개수</strong><small>메모리에만 보관</small></span><select value={library.settings.historyLimit} onChange={(event) => updateSetting({ historyLimit: Number(event.target.value) })}><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="200">200</option></select></label></div>
        </aside>
      </div>
    </div>
  );
}
