import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';

const execFileAsync = promisify(execFile);

export interface ConvertResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  slideCount?: number;
}

export interface LibreOfficeInfo {
  found: boolean;
  version?: string;
  path?: string;
}

<<<<<<< HEAD
// CSS + JS injected into every output HTML to scale content to FHD in fullscreen.
const FHD_STYLE = `
<style id="__fhd_scale_style">
html{width:100vw!important;height:100vh!important;overflow:hidden!important;background:#000!important;margin:0!important;padding:0!important;}
body{width:1920px!important;height:1080px!important;overflow:hidden!important;margin:0!important;padding:0!important;transform-origin:top left!important;}
</style>`;

const FHD_SCRIPT = `
<script id="__fhd_scale_script">
(function(){
  function applyScale(){
    var sx=window.innerWidth/1920,sy=window.innerHeight/1080,s=Math.min(sx,sy);
    var ml=Math.max(0,(window.innerWidth-1920*s)/2);
    var mt=Math.max(0,(window.innerHeight-1080*s)/2);
    document.body.style.transform='scale('+s+')';
    document.body.style.marginLeft=ml+'px';
    document.body.style.marginTop=mt+'px';
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyScale);}else{applyScale();}
  window.addEventListener('resize',applyScale);
})();
</script>`;

/**
 * Detect LibreOffice installation on Windows and Linux
 */
