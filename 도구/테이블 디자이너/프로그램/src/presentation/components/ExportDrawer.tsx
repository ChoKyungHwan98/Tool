import { CheckCircle2, Download, FileJson2, FileSpreadsheet, LoaderCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { validateProjectWithRows } from '../../domain/validator'
import { serializeDocument } from '../../infrastructure/projectPersistence'
import { exportIntegratedWorkbook } from '../../infrastructure/workbookExportClient'
import { useWorkbenchStore } from '../state/workbenchStore'

export function ExportDrawer() {
  const exportOpen = useWorkbenchStore((state) => state.exportOpen)
  const setExportOpen = useWorkbenchStore((state) => state.setExportOpen)
  const documentValue = useWorkbenchStore((state) => state.document)
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const project = documentValue.schema
  const issues = useMemo(() => validateProjectWithRows(project, documentValue.rowsByTable), [documentValue.rowsByTable, project])
  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking' || issue.severity === 'error')

  useEffect(() => {
    if (!exportOpen) return undefined
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExportOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [exportOpen, setExportOpen])

  if (!exportOpen) return null

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadProjectBackup = () => {
    downloadBlob(
      new Blob([serializeDocument(documentValue)], { type: 'application/json;charset=utf-8' }),
      `${project.name.replaceAll(/\s+/g, '-').toLowerCase()}.gsw`,
    )
  }

  const downloadExcel = async () => {
    setStatus('working')
    setMessage('구조도와 테이블 시트를 생성하고 있습니다.')
    try {
      const manifest = await exportIntegratedWorkbook(documentValue)
      setStatus('done')
      setMessage(`${manifest.sheetNames.length}개 시트 · revision ${manifest.revision}`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '통합 Excel을 만들지 못했습니다.')
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={() => setExportOpen(false)}>
      <section className="export-drawer export-drawer--integrated" role="dialog" aria-modal="true" aria-label="내보내기" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading">
          <div><strong>내보내기</strong><span>검증된 프로젝트를 전달 가능한 형식으로 만듭니다.</span></div>
          <button className="icon-button" type="button" title="내보내기 닫기" onClick={() => setExportOpen(false)}><X aria-hidden="true" size={17} /></button>
        </div>

        <div className="export-drawer-body">
          <section className="integrated-export-panel">
            <div className="export-format-summary">
              <FileSpreadsheet size={28} aria-hidden="true" />
              <div><h2>통합 Excel</h2><p>테이블 설명과 칼럼 규격, 결정적 구조도, 고정 형식의 데이터 시트를 한 문서로 만듭니다.</p></div>
            </div>
            <ol className="workbook-sheet-plan">
              <li><strong>1. 테이블 설명 및 규격</strong><span>테이블 설명과 테이블명·칼럼명·자료형·설명</span></li>
              <li><strong>2. 테이블 구조도</strong><span>현재 화면 위치와 무관한 고정 자동 배치 이미지</span></li>
              <li><strong>테이블별 시트 {project.tables.length}개</strong><span>1행 칼럼명, 2행 자료형, 3행부터 원본 데이터</span></li>
            </ol>
            <div className={blockingIssues.length > 0 ? 'export-validation error' : 'export-validation ready'}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <div><strong>{blockingIssues.length > 0 ? `오류 ${blockingIssues.length}개가 있습니다.` : '내보내기 준비가 끝났습니다.'}</strong><span>{project.tables.length}개 테이블 · {project.relations.length}개 관계 · {Object.values(documentValue.rowsByTable).reduce((sum, rows) => sum + rows.length, 0)}행</span></div>
            </div>
            {message && <p className={`export-operation-message ${status}`}>{message}</p>}
            <button className="primary-action export-primary-action" type="button" disabled={status === 'working' || blockingIssues.length > 0} onClick={() => void downloadExcel()}>
              {status === 'working' ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
              통합 Excel 내보내기
            </button>
          </section>

          <section className="integrated-export-panel">
            <div className="export-format-summary"><FileJson2 size={28} /><div><h2>프로젝트 백업</h2><p>스키마, 행, 보기 상태와 revision을 다시 열 수 있는 .gsw 파일입니다.</p></div></div>
            <button className="primary-action export-primary-action" type="button" onClick={downloadProjectBackup}><Download size={16} />프로젝트 백업(.gsw)</button>
          </section>
        </div>
      </section>
    </div>
  )
}
