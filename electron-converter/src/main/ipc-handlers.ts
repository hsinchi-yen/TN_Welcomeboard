import { BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import {
  detectLibreOffice,
  convertPptxLibreOffice,
  convertPptxFallback,
  convertHtmlToHtml5,
} from './converter';

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // ─── Dialog: Open PPTX ───────────────────────────────────────────────────────
  ipcMain.handle('dialog:openPptx', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇 PPTX 檔案',
      filters: [{ name: 'PowerPoint', extensions: ['pptx', 'ppt'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ─── Dialog: Open HTML ───────────────────────────────────────────────────────
  ipcMain.handle('dialog:openHtml', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇 HTML 檔案',
      filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ─── Dialog: Open Output Directory ──────────────────────────────────────────
  ipcMain.handle('dialog:openOutputDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇輸出目錄',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ─── Detect LibreOffice ──────────────────────────────────────────────────────
  ipcMain.handle('libreoffice:detect', async () => {
    return await detectLibreOffice();
  });

  // ─── Convert PPTX ───────────────────────────────────────────────────────────
  ipcMain.handle('convert:pptx', async (_event, pptxPath: string, outputDir: string) => {
    const sendProgress = (page: number, total: number, message: string) => {
      mainWindow.webContents.send('convert:progress', { page, total, message });
    };

    const loInfo = await detectLibreOffice();

    if (loInfo.found && loInfo.path) {
      return await convertPptxLibreOffice(pptxPath, outputDir, loInfo.path, sendProgress);
    } else {
      return await convertPptxFallback(pptxPath, outputDir, sendProgress);
    }
  });

  // ─── Convert HTML → HTML5 ────────────────────────────────────────────────────
  ipcMain.handle('convert:html', async (_event, htmlPath: string, outputDir: string) => {
    const sendProgress = (page: number, total: number, message: string) => {
      mainWindow.webContents.send('convert:progress', { page, total, message });
    };
    return await convertHtmlToHtml5(htmlPath, outputDir, sendProgress);
  });

  // ─── Shell: Open in Browser ──────────────────────────────────────────────────
  ipcMain.handle('shell:openBrowser', async (_event, filePath: string) => {
    await shell.openExternal(`file://${filePath}`);
  });

  // ─── Shell: Open Folder ──────────────────────────────────────────────────────
  ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
    await shell.openPath(folderPath);
  });

  // ─── Upload to Server (native http/https, no axios) ─────────────────────────
  ipcMain.handle('upload:toServer', async (_event, filePath: string, serverUrl: string) => {
    return await uploadFile(filePath, serverUrl);
  });
}

/**
 * Upload a file using native Node.js http/https (no axios/undici)
 */
function uploadFile(filePath: string, serverUrl: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    try {
      const boundary = `---------------------------${Date.now()}`;
      const fileName = path.basename(filePath);
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = getMimeType(fileName);

      const cleanUrl = serverUrl.replace(/\/$/, '');
      const uploadUrl = new URL(`${cleanUrl}/api/v1/upload`);

      const head = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      );
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([head, fileBuffer, tail]);

      const options: http.RequestOptions = {
        hostname: uploadUrl.hostname,
        port: uploadUrl.port || (uploadUrl.protocol === 'https:' ? 443 : 80),
        path: uploadUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 60000,
      };

      const transport = uploadUrl.protocol === 'https:' ? https : http;
      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode < 300) {
              resolve({ success: true, data: parsed });
            } else {
              resolve({ success: false, error: parsed.error || `HTTP ${res.statusCode}` });
            }
          } catch {
            resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: '上傳逾時（60s）' });
      });

      req.write(body);
      req.end();
    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
}

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}