export async function detectLibreOffice(): Promise<LibreOfficeInfo> {
  const isLinux = process.platform === 'linux';
  const isWin = process.platform === 'win32';

  const candidates = [
    ...(isWin ? [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ] : []),
    ...(isLinux ? [
      '/usr/bin/soffice',
      '/usr/lib/libreoffice/program/soffice',
      '/opt/libreoffice/program/soffice',
    ] : []),
=======
/**
 * Detect LibreOffice installation on Windows
 */
export async function detectLibreOffice(): Promise<LibreOfficeInfo> {
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
    process.env['LIBREOFFICE_PATH'] || '',
  ].filter(Boolean);

  for (const candidatePath of candidates) {
    if (fs.existsSync(candidatePath)) {
      try {
        const { stdout } = await execFileAsync(candidatePath, ['--version'], { timeout: 5000 });
        const version = stdout.trim().replace('LibreOffice ', '');
        return { found: true, version, path: candidatePath };
      } catch {
        return { found: true, path: candidatePath };
      }
    }
  }

<<<<<<< HEAD
=======
  // Try PATH
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  try {
    const { stdout } = await execFileAsync('soffice', ['--version'], { timeout: 5000 });
    const version = stdout.trim().replace('LibreOffice ', '');
    return { found: true, version, path: 'soffice' };
  } catch {
    return { found: false };
  }
}

/**
<<<<<<< HEAD
 * Convert PPTX to self-contained FHD HTML using LibreOffice
=======
 * Convert PPTX to self-contained HTML using LibreOffice
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
 */
export async function convertPptxLibreOffice(
  pptxPath: string,
  outputDir: string,
  sofficePath: string,
<<<<<<< HEAD
  onProgress: (page: number, total: number, message: string) => void,
): Promise<ConvertResult> {
  try {
    onProgress(0, 100, 'Starting LibreOffice…');

    fs.mkdirSync(outputDir, { recursive: true });

    onProgress(10, 100, 'Converting PPTX → HTML…');
    await execFileAsync(
      sofficePath,
      ['--headless', '--convert-to', 'html', '--outdir', outputDir, pptxPath],
      { timeout: 120000 },
    );

    const baseName = path.basename(pptxPath, path.extname(pptxPath));
    let htmlPath = path.join(outputDir, `${baseName}.html`);

    if (!fs.existsSync(htmlPath)) {
      const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.html'));
      if (files.length === 0) {
        return { success: false, error: 'LibreOffice finished but no HTML output was found.' };
      }
      htmlPath = path.join(outputDir, files[0]);
    }

    onProgress(60, 100, 'Inlining resources (images, styles)…');
    const finalHtmlPath = await inlineResources(htmlPath, outputDir, onProgress);

    onProgress(100, 100, 'Done!');
    return { success: true, outputPath: finalHtmlPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
=======
  onProgress: (page: number, total: number, message: string) => void
): Promise<ConvertResult> {
  try {
    onProgress(0, 100, '正在啟動 LibreOffice...');

    // Ensure output dir exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Run LibreOffice headless conversion
    onProgress(10, 100, '正在轉換 PPTX → HTML...');
    await execFileAsync(
      sofficePath,
      ['--headless', '--convert-to', 'html', '--outdir', outputDir, pptxPath],
      { timeout: 120000 }
    );

    // Find the generated HTML file
    const baseName = path.basename(pptxPath, path.extname(pptxPath));
    const htmlPath = path.join(outputDir, `${baseName}.html`);

    if (!fs.existsSync(htmlPath)) {
      // Try finding any HTML file
      const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.html'));
      if (files.length === 0) {
        return { success: false, error: 'LibreOffice 轉換完成但找不到輸出 HTML 檔案' };
      }
    }

    onProgress(60, 100, '正在內嵌資源（圖片、樣式）...');

    // Inline all resources to make self-contained HTML
    const finalHtmlPath = await inlineResources(htmlPath, outputDir, onProgress);

    onProgress(100, 100, '轉換完成！');

    return {
      success: true,
      outputPath: finalHtmlPath,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || '未知錯誤',
    };
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  }
}

/**
<<<<<<< HEAD
 * Inline all external resources and inject FHD viewport scaling.
=======
 * Inline all external resources into a single self-contained HTML file
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
 */
async function inlineResources(
  htmlPath: string,
  baseDir: string,
<<<<<<< HEAD
  onProgress: (page: number, total: number, message: string) => void,
): Promise<string> {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  // Add FHD viewport meta
  if (!$('meta[name="viewport"]').length) {
    $('head').prepend('<meta name="viewport" content="width=1920, initial-scale=1.0">');
  } else {
    $('meta[name="viewport"]').attr('content', 'width=1920, initial-scale=1.0');
  }

  // Inject FHD scaling style (before other styles so it can be overridden selectively)
  $('head').append(FHD_STYLE);

  // Inline CSS <link> tags
  $('link[rel="stylesheet"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('//')) {
=======
  onProgress: (page: number, total: number, message: string) => void
): Promise<string> {
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  // Inline CSS <link> tags
  $('link[rel="stylesheet"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('http')) {
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      const cssPath = path.resolve(baseDir, href);
      if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf-8');
        $(el).replaceWith(`<style>${css}</style>`);
      }
    }
  });

<<<<<<< HEAD
  // Inline <img> tags as base64
  $('img').each((_i, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('//')) {
=======
  // Inline images as base64
  $('img').each((_i, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:') && !src.startsWith('http')) {
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      const imgPath = path.resolve(baseDir, src);
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
<<<<<<< HEAD
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          png: 'image/png', gif: 'image/gif',
          svg: 'image/svg+xml', webp: 'image/webp',
=======
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          svg: 'image/svg+xml',
          webp: 'image/webp',
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
        };
        const mime = mimeMap[ext] || 'image/png';
        const data = fs.readFileSync(imgPath).toString('base64');
        $(el).attr('src', `data:${mime};base64,${data}`);
      }
    }
  });

<<<<<<< HEAD
  // Inline background-image url() in style attributes
  $('[style]').each((_i, el) => {
    const style = $(el).attr('style') || '';
    const updated = style.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_match, url: string) => {
      if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('//')) return _match;
=======
  // Inline background images in style attributes
  $('[style]').each((_i, el) => {
    const style = $(el).attr('style') || '';
    const updatedStyle = style.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_match, url) => {
      if (url.startsWith('data:') || url.startsWith('http')) return _match;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      const imgPath = path.resolve(baseDir, url);
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).toLowerCase().replace('.', '');
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const data = fs.readFileSync(imgPath).toString('base64');
        return `url('data:${mime};base64,${data}')`;
      }
      return _match;
    });
<<<<<<< HEAD
    $(el).attr('style', updated);
  });

  onProgress(90, 100, 'Writing standalone file…');

  // Inject FHD scaling script just before </body>
  $('body').append(FHD_SCRIPT);

  const outputPath = htmlPath.replace('.html', '_fhd_standalone.html');
=======
    $(el).attr('style', updatedStyle);
  });

  onProgress(90, 100, '正在寫入輸出檔案...');

  // Write self-contained HTML
  const outputPath = htmlPath.replace('.html', '_standalone.html');
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  fs.writeFileSync(outputPath, $.html(), 'utf-8');

  return outputPath;
}

/**
<<<<<<< HEAD
 * Process an existing HTML file into a self-contained FHD HTML5 file.
 * Inlines all local CSS and images, then injects FHD viewport scaling.
 */
