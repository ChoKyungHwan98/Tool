import './DownloadsPanel.css';
import { useEffect, useRef } from 'react';
import { studioBridge } from '../bridge';
import { Icon } from '../icons';
import type { DownloadRecord } from '../types';

// 스튜디오 안에서 받은 파일 기록. 왼쪽 아이콘 줄의 '다운로드'에서 연다.
// 기본 다운로드 창은 잠깐 떴다 사라지므로 여기서 다시 열고 폴더를 찾을 수 있게 한다.

function formatSize(bytes: number) {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stateLabel(item: DownloadRecord) {
  if (item.state === 'in_progress') return '받는 중';
  if (item.state === 'interrupted') return '실패';
  if (!item.exists) return '파일 없음';
  return '';
}

export function DownloadsPanel({ items, onClose }: { items: readonly DownloadRecord[]; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    studioBridge.send({ type: 'downloads:list', requestId: crypto.randomUUID() });
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-downloads-toggle]')) return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const send = (type: 'downloads:open' | 'downloads:reveal' | 'downloads:remove', id: string) =>
    studioBridge.send({ type, requestId: crypto.randomUUID(), id });

  return (
    <section className="downloads-panel" ref={panel} role="dialog" aria-label="다운로드">
      <header>
        <strong>다운로드</strong>
        {items.length > 0 && (
          <button type="button" className="downloads-clear" onClick={() => studioBridge.send({ type: 'downloads:clear', requestId: crypto.randomUUID() })}>
            기록 지우기
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <p className="downloads-empty">아직 받은 파일이 없습니다. 도구에서 내보내기를 하면 여기에 쌓입니다.</p>
      ) : (
        <ul>
          {items.map((item) => {
            const label = stateLabel(item);
            const usable = item.state === 'completed' && item.exists;
            return (
              <li key={item.id} className={usable ? undefined : 'is-unavailable'}>
                <Icon name="document" />
                <div className="downloads-copy">
                  <strong title={item.path}>{item.name}</strong>
                  <small>
                    {formatTime(item.finishedAt ?? item.startedAt)}
                    {formatSize(item.receivedBytes || item.totalBytes) && ` · ${formatSize(item.receivedBytes || item.totalBytes)}`}
                    {label && <em> · {label}</em>}
                  </small>
                </div>
                <div className="downloads-actions">
                  <button type="button" disabled={!usable} onClick={() => send('downloads:open', item.id)}>열기</button>
                  <button type="button" disabled={!usable} onClick={() => send('downloads:reveal', item.id)}>폴더</button>
                  <button type="button" className="downloads-remove" title="기록에서 지우기(파일은 남음)" aria-label={`${item.name} 기록 지우기`} onClick={() => send('downloads:remove', item.id)}>
                    <Icon name="close" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
