import './style.css';

// ─── Type declarations for Electron API ────────────────────────────────────
declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      close: () => void;
      openPptxDialog: () => Promise<string | null>;
<<<<<<< HEAD
      openHtmlDialog: () => Promise<string | null>;
=======
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      openOutputDirDialog: () => Promise<string | null>;
      detectLibreOffice: () => Promise<{ found: boolean; version?: string; path?: string }>;
      convertPptx: (pptxPath: string, outputDir: string) => Promise<{
        success: boolean;
        outputPath?: string;
        error?: string;
      }>;
<<<<<<< HEAD
      convertHtml: (htmlPath: string, outputDir: string) => Promise<{
        success: boolean;
        outputPath?: string;
        error?: string;
      }>;
=======
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      openInBrowser: (filePath: string) => Promise<void>;
      openFolder: (folderPath: string) => Promise<void>;
      uploadToServer: (filePath: string, serverUrl: string) => Promise<{
        success: boolean;
        data?: any;
        error?: string;
      }>;
      onConvertProgress: (
        callback: (data: { page: number; total: number; message: string }) => void
      ) => () => void;
    };
  }
}

// ─── App State ─────────────────────────────────────────────────────────────
const state = {
<<<<<<< HEAD
  mode: 'pptx' as 'pptx' | 'html',
  inputPath: null as string | null,
=======
  pptxPath: null as string | null,
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  outputDir: null as string | null,
  outputFile: null as string | null,
  isConverting: false,
};

// ─── DOM References ────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id)!;

