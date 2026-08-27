import { app } from 'electron'
import log from 'electron-log/main.js'
import { cpSync, copyFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  LEGACY_DATABASE_FILE,
  LEGACY_DATA_DIRECTORY,
  PRODUCT_DATA_DIRECTORY,
  PRODUCT_DATABASE_FILE,
  PRODUCT_NAME
} from '@shared/product'

const LEGACY_USER_DIRECTORIES = ['templates', join('styles', 'user')]

const copyIfMissing = (sourcePath: string, targetPath: string): boolean => {
  if (!existsSync(sourcePath) || existsSync(targetPath)) return false
  mkdirSync(join(targetPath, '..'), { recursive: true })
  cpSync(sourcePath, targetPath, { recursive: true, errorOnExist: false })
  return true
}

/**
 * Separates this product from the upstream Electron profile while preserving the user's existing
 * database and personal assets once. Chromium caches and upstream update state are intentionally
 * not migrated.
 */
export function configureProductRuntime(): void {
  app.setName(PRODUCT_NAME)

  const appDataPath = app.getPath('appData')
  const userDataPath = join(appDataPath, PRODUCT_DATA_DIRECTORY)
  const legacyUserDataPath = join(appDataPath, LEGACY_DATA_DIRECTORY)
  mkdirSync(userDataPath, { recursive: true })
  app.setPath('userData', userDataPath)

  if (!existsSync(legacyUserDataPath)) return

  const migrated: string[] = []
  const legacyDatabasePath = join(legacyUserDataPath, LEGACY_DATABASE_FILE)
  const databasePath = join(userDataPath, PRODUCT_DATABASE_FILE)
  if (existsSync(legacyDatabasePath) && !existsSync(databasePath)) {
    copyFileSync(legacyDatabasePath, databasePath)
    migrated.push(PRODUCT_DATABASE_FILE)
  }

  for (const relativePath of LEGACY_USER_DIRECTORIES) {
    if (copyIfMissing(join(legacyUserDataPath, relativePath), join(userDataPath, relativePath))) {
      migrated.push(relativePath)
    }
  }

  if (migrated.length > 0) {
    log.info('[product] migrated legacy user data', { migrated, userDataPath })
  }
}
