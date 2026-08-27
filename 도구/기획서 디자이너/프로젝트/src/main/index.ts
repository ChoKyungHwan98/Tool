import { app } from 'electron'
import { MainApplication } from './app/application'
import { configureProductRuntime } from './app/product-runtime'

configureProductRuntime()
const mainApplication = new MainApplication()
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => mainApplication.focusMainWindow())
  app.whenReady().then(() => mainApplication.start())
}

app.on('window-all-closed', () => mainApplication.handleWindowAllClosed())
app.on('before-quit', () => mainApplication.handleBeforeQuit())
