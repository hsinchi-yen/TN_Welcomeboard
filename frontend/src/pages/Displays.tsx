import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';

const ALL_PORTS = Array.from({ length: 16 }, (_, i) => 8080 + i);
const DEFAULT_PORT = 8080;

const devNum = (port: number) => (port - 8080).toString().padStart(3, '0');
const defaultLabel = (port: number) => `Display${port}`;

export default function Displays() {
  const {
    displayPorts,
    fetchDevices,
    fetchDisplayPorts,
    createDevice,
    createDisplayPort,
    updateDisplayPortLabel,
    deleteDisplayPort,
  } = useStore();

  const [pendingLabels, setPendingLabels] = useState<Record<number, string>>({});
  const [editLabels, setEditLabels] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  // port number → true means "show inline Remove confirmation"
  const [confirmRemove, setConfirmRemove] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState<{ port: number; text: string; ok: boolean } | null>(null);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    void fetchDevices();
    void fetchDisplayPorts();
  }, []);

  // Initialise editLabels from displayPorts only when a port is first seen.
  useEffect(() => {
    setEditLabels((prev) => {
      const next = { ...prev };
      (displayPorts || []).forEach((p) => {
        if (!(p.port_number in next)) {
          next[p.port_number] = p.label;
        }
      });
      return next;
    });
  }, [displayPorts]);

  const activeByPort = Object.fromEntries(
    (displayPorts || []).map((p) => [p.port_number, p])
  );

  const handleAdd = async (port: number) => {
    const label = pendingLabels[port]?.trim() || defaultLabel(port);
    setLoading((prev) => ({ ...prev, [port]: true }));
    setStatus(null);
    try {
      const device = await createDevice({ name: label });
      await createDisplayPort({ port_number: port, device_id: device.id, label });
      await fetchDisplayPorts();
      setPendingLabels((prev) => { const n = { ...prev }; delete n[port]; return n; });
      setStatus({ port, text: `Port ${port} added.`, ok: true });
    } catch {
      setStatus({ port, text: `Failed to add port ${port}.`, ok: false });
    } finally {
      setLoading((prev) => ({ ...prev, [port]: false }));
    }
  };

  const handleLabelChange = (port: number, value: string) => {
    setEditLabels((prev) => ({ ...prev, [port]: value }));
    clearTimeout(saveTimers.current[port]);
    saveTimers.current[port] = setTimeout(() => void handleLabelSave(port, value), 800);
  };

  const handleLabelSave = async (port: number, value: string) => {
    const label = value.trim() || defaultLabel(port);
    // Keep editLabels in sync when we fall back to the default label.
    setEditLabels((prev) => ({ ...prev, [port]: label }));
    try {
      await updateDisplayPortLabel(port, label);
      setSaved((prev) => ({ ...prev, [port]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [port]: false })), 1500);
    } catch {
      setStatus({ port, text: `Failed to save label for port ${port}.`, ok: false });
    }
  };

  const handleRemoveConfirm = async (port: number) => {
    // Cancel any pending label save before removing.
    clearTimeout(saveTimers.current[port]);
    delete saveTimers.current[port];
    setConfirmRemove((prev) => ({ ...prev, [port]: false }));
    setLoading((prev) => ({ ...prev, [port]: true }));
    setStatus(null);
    try {
      await deleteDisplayPort(port);
      setEditLabels((prev) => { const n = { ...prev }; delete n[port]; return n; });
      setStatus({ port, text: `Port ${port} removed.`, ok: true });
    } catch {
      setStatus({ port, text: `Failed to remove port ${port}.`, ok: false });
    } finally {
      setLoading((prev) => ({ ...prev, [port]: false }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Display Ports</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[14px_260px_1fr_100px] gap-4 items-center px-5 py-2.5 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span />
          <span>Device</span>
          <span>Label</span>
          <span />
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {ALL_PORTS.map((port) => {
            const active = activeByPort[port];
            const isDefault = port === DEFAULT_PORT;
            const isLoading = !!loading[port];
            const isConfirming = !!confirmRemove[port];
            const displayUrl = `http://localhost:${port}`;

            return (
              <div
                key={port}
                className="grid grid-cols-[14px_260px_1fr_100px] gap-4 items-center px-5 py-3"
              >
                {/* Status dot */}
                <span
                  title={active ? (active.is_online ? 'Online' : 'Offline') : 'Not configured'}
                  className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${
                    active
                      ? active.is_online ? 'bg-emerald-500' : 'bg-red-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />

                {/* Device:000 – localhost:PORT */}
                <div className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Device:{devNum(port)} –{' '}
                  {active ? (
                    <a href={displayUrl} target="_blank" rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline">
                      localhost:{port}
                    </a>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">localhost:{port}</span>
                  )}
                </div>

                {/* Label field */}
                <div className="min-w-0 relative">
                  {active ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={editLabels[port] ?? active.label}
                        onChange={(e) => handleLabelChange(port, e.target.value)}
                        onBlur={(e) => {
                          // onBlur wins over the debounce — cancel pending timer first.
                          clearTimeout(saveTimers.current[port]);
                          void handleLabelSave(port, e.target.value);
                        }}
                        placeholder={defaultLabel(port)}
                        maxLength={100}
                        className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600"
                      />
                      {saved[port] && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-500 font-medium pointer-events-none">
                          ✓
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={defaultLabel(port)}
                      value={pendingLabels[port] || ''}
                      onChange={(e) =>
                        setPendingLabels((prev) => ({ ...prev, [port]: e.target.value }))
                      }
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(port); }}
                      maxLength={100}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-1">
                  {active ? (
                    isConfirming ? (
                      <>
                        <button
                          onClick={() => void handleRemoveConfirm(port)}
                          className="px-2 py-1.5 text-xs font-medium rounded-md border text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemove((prev) => ({ ...prev, [port]: false }))}
                          className="px-2 py-1.5 text-xs font-medium rounded-md border text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove((prev) => ({ ...prev, [port]: true }))}
                        disabled={isDefault || isLoading}
                        title={isDefault ? 'Default port cannot be removed' : 'Remove port'}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        {isLoading ? '…' : 'Remove'}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => void handleAdd(port)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-40"
                    >
                      {isLoading ? '…' : 'Add'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {status && (
        <p className={`mt-4 text-sm font-medium ${status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
