import { useEffect, useRef, useState } from 'react';
import { useStore, Playlist, DisplayPort } from '../store/useStore';

interface Toast { id: number; msg: string; ok: boolean }

function PortCard({
  port,
  playlists,
  onPush,
}: {
  port: DisplayPort;
  playlists: Playlist[];
  onPush: (deviceId: string, playlistId: string) => Promise<void>;
}) {
  const storageKey = `wb:dashboard:selected:port:${port.port_number}`;
  const [selected, setSelected] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) ?? ''; } catch { return ''; }
  });
  const [lastPushed, setLastPushed] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const devNum = (port.port_number - 8080).toString().padStart(3, '0');
  const displayUrl = `${window.location.protocol}//${window.location.hostname}:${port.port_number}/`;

  const handleSelect = (val: string) => {
    setSelected(val);
    try { localStorage.setItem(storageKey, val); } catch {}
  };

  const handlePush = async () => {
    if (!selected) return;
    await onPush(port.device_id, selected);
    setLastPushed(selected);
    if (iframeRef.current) iframeRef.current.src = displayUrl;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Left: control */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-semibold font-mono text-gray-900 dark:text-gray-100">
              Device:{devNum} –{' '}
              <a
                href={displayUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                localhost:{port.port_number}
              </a>
            </h3>
            {port.label && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{port.label}</p>
            )}
          </div>
          <span className={`mt-0.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
            port.is_online
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
          }`}>
            {port.is_online ? '● Online' : '● Offline'}
          </span>
        </div>

        {/* Push control */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Push Playlist
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={selected}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="" disabled>Select playlist…</option>
              <option value="blank">⬛ Blank (Color Bars)</option>
              {(playlists || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.mode.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={() => void handlePush()}
              disabled={!selected}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Push
            </button>
          </div>
          {lastPushed && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Last: {lastPushed === 'blank' ? 'Color Bars' : ((playlists || []).find(p => p.id === lastPushed)?.name ?? 'Unknown')}
            </p>
          )}
        </div>

        {/* Preview toggle */}
        <button
          onClick={() => setShowPreview(v => !v)}
          className={`w-full rounded-lg border px-4 py-2 text-sm font-semibold transition shadow-sm ${
            showPreview
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
        </button>
      </div>

      {/* Right: preview iframe */}
      {showPreview && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-black overflow-hidden shadow-sm">
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-600">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">
              Live Preview — {displayUrl}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <button
                onClick={() => { if (iframeRef.current) iframeRef.current.src = displayUrl; }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >↺ Reload</button>
              <a href={displayUrl} target="_blank" rel="noreferrer"
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                ↗ Full
              </a>
            </div>
          </div>
          <div className="bg-black flex items-center justify-center p-2">
            <iframe
              ref={iframeRef}
              src={displayUrl}
              style={{ width: 960, height: 540, border: 0, display: 'block', flexShrink: 0 }}
              title={`Preview — :${port.port_number}`}
              allow="autoplay"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { playlists, displayPorts, fetchDevices, fetchPlaylists, fetchDisplayPorts, pushToDevice } = useStore();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string, ok = true) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  useEffect(() => {
    void fetchDevices();
    void fetchPlaylists();
    void fetchDisplayPorts();
    const interval = setInterval(() => { void fetchDevices(); void fetchDisplayPorts(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePush = async (deviceId: string, playlistId: string) => {
    try {
      await pushToDevice(deviceId, playlistId);
      addToast('Playlist pushed to display.');
    } catch {
      addToast('Failed to push playlist.', false);
    }
  };

  return (
    <div className="relative max-w-7xl mx-auto">
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${t.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {(displayPorts || []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
          No display ports configured. Go to <strong>Displays</strong> to add one.
        </div>
      ) : (
        <div className="space-y-6">
          {(displayPorts || []).map((port) => (
            <PortCard
              key={port.port_number}
              port={port}
              playlists={playlists || []}
              onPush={handlePush}
            />
          ))}
        </div>
      )}
    </div>
  );
}
