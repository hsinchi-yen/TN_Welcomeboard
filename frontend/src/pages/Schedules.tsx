import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

export default function Schedules() {
  const {
    devices,
    playlists,
    schedules,
    displayPorts,
    fetchDevices,
    fetchPlaylists,
    fetchSchedules,
    fetchDisplayPorts,
    createSchedule,
    deleteSchedule,
    pushToDevice,
  } = useStore();

  const portByDevice = Object.fromEntries(
    (displayPorts || []).map((p) => [p.device_id, p.port_number])
  );

  const deviceLabel = (deviceId: string) => {
    const port = portByDevice[deviceId];
    if (port) {
      const num = (port - 8080).toString().padStart(3, '0');
      return `Device:${num} – localhost:${port}`;
    }
    const dev = devices.find((d) => d.id === deviceId);
    return dev?.name ?? deviceId;
  };

  const [deviceId, setDeviceId] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetchDevices();
    void fetchPlaylists();
    void fetchSchedules();
    void fetchDisplayPorts();
  }, []);

  useEffect(() => {
    if (!deviceId && devices.length > 0) setDeviceId(devices[0].id);
  }, [deviceId, devices]);

  useEffect(() => {
    if (!playlistId && playlists.length > 0) setPlaylistId(playlists[0].id);
  }, [playlistId, playlists]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) =>
      current.includes(day)
        ? current.filter((v) => v !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  };

  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const handleCreateSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceId || !playlistId || daysOfWeek.length === 0) {
      setStatus('Select a device, playlist, and at least one weekday.');
      return;
    }
    if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
      setStatus('Invalid time — use HH:MM format.');
      return;
    }
    if (startTime >= endTime) {
      setStatus('End time must be after start time.');
      return;
    }
    try {
      await createSchedule({
        device_id: deviceId,
        playlist_id: playlistId,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        days_of_week: daysOfWeek,
        is_active: true,
      });
      await fetchSchedules();
      setStatus('Schedule created. It will auto-push when the time window is active.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to create schedule.');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await deleteSchedule(scheduleId);
      await fetchSchedules();
      setStatus('Schedule deleted.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to delete schedule.');
    }
  };

  const handlePushNow = async (devId: string, plId: string) => {
    try {
      await pushToDevice(devId, plId);
      setStatus('Pushed to display.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to push.');
    }
  };

  const dayLabels = (days: number[]) =>
    days.map((d) => weekdays.find((w) => w.value === d)?.label).filter(Boolean).join(', ');

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* Create schedule */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Schedules</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Auto-push a playlist to the display during a daily time window.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleCreateSchedule}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Device</label>
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={inputCls}>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>{deviceLabel(device.id)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Playlist</label>
            <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)} className={inputCls}>
              {playlists.length === 0 && <option value="">No playlists — create one first</option>}
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls + ' font-mono'}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls + ' font-mono'}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Days of Week</div>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    daysOfWeek.includes(day.value)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-sm"
          >
            Create Schedule
          </button>
        </form>

        {status && (
          <p className={`mt-4 text-sm font-medium ${status.startsWith('Failed') ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
            {status}
          </p>
        )}
      </section>

      {/* Active schedules */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Active Schedules
          {schedules.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({schedules.length})</span>
          )}
        </h3>
        <div className="mt-6 space-y-3">
          {schedules.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No schedules yet. Create one to auto-push playlists.
            </div>
          )}
          {schedules.map((schedule) => {
            const playlist = playlists.find((p) => p.id === schedule.playlist_id);
            const start = schedule.start_time.substring(0, 5);
            const end = schedule.end_time.substring(0, 5);
            return (
              <div
                key={schedule.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {playlist?.name ?? schedule.playlist_id}
                    </div>
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {deviceLabel(schedule.device_id)}
                    </div>
                    <div className="flex flex-wrap gap-3 pt-1 text-xs">
                      <span className="font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                        {start} – {end}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {dayLabels(schedule.days_of_week)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handlePushNow(schedule.device_id, schedule.playlist_id)}
                      className="rounded-lg border border-blue-200 dark:border-blue-700 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-sm"
                    >
                      Push Now
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSchedule(schedule.id)}
                      className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