// ─── Render App ───────────────────────────────────────────────────────────
document.getElementById('app')!.innerHTML = `
<div class="glow-orb"></div>

<!-- Titlebar -->
<div id="titlebar">
  <div class="titlebar-left">
    <div class="titlebar-icon">📊</div>
    <span class="titlebar-title">Signage PPTX Converter &nbsp;·&nbsp; Welcome Board</span>
  </div>
  <div class="titlebar-controls">
    <button class="titlebar-btn" id="btn-minimize" title="最小化">─</button>
    <button class="titlebar-btn close" id="btn-close" title="關閉">✕</button>
  </div>
</div>

<div id="app-root">
  <!-- Hero -->
  <div id="hero">
<<<<<<< HEAD
    <div class="hero-label">Windows / Linux 桌面轉換工具</div>
    <h1 class="hero-title" id="hero-title">PPTX → HTML5 Slides</h1>
    <p class="hero-subtitle" id="hero-subtitle">將 PowerPoint 轉換為自包含 HTML5，可直接投放至看板系統</p>
    <!-- Mode toggle -->
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
      <button id="mode-pptx" class="btn btn-primary btn-sm" style="min-width:120px">📊 PPTX → HTML5</button>
      <button id="mode-html" class="btn btn-outline btn-sm" style="min-width:120px">🌐 HTML → HTML5</button>
    </div>
    <div id="lo-badge" class="checking" style="margin-top:12px">
=======
    <div class="hero-label">Windows 桌面轉換工具</div>
    <h1 class="hero-title">PPTX → HTML5 Slides</h1>
    <p class="hero-subtitle">將 PowerPoint 轉換為自包含 HTML5，可直接投放至看板系統</p>
    <div id="lo-badge" class="checking">
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      <span class="lo-dot"></span>
      <span id="lo-text">偵測 LibreOffice 中...</span>
    </div>
  </div>

  <!-- Main Content -->
  <div id="main-content">

    <!-- 1. Drop Zone -->
    <div>
<<<<<<< HEAD
      <div class="section-title" id="step1-title">① 選擇 PPTX 檔案</div>
      <div id="drop-zone">
        <span class="drop-icon">📁</span>
        <div class="drop-title" id="drop-title">拖放 PPTX 到此處</div>
=======
      <div class="section-title">① 選擇 PPTX 檔案</div>
      <div id="drop-zone">
        <span class="drop-icon">📁</span>
        <div class="drop-title">拖放 PPTX 到此處</div>
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
        <div class="drop-hint">或 <span id="browse-link">點選開啟</span>檔案總管</div>
        <input type="file" id="file-input" accept=".pptx,.ppt" />
      </div>
      <div id="file-info-row" class="file-info-row" style="display:none; margin-top: 8px;">
        <div class="file-icon">📊</div>
        <div class="file-info-text">
          <div class="file-name" id="file-name-text">—</div>
          <div class="file-meta" id="file-meta-text">—</div>
        </div>
        <button class="file-clear-btn" id="btn-clear-file" title="移除">✕</button>
      </div>
    </div>

    <hr class="sep" />

    <!-- 2. Output Directory -->
    <div>
      <div class="section-title">② 選擇輸出目錄</div>
      <div class="dir-row">
        <input type="text" id="output-dir-input" class="dir-input" placeholder="點選右側按鈕選擇目錄..." readonly />
        <button class="btn btn-outline btn-sm" id="btn-select-dir">📂 瀏覽</button>
      </div>
    </div>

    <hr class="sep" />

    <!-- 3. Convert -->
    <div id="convert-section">
      <button class="btn btn-primary btn-lg" id="btn-convert">
        <span id="btn-convert-icon">⚡</span>
        <span id="btn-convert-text">開始轉換</span>
      </button>
    </div>

    <!-- Progress -->
    <div id="progress-section">
      <div class="progress-header">
        <span class="progress-label" id="progress-label">正在準備...</span>
        <span class="progress-pct" id="progress-pct">0%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" id="progress-fill" style="width:0%"></div>
      </div>
      <div class="progress-msg" id="progress-msg"></div>
    </div>

    <!-- Result -->
    <div id="result-section">
      <div id="result-card" class="result-card">
        <div class="result-icon" id="result-icon">✅</div>
        <div class="result-body">
          <div class="result-title" id="result-title">轉換成功！</div>
          <div class="result-path" id="result-path">—</div>
          <div class="result-actions">
            <button class="btn btn-outline btn-sm" id="btn-open-browser">🌐 在瀏覽器預覽</button>
            <button class="btn btn-outline btn-sm" id="btn-open-folder">📂 開啟輸出資料夾</button>
            <button class="btn btn-outline btn-sm" id="btn-show-upload">☁ 上傳到看板系統</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload -->
    <div id="upload-section">
      <div class="section-title" style="margin-bottom:10px">④ 上傳到看板系統</div>
      <div class="upload-row">
        <input
          type="text"
          id="server-url-input"
          class="upload-input"
          placeholder="http://192.168.1.100:8080"
          value="http://localhost:8080"
        />
        <button class="btn btn-success btn-sm" id="btn-upload">上傳</button>
      </div>
      <div id="upload-status" class="upload-status"></div>
    </div>

  </div>
</div>
`;

// ─── Init ──────────────────────────────────────────────────────────────────
async function init() {
  setupWindowControls();
<<<<<<< HEAD
  setupModeToggle();
=======
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  setupDropZone();
  setupOutputDir();
  setupConvertButton();
  setupResultActions();
  setupUploadSection();
  await checkLibreOffice();
}

// ─── Window Controls ───────────────────────────────────────────────────────
function setupWindowControls() {
  $('btn-minimize').addEventListener('click', () => window.electronAPI?.minimize());
  $('btn-close').addEventListener('click', () => window.electronAPI?.close());
}

<<<<<<< HEAD
// ─── Mode Toggle (PPTX ↔ HTML) ────────────────────────────────────────────
function setupModeToggle() {
  $('mode-pptx').addEventListener('click', () => setMode('pptx'));
  $('mode-html').addEventListener('click', () => setMode('html'));
}

