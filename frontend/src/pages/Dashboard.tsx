import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';

const PREVIEW_DEVICE_ID = '00000000-0000-0000-0000-000000000001';

interface Toast { id: number; msg: string; ok: boolean }

export default function Dashboard() {
  const { devices, playlists, fetchDevices, fetchPlaylists, pushToDevice } = useStore();
  const [selectedPlaylist, setSelectedPlaylist] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wb:dashboard:selected');
      if (saved) return JSON.parse(saved) as Record<string, string>;
    } catch {}
    return {};
  });
  const [lastPushed, setLastPushed] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showLiveView, setShowLiveView] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Display screen is always on port 8080 of the same host as the admin portal
  const displayUrl = `${window.location.protocol}//${window.location.hostname}:8080/`;

  const handleSelectChange = (deviceId: string, value: string) => {
    setSelectedPlaylist(prev => {
      const next = { ...prev, [deviceId]: value };
      try { localStorage.setItem('wb:dashboard:selected', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const addToast = (msg: string, ok = true) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  useEffect(() => {
    void fetchDevices();
    void fetchPlaylists();
    const interval = setInterval(() => { void fetchDevices(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePush = async (deviceId: string) => {
    const playlistId = selectedPlaylist[deviceId];
    if (!playlistId) { addToast('Select a playlist before pushing.', false); return; }
    try {
      await pushToDevice(deviceId, playlistId);
      setLastPushed(prev => ({ ...prev, [deviceId]: playlistId }));
      addToast('Playlist pushed to display.');
      // Reload the live-view iframe so it picks up the new content
      if (iframeRef.current) {
        iframeRef.current.src = displayUrl;
      }
    } catch {
      addToast('Failed to push playlist.', false);
    }
  };

  const previewDevice = devices.find((d) => d.id === PREVIEW_DEVICE_ID);

  return (
    <div className="relative">
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all
              ${t.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* Device card */}
        {!previewDevice ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
            Preview Device is loading…
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            {/* Left — device info + push control */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Push content to the display screen in real-time.</p>
                </div>
                <span className={`mt-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  previewDevice.is_online
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                }`}>
                  {previewDevice.is_online ? '● Online' : '● Offline'}
                </span>
              </div>

              {/* Display URL */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600 p-4">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Display URL</div>
                <div className="flex items-center gap-2">
                  <span className="flex-1 break-all text-sm text-blue-600 dark:text-blue-400 font-mono">{displayUrl}</span>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    title="Open in new tab"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Push control */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Push Playlist to Display</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={selectedPlaylist[previewDevice.id] || ''}
                    onChange={(e) => handleSelectChange(previewDevice.id, e.target.value)}
                  >
                    <option value="" disabled>Select playlist…</option>
                    <option value="blank">⬛ Blank (Color Bars)</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} · {p.mode.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => void handlePush(previewDevice.id)}
                    disabled={!selectedPlaylist[previewDevice.id]}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
                  >
                    Push
                  </button>
                </div>
                {playlists.length === 0 && (
                  <p className="text-xs text-orange-500 dark:text-orange-400">No playlists yet — create one in the Playlists page first.</p>
                )}
                {lastPushed[previewDevice.id] && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Last pushed: {lastPushed[previewDevice.id] === 'blank' ? 'Color Bars' : (playlists.find(p => p.id === lastPushed[previewDevice.id])?.name ?? 'Unknown')}
                  </p>
                )}
              </div>

              {/* Live view toggle */}
              <button
                onClick={() => setShowLiveView(v => !v)}
                className={`w-full rounded-lg border px-4 py-2 text-sm font-semibold transition shadow-sm ${
                  showLiveView
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {showLiveView ? 'Hide Live Preview' : 'Show Live Preview'}
              </button>
            </div>

            {/* Right — live view iframe */}
            {showLiveView && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-black overflow-hidden shadow-sm">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-600">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Live Preview — {displayUrl}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { if (iframeRef.current) iframeRef.current.src = displayUrl; }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                      title="Reload"
                    >
                      ↺ Reload
                    </button>
                    <a href={displayUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                      title="Open full screen"
                    >
                      ↗ Full
                    </a>
                  </div>
                </div>
                <div className="bg-black flex items-center justify-center p-2">
                  <iframe
                    ref={iframeRef}
                    src={displayUrl}
                    style={{ width: 960, height: 540, border: 0, display: 'block', flexShrink: 0 }}
                    title="Display Live Preview"
                    allow="autoplay"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
