import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),

  // File dialogs
  openPptxDialog: () => ipcRenderer.invoke('dialog:openPptx'),
  openHtmlDialog: () => ipcRenderer.invoke('dialog:openHtml'),
  openOutputDirDialog: () => ipcRenderer.invoke('dialog:openOutputDir'),

  // Converter
  detectLibreOffice: () => ipcRenderer.invoke('libreoffice:detect'),
  convertPptx: (pptxPath: string, outputDir: string) =>
    ipcRenderer.invoke('convert:pptx', pptxPath, outputDir),
  convertHtml: (htmlPath: string, outputDir: string) =>
    ipcRenderer.invoke('convert:html', htmlPath, outputDir),

  // Shell
  openInBrowser: (filePath: string) => ipcRenderer.invoke('shell:openBrowser', filePath),
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:openFolder', folderPath),

  // Upload
  uploadToServer: (filePath: string, serverUrl: string) =>
    ipcRenderer.invoke('upload:toServer', filePath, serverUrl),

  // Progress events
  onConvertProgress: (callback: (data: { page: number; total: number; message: string }) => void) => {
    ipcRenderer.on('convert:progress', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('convert:progress');
  },
});