function setMode(mode: 'pptx' | 'html') {
  state.mode = mode;
  state.inputPath = null;

  const isPptx = mode === 'pptx';

  // Update button styles
  ($('mode-pptx') as HTMLButtonElement).className = `btn btn-sm ${isPptx ? 'btn-primary' : 'btn-outline'}`;
  ($('mode-html') as HTMLButtonElement).className = `btn btn-sm ${isPptx ? 'btn-outline' : 'btn-primary'}`;

  // Update hero text
  $('hero-title').textContent = isPptx ? 'PPTX → HTML5 Slides' : 'HTML → HTML5 Standalone';
  $('hero-subtitle').textContent = isPptx
    ? '將 PowerPoint 轉換為自包含 HTML5，可直接投放至看板系統'
    : '將 HTML 頁面內嵌所有資源並套用 FHD 縮放，輸出為自包含 HTML5';

  // LibreOffice badge: only relevant for PPTX
  $('lo-badge').style.display = isPptx ? '' : 'none';

  // Update step 1 wording
  $('step1-title').textContent = isPptx ? '① 選擇 PPTX 檔案' : '① 選擇 HTML 檔案';
  $('drop-title').textContent = isPptx ? '拖放 PPTX 到此處' : '拖放 HTML 到此處';

  // Update file input accept
  ($('file-input') as HTMLInputElement).accept = isPptx ? '.pptx,.ppt' : '.html,.htm';

  // Reset file selection UI
  $('file-info-row').style.display = 'none';
  $('drop-zone').style.display = 'block';
  ($('btn-convert') as HTMLButtonElement).disabled = true;
  hideResult();
  hideProgress();
}

=======
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
// ─── LibreOffice Detection ─────────────────────────────────────────────────
async function checkLibreOffice() {
  if (!window.electronAPI) return;

  const badge = $('lo-badge');
  const text = $('lo-text');

  try {
    const info = await window.electronAPI.detectLibreOffice();
    if (info.found) {
      badge.className = 'found';
      text.textContent = `✓ LibreOffice 已偵測${info.version ? ` (${info.version})` : ''}`;
    } else {
      badge.className = 'not-found';
      text.textContent = '⚠ LibreOffice 未安裝（將使用備用模式）';
    }
  } catch {
    badge.className = 'not-found';
    text.textContent = '⚠ 無法偵測 LibreOffice';
  }
}

// ─── Drop Zone & File Selection ───────────────────────────────────────────
function setupDropZone() {
  const dropZone = $('drop-zone');
  const fileInput = $('file-input') as HTMLInputElement;

<<<<<<< HEAD
  const openDialog = () => {
    if (window.electronAPI) {
      const fn = state.mode === 'pptx'
        ? window.electronAPI.openPptxDialog
        : window.electronAPI.openHtmlDialog;
      fn().then(setSelectedFile);
    } else {
      fileInput.click();
    }
  };

  $('browse-link').addEventListener('click', openDialog);

  dropZone.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id !== 'browse-link') openDialog();
=======
  $('browse-link').addEventListener('click', () => {
    if (window.electronAPI) {
      window.electronAPI.openPptxDialog().then(setSelectedFile);
    } else {
      fileInput.click();
    }
  });

  dropZone.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id !== 'browse-link') {
      if (window.electronAPI) {
        window.electronAPI.openPptxDialog().then(setSelectedFile);
      } else {
        fileInput.click();
      }
    }
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  });

  // Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
<<<<<<< HEAD
      const pptxMatch = /\.(pptx|ppt)$/i.test(file.name);
      const htmlMatch = /\.(html|htm)$/i.test(file.name);
      if ((state.mode === 'pptx' && pptxMatch) || (state.mode === 'html' && htmlMatch)) {
=======
      if (file.name.match(/\.(pptx|ppt)$/i)) {
        // In Electron, file.path is available
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
        const filePath = (file as any).path || file.name;
        setSelectedFile(filePath, file.size);
      }
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      const filePath = (file as any).path || file.name;
      setSelectedFile(filePath, file.size);
    }
  });

  $('btn-clear-file').addEventListener('click', () => {
<<<<<<< HEAD
    state.inputPath = null;
=======
    state.pptxPath = null;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
    $('file-info-row').style.display = 'none';
    $('drop-zone').style.display = 'block';
    $('btn-convert').setAttribute('disabled', 'true');
    hideResult();
    hideProgress();
  });
}