export async function convertHtmlToHtml5(
  htmlPath: string,
  outputDir: string,
  onProgress: (page: number, total: number, message: string) => void,
): Promise<ConvertResult> {
  try {
    onProgress(10, 100, 'Reading HTML file…');
    fs.mkdirSync(outputDir, { recursive: true });

    const sourceDir = path.dirname(htmlPath);
    const baseName = path.basename(htmlPath);
    const destPath = path.join(outputDir, baseName);

    if (path.resolve(htmlPath) !== path.resolve(destPath)) {
      fs.copyFileSync(htmlPath, destPath);
    }

    onProgress(40, 100, 'Inlining resources (images, styles)…');
    const finalHtmlPath = await inlineResources(destPath, sourceDir, onProgress);

    onProgress(100, 100, 'Done!');
    return { success: true, outputPath: finalHtmlPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Fallback when LibreOffice is not available — generates a placeholder HTML at FHD.
=======
 * Fallback: Simple PPTX info extraction without LibreOffice
 * Creates a placeholder HTML with metadata
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
 */
export async function convertPptxFallback(
  pptxPath: string,
  outputDir: string,
<<<<<<< HEAD
  onProgress: (page: number, total: number, message: string) => void,
): Promise<ConvertResult> {
  try {
    onProgress(10, 100, 'Using fallback mode (LibreOffice not found)…');
=======
  onProgress: (page: number, total: number, message: string) => void
): Promise<ConvertResult> {
  try {
    onProgress(10, 100, '使用備用方案（無 LibreOffice）...');
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
    fs.mkdirSync(outputDir, { recursive: true });

    const baseName = path.basename(pptxPath, '.pptx');
    const stats = fs.statSync(pptxPath);
    const sizeKB = Math.round(stats.size / 1024);

<<<<<<< HEAD
    onProgress(50, 100, 'Generating placeholder HTML…');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, initial-scale=1.0">
<title>${baseName}</title>
${FHD_STYLE}
<style>
=======
    onProgress(50, 100, '生成預覽 HTML...');

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${baseName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  body {
    background: #0f0f1a;
    color: #fff;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
<<<<<<< HEAD
=======
    min-height: 100vh;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
    flex-direction: column;
    gap: 24px;
  }
  .card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 48px;
    text-align: center;
<<<<<<< HEAD
    max-width: 640px;
  }
  .icon { font-size: 64px; margin-bottom: 24px; }
  h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
  p { color: rgba(255,255,255,0.6); font-size: 18px; }
  .meta {
    display: flex; gap: 16px; justify-content: center; margin-top: 24px;
    font-size: 14px; color: rgba(255,255,255,0.4);
=======
    max-width: 480px;
  }
  .icon { font-size: 64px; margin-bottom: 24px; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  p { color: rgba(255,255,255,0.6); font-size: 14px; }
  .meta { 
    display: flex; gap: 16px; justify-content: center; margin-top: 24px;
    font-size: 12px; color: rgba(255,255,255,0.4);
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  }
  .tag {
    background: rgba(99,102,241,0.2);
    border: 1px solid rgba(99,102,241,0.4);
    border-radius: 6px;
    padding: 4px 12px;
    color: #a5b4fc;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">📊</div>
    <h1>${baseName}</h1>
<<<<<<< HEAD
    <p>Fallback mode — install LibreOffice for full PPTX conversion.</p>
    <div class="meta">
      <span class="tag">Fallback</span>
      <span>${sizeKB} KB</span>
      <span>${new Date().toLocaleDateString('en-US')}</span>
    </div>
  </div>
${FHD_SCRIPT}
</body>
</html>`;

    const outputPath = path.join(outputDir, `${baseName}_fhd_preview.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');

    onProgress(100, 100, 'Done (fallback mode)');
    return { success: true, outputPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
=======
    <p>此 HTML 由 PPTX 轉換工具生成（備用模式）<br>建議安裝 LibreOffice 以獲得最佳轉換品質</p>
    <div class="meta">
      <span class="tag">PPTX 備用轉換</span>
      <span>${sizeKB} KB</span>
      <span>${new Date().toLocaleDateString('zh-TW')}</span>
    </div>
  </div>
</body>
</html>`;

    const outputPath = path.join(outputDir, `${baseName}_preview.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');

    onProgress(100, 100, '轉換完成（備用模式）');
    return { success: true, outputPath };
  } catch (err: any) {
    return { success: false, error: err.message };
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  }
}
