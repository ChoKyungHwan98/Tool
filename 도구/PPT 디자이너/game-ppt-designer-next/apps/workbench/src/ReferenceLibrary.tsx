import { useEffect, useState } from 'react';

type Analysis = { pageGoal: string; primaryClaim: string; semanticShape: string; informationGroups: string[]; relations: string[]; readingPath: string;
  grouping: string[]; hierarchy: string[]; alignment: string[]; whitespace: string[]; whyWorks: string[]; useWhen: string[]; avoidWhen: string[];
  reusablePrinciples: string[]; prohibitedCopy: string[] };
type Candidate = { candidateId: string; title: string; pageUrl: string; sourceCategory: 'official' | 'public-blog' | 'public-portfolio'; imageUrl?: string; status: 'discovered' | 'analyzed' | 'approved' | 'rejected';
  imageWidth?: number; imageHeight?: number; provider?: 'local' | 'openrouter'; analysis?: Analysis; humanReason?: string };
type Settings = { openRouterConfigured: boolean; openRouterModel: string; localEndpoint: string; localModel: string; keyStorage: string };
const api = 'http://127.0.0.1:8766/api/designer/references';

export function ReferenceLibrary({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState('게임 개발 발표 기획 장표');
  const [title, setTitle] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sourceCategory, setSourceCategory] = useState<Candidate['sourceCategory']>('official');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [provider, setProvider] = useState<'local' | 'openrouter'>('openrouter');
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('승인 전 후보는 장표 설계에 사용되지 않습니다.');

  const refresh = async () => {
    const [config, collection] = await Promise.all([fetch(`${api}/settings`), fetch(`${api}/candidates`)]);
    if (!config.ok || !collection.ok) throw new Error('Reference 서비스를 연결할 수 없습니다.');
    setSettings(await config.json() as Settings);
    setCandidates((await collection.json() as { candidates: Candidate[] }).candidates);
  };
  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : String(error))); }, []);
  const action = async (name: string, url: string, payload: unknown) => {
    setBusy(name);
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const value = await response.json() as { candidates?: Candidate[]; error?: string };
      if (!response.ok) throw new Error(value.error ?? `실행 실패 (${response.status})`);
      if (value.candidates) setCandidates(value.candidates);
      await refresh();
      setMessage(`${name} 완료. 원본과 분석 결과를 확인하세요.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(null); }
  };
  const saveSettings = async () => {
    if (!settings) return;
    setBusy('설정');
    try {
      const response = await fetch(`${api}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openRouterKey, openRouterModel: settings.openRouterModel, localEndpoint: settings.localEndpoint, localModel: settings.localModel }) });
      const value = await response.json() as Settings & { error?: string };
      if (!response.ok) throw new Error(value.error ?? 'AI 설정을 저장할 수 없습니다.');
      setSettings(value); setOpenRouterKey(''); setMessage('AI 설정을 이 실행 세션에 적용했습니다. 키는 파일에 저장하지 않습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(null); }
  };
  return <div className="product-shell"><header className="product-top"><button className="crumb" onClick={onBack}>← 전체 프로젝트</button><b>레퍼런스 관리</b><span>PPT 디자이너</span></header>
    <main className="module-overview reference-module"><header><h1>외부 장표 후보</h1><p>AI가 후보를 찾고 이미지의 정보 구조를 분석합니다. 좋은 원칙만 직접 승인하세요.</p></header>
      <section className="reference-config"><h2>AI 연결 설정</h2><p>웹 후보 검색은 OpenRouter가 필요합니다. 이미지 분석은 로컬 모델이나 OpenRouter 중 선택할 수 있습니다.</p>
        <div className="reference-fields"><label>OpenRouter API 키 <input type="password" autoComplete="off" value={openRouterKey} onChange={(event) => setOpenRouterKey(event.target.value)} placeholder={settings?.openRouterConfigured ? '설정됨 · 바꾸려면 새 키 입력' : '키 입력'}/></label>
          <label>OpenRouter 모델 ID <input value={settings?.openRouterModel ?? ''} onChange={(event) => setSettings((current) => current && { ...current, openRouterModel: event.target.value })} placeholder="비전·웹 검색 가능 모델 ID"/></label>
          <label>로컬 모델 주소 <input value={settings?.localEndpoint ?? ''} onChange={(event) => setSettings((current) => current && { ...current, localEndpoint: event.target.value })} placeholder="http://127.0.0.1:8000/v1/chat/completions"/></label>
          <label>로컬 모델 ID <input value={settings?.localModel ?? ''} onChange={(event) => setSettings((current) => current && { ...current, localModel: event.target.value })} placeholder="실행 중인 vision 모델"/></label></div>
        <button disabled={busy !== null || !settings} onClick={() => void saveSettings()}>AI 설정 적용</button><small>OpenRouter 키는 서버 메모리에만 유지됩니다. 앱을 다시 시작하면 환경 변수 또는 재입력이 필요합니다.</small></section>
      <section className="reference-discover"><h2>후보 찾기</h2><div><input aria-label="외부 장표 검색 주제" value={query} onChange={(event) => setQuery(event.target.value)}/><button disabled={busy !== null || !settings?.openRouterConfigured || !settings.openRouterModel} onClick={() => void action('웹 후보 검색', `${api}/discover`, { query })}>AI로 후보 찾기</button></div>
        <p>직접 발견한 자료도 추가할 수 있습니다. AI 검색 결과가 원본 이미지를 찾지 못하면 장표 이미지 URL을 입력하세요.</p>
        <div className="reference-fields"><label>장표 제목<input value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>자료 출처<select value={sourceCategory} onChange={(event) => setSourceCategory(event.target.value as Candidate['sourceCategory'])}><option value="official">공식 발표·개발사</option><option value="public-blog">공개 블로그</option><option value="public-portfolio">공개 포트폴리오</option></select></label><label>원본 페이지 URL<input value={pageUrl} onChange={(event) => setPageUrl(event.target.value)}/></label><label>실제 장표 이미지 URL<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)}/></label></div>
        <button disabled={busy !== null || !title.trim() || !pageUrl.trim()} onClick={() => void action('직접 후보 추가', `${api}/candidates`, { title, pageUrl, imageUrl, sourceCategory })}>후보 추가</button></section>
      <section className="reference-queue"><header><h2>검토 대기열</h2><span>승인 {candidates.filter((item) => item.status === 'approved').length} · 대기 {candidates.filter((item) => ['discovered', 'analyzed'].includes(item.status)).length}</span></header>
        {candidates.length === 0 && <p>아직 수집된 후보가 없습니다.</p>}
        {candidates.map((candidate) => <article key={candidate.candidateId} className={`reference-item reference-${candidate.status}`}>
          <div className="reference-item-head"><div><small>{({ discovered: '이미지 확인 대기', analyzed: '사용자 검토 대기', approved: '승인됨', rejected: '거절됨' })[candidate.status]} · {({ official: '공식 자료', 'public-blog': '공개 블로그', 'public-portfolio': '공개 포트폴리오' })[candidate.sourceCategory]}</small><h3>{candidate.title}</h3><a href={candidate.pageUrl} target="_blank" rel="noreferrer">원본 페이지 열기 ↗</a></div><span>{candidate.imageWidth && candidate.imageHeight ? `${candidate.imageWidth}×${candidate.imageHeight}` : '이미지 미확인'}</span></div>
          {candidate.imageUrl && <img className="reference-image" src={candidate.imageUrl} alt={`${candidate.title} 원본 장표`}/>}
          {candidate.status === 'discovered' && <div className="reference-review-actions"><input aria-label={`${candidate.title} 장표 이미지 URL`} value={imageOverrides[candidate.candidateId] ?? candidate.imageUrl ?? ''} onChange={(event) => setImageOverrides((current) => ({ ...current, [candidate.candidateId]: event.target.value }))} placeholder="https://.../slide.png"/><select value={provider} onChange={(event) => setProvider(event.target.value as 'local' | 'openrouter')}><option value="openrouter">OpenRouter로 분석</option><option value="local">로컬 AI로 분석</option></select><button disabled={busy !== null} onClick={() => void action('장표 분석', `${api}/candidates/${encodeURIComponent(candidate.candidateId)}/analyze`, { provider, imageUrl: imageOverrides[candidate.candidateId] ?? candidate.imageUrl })}>이미지 분석</button></div>}
          {candidate.analysis && <div className="reference-analysis"><dl><dt>장표 목적</dt><dd>{candidate.analysis.pageGoal}</dd><dt>핵심 주장</dt><dd>{candidate.analysis.primaryClaim}</dd><dt>정보 구조</dt><dd>{candidate.analysis.semanticShape} · {candidate.analysis.informationGroups.join(' / ')}</dd><dt>관계·읽는 순서</dt><dd>{candidate.analysis.relations.join(' / ')} · {candidate.analysis.readingPath}</dd><dt>시각 묶음·정렬</dt><dd>{candidate.analysis.grouping.join(' / ')} · {candidate.analysis.alignment.join(' / ')}</dd><dt>왜 효과적인가</dt><dd>{candidate.analysis.whyWorks.join(' / ')}</dd><dt>재사용 원칙</dt><dd>{candidate.analysis.reusablePrinciples.join(' / ')}</dd><dt>사용 조건</dt><dd>{candidate.analysis.useWhen.join(' / ')}</dd><dt>피해야 할 경우</dt><dd>{candidate.analysis.avoidWhen.join(' / ')}</dd><dt>복제 금지</dt><dd>{candidate.analysis.prohibitedCopy.join(' / ')}</dd></dl></div>}
          {candidate.status === 'analyzed' && <div className="reference-review-actions"><input aria-label={`${candidate.title} 판단 이유`} value={reason[candidate.candidateId] ?? ''} onChange={(event) => setReason((current) => ({ ...current, [candidate.candidateId]: event.target.value }))} placeholder="선택 이유 또는 거절 이유"/><button disabled={busy !== null} onClick={() => void action('후보 거절', `${api}/candidates/${encodeURIComponent(candidate.candidateId)}/decision`, { decision: 'reject', reason: reason[candidate.candidateId] })}>거절</button><button disabled={busy !== null} onClick={() => void action('원칙 승인', `${api}/candidates/${encodeURIComponent(candidate.candidateId)}/decision`, { decision: 'approve', reason: reason[candidate.candidateId] })}>원칙 승인</button></div>}
          {candidate.humanReason && <p>사용자 판단: {candidate.humanReason}</p>}
        </article>)}
      </section><p className="reference-message" role="status">{message}</p><button className="module-back" onClick={onBack}>전체 프로젝트로 돌아가기</button>
    </main></div>;
}
