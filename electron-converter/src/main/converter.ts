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

  try {
    const { stdout } = await execFileAsync('soffice', ['--version'], { timeout: 5000 });
    const version = stdout.trim().replace('LibreOffice ', '');
    return { found: true, version, path: 'soffice' };
  } catch {
    return { found: false };
  }
}

/**
 * Convert PPTX to self-contained FHD HTML using LibreOffice
 */
export async function convertPptxLibreOffice(
  pptxPath: string,
  outputDir: string,
  sofficePath: string,
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
  }
}

/**
 * Inline all external resources and inject FHD viewport scaling.
 */
async function inlineResources(
  htmlPath: string,
  baseDir: string,
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
      const cssPath = path.resolve(baseDir, href);
      if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf-8');
        $(el).replaceWith(`<style>${css}</style>`);
      }
    }
  });

  // Inline <img> tags as base64
  $('img').each((_i, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('//')) {
      const imgPath = path.resolve(baseDir, src);
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          png: 'image/png', gif: 'image/gif',
          svg: 'image/svg+xml', webp: 'image/webp',
        };
        const mime = mimeMap[ext] || 'image/png';
        const data = fs.readFileSync(imgPath).toString('base64');
        $(el).attr('src', `data:${mime};base64,${data}`);
      }
    }
  });

  // Inline background-image url() in style attributes
  $('[style]').each((_i, el) => {
    const style = $(el).attr('style') || '';
    const updated = style.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_match, url: string) => {
      if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('//')) return _match;
      const imgPath = path.resolve(baseDir, url);
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).toLowerCase().replace('.', '');
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const data = fs.readFileSync(imgPath).toString('base64');
        return `url('data:${mime};base64,${data}')`;
      }
      return _match;
    });
    $(el).attr('style', updated);
  });

  onProgress(90, 100, 'Writing standalone file…');

  // Inject FHD scaling script just before </body>
  $('body').append(FHD_SCRIPT);

  const outputPath = htmlPath.replace('.html', '_fhd_standalone.html');
  fs.writeFileSync(outputPath, $.html(), 'utf-8');

  return outputPath;
}

/**
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
 */
export async function convertPptxFallback(
  pptxPath: string,
  outputDir: string,
  onProgress: (page: number, total: number, message: string) => void,
): Promise<ConvertResult> {
  try {
    onProgress(10, 100, 'Using fallback mode (LibreOffice not found)…');
    fs.mkdirSync(outputDir, { recursive: true });

    const baseName = path.basename(pptxPath, '.pptx');
    const stats = fs.statSync(pptxPath);
    const sizeKB = Math.round(stats.size / 1024);

    onProgress(50, 100, 'Generating placeholder HTML…');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, initial-scale=1.0">
<title>${baseName}</title>
${FHD_STYLE}
<style>
  body {
    background: #0f0f1a;
    color: #fff;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 24px;
  }
  .card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 48px;
    text-align: center;
    max-width: 640px;
  }
  .icon { font-size: 64px; margin-bottom: 24px; }
  h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
  p { color: rgba(255,255,255,0.6); font-size: 18px; }
  .meta {
    display: flex; gap: 16px; justify-content: center; margin-top: 24px;
    font-size: 14px; color: rgba(255,255,255,0.4);
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
  }
}