function setSelectedFile(filePath: string | null, size?: number) {
  if (!filePath) return;
<<<<<<< HEAD
  state.inputPath = filePath;
=======
  state.pptxPath = filePath;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688

  const name = filePath.split(/[\\/]/).pop() || filePath;
  const sizeText = size ? ` · ${formatBytes(size)}` : '';

  $('file-name-text').textContent = name;
  $('file-meta-text').textContent = filePath + sizeText;

  $('file-info-row').style.display = 'flex';
  $('drop-zone').style.display = 'none';
  $('file-info-row').classList.add('active');

  // Auto-set output dir if not set
<<<<<<< HEAD
  if (!state.outputDir) {
    const sep = filePath.includes('\\') ? '\\' : '/';
    const lastSep = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    if (lastSep > -1) {
      setOutputDir(filePath.substring(0, lastSep) + sep + 'output');
    }
=======
  if (!state.outputDir && filePath.includes('\\')) {
    const dir = filePath.substring(0, filePath.lastIndexOf('\\')) + '\\output';
    setOutputDir(dir);
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
  }

  updateConvertButton();
  hideResult();
  hideProgress();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// ─── Output Directory ─────────────────────────────────────────────────────
function setupOutputDir() {
  $('btn-select-dir').addEventListener('click', async () => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.openOutputDirDialog();
      if (dir) setOutputDir(dir);
    }
  });
}

function setOutputDir(dir: string) {
  state.outputDir = dir;
  ($('output-dir-input') as HTMLInputElement).value = dir;
  updateConvertButton();
}

// ─── Convert Button ───────────────────────────────────────────────────────
function updateConvertButton() {
  const btn = $('btn-convert') as HTMLButtonElement;
<<<<<<< HEAD
  btn.disabled = !(state.inputPath && state.outputDir) || state.isConverting;
=======
  btn.disabled = !(state.pptxPath && state.outputDir) || state.isConverting;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
}

function setupConvertButton() {
  $('btn-convert').addEventListener('click', async () => {
<<<<<<< HEAD
    if (!state.inputPath || !state.outputDir) return;
=======
    if (!state.pptxPath || !state.outputDir) return;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
    await startConvert();
  });
}

async function startConvert() {
  state.isConverting = true;
  updateConvertButton();
  hideResult();
  showProgress();

  ($('btn-convert-icon') as HTMLElement).textContent = '⏳';
  ($('btn-convert-text') as HTMLElement).textContent = '轉換中...';

  // Listen for progress events
  const removeListener = window.electronAPI?.onConvertProgress((data) => {
    updateProgress(data.page, data.total, data.message);
  });

  try {
    const result = window.electronAPI
<<<<<<< HEAD
      ? state.mode === 'pptx'
        ? await window.electronAPI.convertPptx(state.inputPath!, state.outputDir!)
        : await window.electronAPI.convertHtml(state.inputPath!, state.outputDir!)
=======
      ? await window.electronAPI.convertPptx(state.pptxPath!, state.outputDir!)
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
      : await mockConvert();

    hideProgress();

    if (result.success && result.outputPath) {
      state.outputFile = result.outputPath;
      showResultSuccess(result.outputPath);
    } else {
      showResultError(result.error || '未知錯誤');
    }
  } catch (err: any) {
    hideProgress();
    showResultError(err.message);
  } finally {
    state.isConverting = false;
    ($('btn-convert-icon') as HTMLElement).textContent = '⚡';
    ($('btn-convert-text') as HTMLElement).textContent = '重新轉換';
    updateConvertButton();
    removeListener?.();
  }
}

