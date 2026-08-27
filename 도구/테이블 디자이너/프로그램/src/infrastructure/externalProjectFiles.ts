import { invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { LinkedProjectFile } from '../application/projectRepository'

export interface ExternalProjectFileContents {
  readonly serializedDocument: string
  readonly linkedFile: LinkedProjectFile
}

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function chooseAndReadExternalProjectFile(): Promise<ExternalProjectFileContents | null> {
  if (!isDesktopRuntime()) return null
  const defaultPath = await invoke<string>('project_files_directory')
  const selected = await open({ defaultPath, multiple: false, directory: false, filters: [{ name: 'Game Schema Workbench', extensions: ['gsw', 'json'] }] })
  if (!selected || Array.isArray(selected)) return null
  return invoke('read_external_project_file', { path: selected })
}

export function readExternalProjectFile(path: string): Promise<ExternalProjectFileContents> {
  return invoke('read_external_project_file', { path })
}

export async function chooseAndWriteExternalProjectFile(
  defaultName: string,
  serializedDocument: string,
  expectedChecksum?: string,
): Promise<LinkedProjectFile | null> {
  if (!isDesktopRuntime()) return null
  const projectDirectory = await invoke<string>('project_files_directory')
  const selected = await save({ defaultPath: await join(projectDirectory, defaultName), filters: [{ name: 'Game Schema Workbench', extensions: ['gsw'] }] })
  if (!selected) return null
  return invoke('write_external_project_file', { path: selected, serializedDocument, expectedChecksum })
}
