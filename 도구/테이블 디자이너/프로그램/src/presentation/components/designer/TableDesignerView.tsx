import { Check, Columns3, KeyRound, Link2, PenLine, Plus, ShieldCheck, Table2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DataTypeKind, EntityId } from '../../../domain/schema'
import { useWorkbenchStore } from '../../state/workbenchStore'
import { describeRelationMapping } from '../../relationMapping'

const EDITABLE_TYPES: readonly DataTypeKind[] = [
  'string', 'int32', 'int64', 'float', 'double', 'boolean', 'date', 'datetime',
  'resource_ref', 'localization_ref', 'json',
]

export function TableDesignerView() {
  const project = useWorkbenchStore((state) => state.document.schema)
  const selectedTableId = useWorkbenchStore((state) => state.selectedTableId)
  const table = project.tables.find((candidate) => candidate.tableId === selectedTableId) ?? project.tables[0]

  if (!table) {
    return <section className="designer-shell empty-workspace">설계할 테이블이 없습니다.</section>
  }

  return <TableDesignerContent key={table.tableId} tableId={table.tableId} />
}

function TableDesignerContent({ tableId }: { readonly tableId: EntityId }) {
  const project = useWorkbenchStore((state) => state.document.schema)
  const designerTab = useWorkbenchStore((state) => state.designerTab)
  const setDesignerTab = useWorkbenchStore((state) => state.setDesignerTab)
  const selectedColumnId = useWorkbenchStore((state) => state.selectedColumnId)
  const selectColumn = useWorkbenchStore((state) => state.selectColumn)
  const renameTable = useWorkbenchStore((state) => state.renameTable)
  const renameColumn = useWorkbenchStore((state) => state.renameColumn)
  const changeTableDescription = useWorkbenchStore((state) => state.changeTableDescription)
  const changeColumnDescription = useWorkbenchStore((state) => state.changeColumnDescription)
  const setColumnNullable = useWorkbenchStore((state) => state.setColumnNullable)
  const setPrimaryKeyColumns = useWorkbenchStore((state) => state.setPrimaryKeyColumns)
  const setColumnType = useWorkbenchStore((state) => state.setColumnType)
  const setColumnDefault = useWorkbenchStore((state) => state.setColumnDefault)
  const addUniqueConstraint = useWorkbenchStore((state) => state.addUniqueConstraint)
  const createForeignKeyMapping = useWorkbenchStore((state) => state.createForeignKeyMapping)
  const deleteRelation = useWorkbenchStore((state) => state.deleteRelation)
  const addColumnToTable = useWorkbenchStore((state) => state.addColumnToTable)
  const table = project.tables.find((candidate) => candidate.tableId === tableId)!
  const selectedColumn = selectedColumnId
    ? table.columns.find((column) => column.columnId === selectedColumnId) ?? table.columns[0]
    : table.columns[0]
  const [tableDraftName, setTableDraftName] = useState(table.name)
  const [tableDescriptionDraft, setTableDescriptionDraft] = useState(table.description)
  const [columnDraftName, setColumnDraftName] = useState(selectedColumn?.name ?? '')
  const [columnDescriptionDraft, setColumnDescriptionDraft] = useState(selectedColumn?.description ?? '')
  const [defaultDraft, setDefaultDraft] = useState(selectedColumn?.defaultValue === undefined ? '' : String(selectedColumn.defaultValue))
  const [primaryKeyDraft, setPrimaryKeyDraft] = useState<ReadonlySet<EntityId>>(new Set(table.primaryKey.columnIds))
  const otherTables = project.tables.filter((candidate) => candidate.tableId !== table.tableId)
  const [targetTableId, setTargetTableId] = useState<EntityId>('')
  const [sourceMapping, setSourceMapping] = useState<ReadonlySet<EntityId>>(new Set())
  const targetTable = otherTables.find((candidate) => candidate.tableId === targetTableId)
  const targetKeyIds = targetTable?.primaryKey.columnIds ?? []
  const tableRelations = project.relations.filter((relation) => relation.sourceTableId === table.tableId || relation.targetTableId === table.tableId)

  useEffect(() => setTableDraftName(table.name), [table.name])
  useEffect(() => setTableDescriptionDraft(table.description), [table.description])
  useEffect(() => {
    setColumnDraftName(selectedColumn?.name ?? '')
    setColumnDescriptionDraft(selectedColumn?.description ?? '')
    setDefaultDraft(selectedColumn?.defaultValue === undefined ? '' : String(selectedColumn.defaultValue))
    setSourceMapping(new Set())
  }, [selectedColumn])
  useEffect(() => {
    setTargetTableId('')
    setSourceMapping(new Set())
  }, [tableId])
  useEffect(() => setPrimaryKeyDraft(new Set(table.primaryKey.columnIds)), [table.primaryKey.columnIds])

  const sourceMappingIds = [...sourceMapping]
  const canCreateRelation = Boolean(targetTable && targetKeyIds.length > 0 && sourceMappingIds.length === targetKeyIds.length)

  return (
    <section className="designer-shell" aria-label="테이블 설계">
      <div className="view-header designer-header">
        <div><h1>테이블 설계</h1><p>{table.name} · {table.columns.length}열 · {tableRelations.length}개 연결</p></div>
        <nav className="designer-tabs" aria-label="테이블 설계 보기">
          <button className={designerTab === 'basic' ? 'active' : ''} type="button" onClick={() => setDesignerTab('basic')}><Columns3 aria-hidden="true" size={15} />기본</button>
          <button className={designerTab === 'relations' ? 'active' : ''} type="button" onClick={() => setDesignerTab('relations')}><Link2 aria-hidden="true" size={15} />키와 관계</button>
        </nav>
      </div>

      {designerTab === 'basic' ? (
        <div className="designer-basic">
          <aside className="designer-column-pane">
            <div className="designer-table-field">
              <label className="field-label" htmlFor="designer-table-name">테이블 이름</label>
              <div className="inline-field">
                <input
                  id="designer-table-name"
                  value={tableDraftName}
                  onChange={(event) => setTableDraftName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') renameTable(table.tableId, tableDraftName) }}
                />
                <button className="icon-button" type="button" title="테이블 이름 변경" onClick={() => renameTable(table.tableId, tableDraftName)}><PenLine aria-hidden="true" size={16} /></button>
              </div>
              <label className="field-label" htmlFor="designer-table-description">테이블 설명</label>
              <textarea
                id="designer-table-description"
                rows={3}
                placeholder="이 테이블이 관리하는 게임 데이터를 설명하세요."
                value={tableDescriptionDraft}
                onChange={(event) => setTableDescriptionDraft(event.target.value)}
                onBlur={() => {
                  if (tableDescriptionDraft.trim() !== table.description) changeTableDescription(table.tableId, tableDescriptionDraft)
                }}
              />
            </div>

            <div className="section-title-row designer-column-heading">
              <SectionTitle icon={Columns3} title="열" />
              <button className="mini-action" type="button" onClick={() => addColumnToTable(table.tableId)}><Plus aria-hidden="true" size={14} /><span>열 추가</span></button>
            </div>
            <div className="designer-column-list">
              {table.columns.map((column) => {
                const isPk = table.primaryKey.columnIds.includes(column.columnId)
                const isFk = project.relations.some((relation) => relation.sourceColumnIds.includes(column.columnId))
                return (
                  <button
                    key={column.columnId}
                    className={selectedColumn?.columnId === column.columnId ? 'designer-column active' : 'designer-column'}
                    type="button"
                    onClick={() => selectColumn(column.columnId)}
                  >
                    <span className={isPk ? 'key-chip pk' : isFk ? 'key-chip fk' : 'key-chip'}>{isPk ? 'PK' : isFk ? 'FK' : '—'}</span>
                    <strong title={column.name}>{column.name}</strong><span>{column.dataType.kind}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="designer-detail-pane">
            <SectionTitle icon={KeyRound} title={selectedColumn ? selectedColumn.name : '열을 선택하세요'} />
            {selectedColumn && (
              <div className="column-form">
                <label className="field-label" htmlFor="designer-column-name">열 이름</label>
                <div className="inline-field">
                  <input
                    id="designer-column-name"
                    value={columnDraftName}
                    onChange={(event) => setColumnDraftName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') renameColumn(table.tableId, selectedColumn.columnId, columnDraftName) }}
                  />
                  <button className="icon-button" type="button" title="열 이름 변경" onClick={() => renameColumn(table.tableId, selectedColumn.columnId, columnDraftName)}><PenLine aria-hidden="true" size={16} /></button>
                </div>
                <label className="field-label" htmlFor="designer-column-description">열 설명</label>
                <textarea
                  id="designer-column-description"
                  rows={3}
                  placeholder="값의 의미, 단위 또는 사용 규칙을 설명하세요."
                  value={columnDescriptionDraft}
                  onChange={(event) => setColumnDescriptionDraft(event.target.value)}
                  onBlur={() => {
                    if (columnDescriptionDraft.trim() !== selectedColumn.description) {
                      changeColumnDescription(table.tableId, selectedColumn.columnId, columnDescriptionDraft)
                    }
                  }}
                />

                <div className="two-field-grid">
                  <label><span className="field-label">데이터 타입</span>
                    <select
                      aria-label="데이터 타입"
                      value={selectedColumn.dataType.kind}
                      onChange={(event) => setColumnType(table.tableId, selectedColumn.columnId, { kind: event.target.value as Exclude<DataTypeKind, 'enum' | 'list'> })}
                    >
                      {EDITABLE_TYPES.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                    </select>
                  </label>
                  <label><span className="field-label">기본값</span>
                    <div className="inline-field compact-input">
                      <input aria-label="기본값" placeholder="없음" value={defaultDraft} onChange={(event) => setDefaultDraft(event.target.value)} />
                      <button className="icon-button" type="button" title="기본값 적용" onClick={() => setColumnDefault(table.tableId, selectedColumn.columnId, defaultDraft || undefined)}><Check aria-hidden="true" size={15} /></button>
                    </div>
                  </label>
                </div>

                <button
                  className="wide-action"
                  type="button"
                  disabled={table.primaryKey.columnIds.includes(selectedColumn.columnId) && !selectedColumn.nullable}
                  onClick={() => setColumnNullable(table.tableId, selectedColumn.columnId, !selectedColumn.nullable)}
                >
                  <Check aria-hidden="true" size={16} />
                  {table.primaryKey.columnIds.includes(selectedColumn.columnId) && !selectedColumn.nullable ? 'PK는 필수' : selectedColumn.nullable ? '필수로 변경' : '빈칸 허용'}
                </button>

                <dl className="column-facts">
                  <div><dt>키</dt><dd>{table.primaryKey.columnIds.includes(selectedColumn.columnId) ? 'PK' : project.relations.some((relation) => relation.sourceColumnIds.includes(selectedColumn.columnId)) ? 'FK' : '일반 열'}</dd></div>
                  <div><dt>연결</dt><dd>{project.relations.filter((relation) => relation.sourceColumnIds.includes(selectedColumn.columnId) || relation.targetColumnIds.includes(selectedColumn.columnId)).length}개</dd></div>
                  <div><dt>규칙</dt><dd>{selectedColumn.validationRules.length}개</dd></div>
                </dl>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="designer-relations">
          <section className="relation-workspace-section">
            <SectionTitle icon={KeyRound} title="기본 키 (PK)" />
            <div className="constraint-checks">
              {table.columns.map((column) => (
                <label key={column.columnId}>
                  <input
                    type="checkbox"
                    checked={primaryKeyDraft.has(column.columnId)}
                    onChange={(event) => setPrimaryKeyDraft((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(column.columnId)
                      else next.delete(column.columnId)
                      return next
                    })}
                  />
                  <span>{column.name}</span>
                </label>
              ))}
            </div>
            <button className="wide-action" type="button" disabled={primaryKeyDraft.size === 0} onClick={() => setPrimaryKeyColumns(table.tableId, [...primaryKeyDraft])}><ShieldCheck aria-hidden="true" size={16} />PK 적용</button>
            <button className="text-action constraint-text-action" type="button" disabled={!selectedColumn} onClick={() => selectedColumn && addUniqueConstraint(table.tableId, [selectedColumn.columnId])}>선택 열에 고유값 설정</button>
          </section>

          <section className="relation-workspace-section relation-builder">
            <SectionTitle icon={Link2} title="다른 테이블 연결 (FK)" />
            {otherTables.length === 0 ? <p className="empty-detail">연결할 다른 테이블이 없습니다.</p> : (
              <>
                <label className="field-label" htmlFor="fk-target-table">대상 테이블</label>
                <select id="fk-target-table" value={targetTableId} onChange={(event) => {
                  setTargetTableId(event.target.value)
                  setSourceMapping(new Set())
                }}>
                  <option value="">대상 테이블을 선택하세요</option>
                  {otherTables.map((candidate) => <option key={candidate.tableId} value={candidate.tableId}>{candidate.name}</option>)}
                </select>
                <div className="relation-map-grid">
                  <div><strong>현재 테이블 열</strong>{table.columns.map((column) => (
                    <label key={column.columnId}><input type="checkbox" checked={sourceMapping.has(column.columnId)} onChange={(event) => setSourceMapping((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(column.columnId)
                      else next.delete(column.columnId)
                      return next
                    })} /><span>{column.name}</span></label>
                  ))}</div>
                  <div><strong>대상 PK</strong>{targetTable?.columns.filter((column) => targetKeyIds.includes(column.columnId)).map((column) => <span className="target-key" key={column.columnId}>{column.name}</span>)}</div>
                </div>
                <button className="wide-action" type="button" disabled={!canCreateRelation} onClick={() => targetTable && createForeignKeyMapping(table.tableId, sourceMappingIds, targetTable.tableId, targetKeyIds)}><Link2 aria-hidden="true" size={16} />연결 만들기</button>
              </>
            )}
          </section>

          <section className="relation-workspace-section relation-list">
            <SectionTitle icon={ShieldCheck} title="현재 키와 연결" />
            <div className="constraint-list">
              {table.uniqueConstraints.map((constraint) => <div key={constraint.constraintId}><span className="key-chip uq">UQ</span><strong>{constraint.name}</strong></div>)}
              {tableRelations.map((relation) => {
                const mapping = describeRelationMapping(project, relation)
                return (
                  <div className="relation-list-item" key={relation.relationId}>
                    <span className={relation.sourceTableId === table.tableId ? 'key-chip fk' : 'key-chip incoming'}>{relation.sourceTableId === table.tableId ? 'FK' : '참조됨'}</span>
                    <div className="relation-list-copy"><strong>{relation.name}</strong><small>{mapping.text}</small></div>
                    <button className="text-action relation-delete-action" type="button" onClick={() => deleteRelation(relation.relationId)}>삭제</button>
                  </div>
                )
              })}
              {table.uniqueConstraints.length === 0 && tableRelations.length === 0 && <p className="empty-detail">설정된 키나 연결이 없습니다.</p>}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function SectionTitle({ icon: Icon, title }: { readonly icon: typeof Table2; readonly title: string }) {
  return <div className="design-section-title"><Icon aria-hidden="true" size={17} /><strong>{title}</strong></div>
}