// Mock convert for testing without Electron
function mockConvert(): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  return new Promise((resolve) => {
<<<<<<< HEAD
=======
    let p = 0;
>>>>>>> 8ca89ffa7823c1be7054d470824416fe3ba20688
    const steps = [
      [10, '正在啟動轉換引擎...'],
      [30, '解析 PPTX 結構...'],
      [55, '轉換投影片...'],
      [75, '內嵌圖片資源...'],
      [90, '寫入輸出檔案...'],
      [100, '完成！'],
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (i < steps.length) {
        const [pct, msg] = steps[i++];
        updateProgress(pct as number, 100, msg as string);
      } else {
        clearInterval(iv);
        resolve({
          success: true,
          outputPath: state.outputDir + '\\presentation_standalone.html',
        });
      }
    }, 600);
  });
}

// ─── Progress ─────────────────────────────────────────────────────────────
function showProgress() {
  $('progress-section').classList.add('visible');
  updateProgress(0, 100, '準備中...');
}

function hideProgress() {
  $('progress-section').classList.remove('visible');
}

function updateProgress(page: number, total: number, message: string) {
  const pct = Math.round((page / total) * 100);
  $('progress-fill').style.width = `${pct}%`;
  $('progress-pct').textContent = `${pct}%`;
  $('progress-label').textContent = message;
}

// ─── Result ───────────────────────────────────────────────────────────────
function showResultSuccess(filePath: string) {
  const card = $('result-card');
  card.className = 'result-card success';
  $('result-icon').textContent = '✅';
  $('result-title').textContent = '轉換成功！HTML5 檔案已生成';
  $('result-path').textContent = filePath;
  $('result-section').classList.add('visible');
  $('upload-section').classList.add('visible');
}

function showResultError(error: string) {
  const card = $('result-card');
  card.className = 'result-card error';
  $('result-icon').textContent = '❌';
  $('result-title').textContent = '轉換失敗';
  $('result-path').textContent = error;
  $('result-section').classList.add('visible');
  $('upload-section').classList.remove('visible');
}

function hideResult() {
  $('result-section').classList.remove('visible');
  $('upload-section').classList.remove('visible');
}

// ─── Result Actions ───────────────────────────────────────────────────────
function setupResultActions() {
  $('btn-open-browser').addEventListener('click', async () => {
    if (state.outputFile) {
      if (window.electronAPI) {
        await window.electronAPI.openInBrowser(state.outputFile);
      } else {
        window.open(`file://${state.outputFile}`);
      }
    }
  });

  $('btn-open-folder').addEventListener('click', async () => {
    if (state.outputDir) {
      if (window.electronAPI) {
        await window.electronAPI.openFolder(state.outputDir);
      }
    }
  });

  $('btn-show-upload').addEventListener('click', () => {
    const el = $('upload-section');
    el.scrollIntoView({ behavior: 'smooth' });
    ($('server-url-input') as HTMLInputElement).focus();
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────
function setupUploadSection() {
  $('btn-upload').addEventListener('click', async () => {
    if (!state.outputFile) return;

    const serverUrl = ($('server-url-input') as HTMLInputElement).value.trim();
    if (!serverUrl) {
      showUploadStatus('error', '請輸入伺服器 URL');
      return;
    }

    const btn = $('btn-upload') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '上傳中...';
    hideUploadStatus();

    try {
      const result = window.electronAPI
        ? await window.electronAPI.uploadToServer(state.outputFile, serverUrl)
        : { success: false, error: '需要在 Electron 環境中執行' };

      if (result.success) {
        showUploadStatus('success', `✅ 上傳成功！已加入媒體庫，可在管理後台使用`);
      } else {
        showUploadStatus('error', `❌ ${result.error}`);
      }
    } catch (err: any) {
      showUploadStatus('error', `❌ ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '上傳';
    }
  });
}

function showUploadStatus(type: 'success' | 'error', message: string) {
  const el = $('upload-status');
  el.textContent = message;
  el.className = `upload-status visible ${type}`;
}

function hideUploadStatus() {
  $('upload-status').className = 'upload-status';
}

// ─── Start ────────────────────────────────────────────────────────────────
init();
