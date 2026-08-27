import { AlertCircle, Check, FileSpreadsheet, KeyRound, Link2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { EntityId } from '../../domain/schema'
import { useWorkbenchStore } from '../state/workbenchStore'

export function ImportPreviewDialog() {
  const open = useWorkbenchStore((state) => state.importDialogOpen)
  const preview = useWorkbenchStore((state) => state.importPreview)
  const status = useWorkbenchStore((state) => state.importStatus)
  const error = useWorkbenchStore((state) => state.importError)
  const close = useWorkbenchStore((state) => state.closeImportDialog)
  const applyImport = useWorkbenchStore((state) => state.applyImport)
  const [tableNames, setTableNames] = useState<Record<EntityId, string>>({})
  const [primaryKeys, setPrimaryKeys] = useState<Record<EntityId, readonly EntityId[]>>({})
  const [approvedRelations, setApprovedRelations] = useState<ReadonlySet<EntityId>>(new Set())

  useEffect(() => {
    if (!preview) return
    setTableNames(Object.fromEntries(preview.tables.map((table) => [table.candidateId, table.name])))
    setPrimaryKeys(Object.fromEntries(preview.tables.map((table) => [table.candidateId, table.primaryKeyColumnIds])))
    setApprovedRelations(new Set())
  }, [preview])

  const canApply = useMemo(() => {
    if (!preview || preview.tables.length === 0) return false
    const names = preview.tables.map((table) => (tableNames[table.candidateId] ?? '').trim().toLowerCase())
    return names.every(Boolean) && new Set(names).size === names.length && preview.tables.every((table) => (primaryKeys[table.candidateId]?.length ?? 0) > 0)
  }, [preview, primaryKeys, tableNames])

  if (!open) return null

  return (
    <div className="modal-backdrop import-backdrop" role="presentation">
      <section className="import-dialog" role="dialog" aria-modal="true" aria-label="가져오기 미리보기">
        <header className="import-dialog-header">
          <div>
            <span className="view-eyebrow">IMPORT PREVIEW</span>
            <h2>CSV·Excel 가져오기</h2>
            <p>적용 전에 시트, 헤더, 타입과 키 후보를 확인하세요.</p>
          </div>
          <button className="icon-button" type="button" title="가져오기 닫기" onClick={close}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="import-dialog-body">
          {status === 'reading' && <div className="import-loading"><FileSpreadsheet aria-hidden="true" size={24} /><strong>파일을 분석하고 있습니다.</strong></div>}
          {status === 'error' && <div className="import-error"><AlertCircle aria-hidden="true" size={20} /><strong>가져오지 못했습니다.</strong><span>{error}</span></div>}
          {status === 'ready' && preview && (
            <>
              <div className="import-summary">
                <strong>{preview.tables.length}개 테이블</strong>
                <span>{preview.sources.join(', ')}</span>
                <span>관계 후보 {preview.relationCandidates.length}개</span>
              </div>
              {preview.warnings.map((warning) => <div className="inline-warning" key={warning}>{warning}</div>)}
              <div className="import-table-list">
                {preview.tables.map((table) => (
                  <article className="import-table" key={table.candidateId}>
                    <div className="import-table-heading">
                      <div>
                        <span>{table.sourceName} · {table.sheetName}</span>
                        <input
                          aria-label={`${table.sheetName} 테이블 이름`}
                          value={tableNames[table.candidateId] ?? table.name}
                          onChange={(event) => setTableNames((current) => ({ ...current, [table.candidateId]: event.target.value }))}
                        />
                      </div>
                      <span className="status-pill">헤더 {table.headerRow}행 · 데이터 {table.rows.length}행</span>
                    </div>
                    <div className="import-column-grid" role="table" aria-label={`${table.name} 열 후보`}>
                      <div className="import-column-head" role="row"><span>PK</span><span>헤더</span><span>추론 타입</span><span>빈 값</span></div>
                      {table.columns.map((column) => {
                        const selected = primaryKeys[table.candidateId]?.includes(column.columnId) ?? false
                        return (
                          <label className="import-column-row" role="row" key={column.columnId}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => setPrimaryKeys((current) => {
                                const next = new Set(current[table.candidateId] ?? [])
                                if (event.target.checked) next.add(column.columnId)
                                else next.delete(column.columnId)
                                return { ...current, [table.candidateId]: [...next] }
                              })}
                            />
                            <strong>{column.name}</strong>
                            <span>{column.dataType.kind}</span>
                            <span>{column.nullable ? '있음' : '없음'}{column.primaryKeyCandidate ? ' · 고유' : ''}</span>
                          </label>
                        )
                      })}
                    </div>
                  </article>
                ))}
              </div>

              <section className="relation-candidates">
                <div className="import-section-title"><Link2 aria-hidden="true" size={16} /><div><strong>FK 관계 후보</strong><span>자동 적용되지 않습니다. 확인한 관계만 생성합니다.</span></div></div>
                {preview.relationCandidates.length === 0 ? (
                  <p className="empty-detail">값과 이름이 일치하는 관계 후보가 없습니다.</p>
                ) : preview.relationCandidates.map((relation) => (
                  <label className="relation-candidate" key={relation.candidateId}>
                    <input
                      type="checkbox"
                      checked={approvedRelations.has(relation.candidateId)}
                      onChange={(event) => setApprovedRelations((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(relation.candidateId)
                        else next.delete(relation.candidateId)
                        return next
                      })}
                    />
                    <KeyRound aria-hidden="true" size={15} />
                    <div><strong>{relation.name}</strong><span>{relation.reason}</span></div>
                    <small>{relation.confidence === 'high' ? '높은 신뢰도' : '검토 필요'}</small>
                  </label>
                ))}
              </section>
            </>
          )}
        </div>

        <footer className="import-dialog-footer">
          <span>{canApply ? '가져오기 준비가 완료되었습니다.' : '모든 테이블에 이름과 PK를 지정하세요.'}</span>
          <div>
            <button className="tool-button" type="button" onClick={close}>취소</button>
            <button
              className="primary-action"
              type="button"
              disabled={!canApply}
              onClick={() => applyImport({
                tableNames,
                primaryKeys,
                approvedRelationCandidateIds: [...approvedRelations],
              })}
            >
              <Check aria-hidden="true" size={16} />
              {preview?.tables.length ?? 0}개 테이블 적용
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
