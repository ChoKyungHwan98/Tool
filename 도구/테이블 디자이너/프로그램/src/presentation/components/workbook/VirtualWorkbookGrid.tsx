import { useRef, type ClipboardEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'

interface VirtualWorkbookGridProps {
  readonly viewportRef: RefObject<HTMLDivElement | null>
  readonly keyboardCaptureRef: RefObject<HTMLTextAreaElement | null>
  readonly label: string
  readonly rowCount: number
  readonly columnCount: number
  readonly children: ReactNode
  readonly onCopy: (event: ClipboardEvent<HTMLDivElement>) => void
  readonly onCut: (event: ClipboardEvent<HTMLDivElement>) => void
  readonly onPaste: (event: ClipboardEvent<HTMLDivElement>) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  readonly onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => void
  readonly onTextInput: (value: string) => void
}

export function VirtualWorkbookGrid({
  viewportRef,
  keyboardCaptureRef,
  label,
  rowCount,
  columnCount,
  children,
  onCopy,
  onCut,
  onPaste,
  onKeyDown,
  onPointerDownCapture,
  onTextInput,
}: VirtualWorkbookGridProps) {
  const composing = useRef(false)

  return (
    <div
      ref={viewportRef}
      className="spreadsheet-viewport"
      role="grid"
      aria-label={label}
      aria-rowcount={rowCount}
      aria-colcount={columnCount}
      tabIndex={0}
      onCopy={onCopy}
      onCut={onCut}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
      onPointerDownCapture={onPointerDownCapture}
    >
      <textarea
        ref={keyboardCaptureRef}
        className="spreadsheet-keyboard-capture"
        aria-label="그리드 키보드 입력"
        tabIndex={-1}
        onChange={(event) => {
          if (composing.current) return
          const text = event.currentTarget.value
          event.currentTarget.value = ''
          if (text) onTextInput(text)
        }}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={(event) => {
          composing.current = false
          const text = event.currentTarget.value || event.data
          event.currentTarget.value = ''
          if (text) onTextInput(text)
        }}
      />
      {children}
    </div>
  )
}
