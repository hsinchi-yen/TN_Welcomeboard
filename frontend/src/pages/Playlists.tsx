import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useStore, type MediaLibraryItem, type Playlist, type PlaylistItem, type PlaylistMode } from '../store/useStore';

const modeLabels: Record<PlaylistMode, string> = {
  html5_slides: 'HTML5 Slides',
  image_loop: 'Image Loop',
  video_loop: 'Video Loop',
};

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
const labelCls = 'text-xs font-medium text-gray-700 dark:text-gray-300';

export default function Playlists() {
  const { playlists, mediaLibrary, fetchPlaylists, createPlaylist, deletePlaylist, fetchMediaLibrary } = useStore();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PlaylistMode>('html5_slides');
  const [transitionSeconds, setTransitionSeconds] = useState(5);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetchPlaylists();
    void fetchMediaLibrary();
  }, []);

  useEffect(() => {
    if (!selectedPlaylistId && playlists.length > 0) {
      setSelectedPlaylistId(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    if (!selectedPlaylistId) {
      setSelectedPlaylist(null);
      return;
    }

    const loadPlaylist = async () => {
      try {
        const response = await apiClient.get(`/playlists/${selectedPlaylistId}`);
        setSelectedPlaylist(response.data);
      } catch (error) {
        console.error(error);
        setStatus('Failed to load playlist details.');
      }
    };

    void loadPlaylist();
  }, [selectedPlaylistId]);

  const compatibleMedia = useMemo(() => {
    if (!selectedPlaylist) return mediaLibrary;
    return mediaLibrary.filter((item) => item.suggested_mode === selectedPlaylist.mode);
  }, [mediaLibrary, selectedPlaylist]);

  useEffect(() => {
    if (!selectedMediaUrl && compatibleMedia.length > 0) {
      setSelectedMediaUrl(compatibleMedia[0].url);
    }
    if (compatibleMedia.length === 0) {
      setSelectedMediaUrl('');
    }
  }, [compatibleMedia, selectedMediaUrl]);

  const handleCreatePlaylist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    try {
      const playlist = await createPlaylist({
        name: name.trim(),
        mode,
        transition_seconds: transitionSeconds,
      });
      setName('');
      setTransitionSeconds(8);
      setSelectedPlaylistId(playlist.id);
      setStatus('Playlist created. Add media items below.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to create playlist.');
    }
  };

  const handleAddItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlaylist || !selectedMediaUrl) {
      setStatus('Select a playlist and a media file first.');
      return;
    }

    const media = compatibleMedia.find((item) => item.url === selectedMediaUrl);
    if (!media) {
      setStatus('Selected media is not compatible with the playlist mode.');
      return;
    }

    const nextSortOrder = (selectedPlaylist.items?.length ?? 0) + 1;

    const newItem: Partial<PlaylistItem> = {
      playlist_id: selectedPlaylist.id,
      file_path: selectedMediaUrl,
      display_name: media.name,
      content_type: media.content_type,
      sort_order: nextSortOrder,
      duration_seconds: durationSeconds,
    };

    try {
      await apiClient.post(`/playlists/${selectedPlaylist.id}/items`, newItem);
      const response = await apiClient.get(`/playlists/${selectedPlaylist.id}`);
      setSelectedPlaylist(response.data);
      setStatus('Item added.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to add item.');
    }
  };

  const handleUpdateItem = async (itemId: string, duration: number, sortOrder: number) => {
    if (!selectedPlaylist) return;
    try {
      await apiClient.put(`/playlists/${selectedPlaylist.id}/items/${itemId}`, {
        duration_seconds: duration,
        sort_order: sortOrder,
      });
      const response = await apiClient.get(`/playlists/${selectedPlaylist.id}`);
      setSelectedPlaylist(response.data);
      setStatus('Item updated.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to update item.');
    }
  };

  const handleDeleteItem = async (item: PlaylistItem) => {
    if (!selectedPlaylist) return;
    try {
      await apiClient.delete(`/playlists/${selectedPlaylist.id}/items/${item.id}`);
      const response = await apiClient.get(`/playlists/${selectedPlaylist.id}`);
      setSelectedPlaylist(response.data);
      setStatus('Item removed.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to remove item.');
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!window.confirm('Delete this playlist?')) return;
    try {
      await deletePlaylist(id);
      setSelectedPlaylistId('');
      setStatus('Playlist deleted.');
    } catch (error) {
      console.error(error);
      setStatus('Failed to delete playlist.');
    }
  };

  const handlePreviewOnDisplay = async () => {
    if (!selectedPlaylist) return;
    try {
      await apiClient.post('/devices/00000000-0000-0000-0000-000000000001/push', {
        playlist_id: selectedPlaylist.id,
      });
      window.open(`${window.location.protocol}//${window.location.hostname}:8080/`, '_blank');
    } catch {
      setStatus('Failed to push for preview.');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[350px_minmax(0,1fr)] items-start">
      {/* Left column — create + list */}
      <section className="space-y-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Playlists</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Create playlists from existing media or new uploads.</p>
        </div>

        <form className="space-y-4" onSubmit={handleCreatePlaylist}>
          <div className="space-y-1">
            <label className={labelCls}>Playlist Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Morning Slides"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Playback Mode</label>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as PlaylistMode)}
              className={inputCls}
            >
              {Object.entries(modeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Global Transition Time (secs)</label>
            <input
              type="number"
              min={1}
              value={transitionSeconds}
              onChange={(event) => setTransitionSeconds(Number(event.target.value))}
              className={inputCls}
            />
          </div>
          <button
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-sm"
            type="submit"
          >
            Create Playlist
          </button>
        </form>

        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          {playlists.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 text-center">
              No playlists yet.
            </div>
          )}
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => setSelectedPlaylistId(playlist.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition shadow-sm ${
                selectedPlaylistId === playlist.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{playlist.name}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {modeLabels[playlist.mode]} · {playlist.transition_seconds}s
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                  {playlist.item_count ?? 0} items
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Right column — manage items */}
      <section className="space-y-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        {!selectedPlaylist ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-8 text-center text-gray-500 dark:text-gray-400">
            Select a playlist to manage items.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{selectedPlaylist.name}</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {modeLabels[selectedPlaylist.mode]} · {selectedPlaylist.transition_seconds}s transition
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handlePreviewOnDisplay()}
                  className="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 transition hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-sm"
                >
                  Preview on Display
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeletePlaylist(selectedPlaylist.id)}
                  className="rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm"
                >
                  Delete Playlist
                </button>
              </div>
            </div>

            {/* Add item form */}
            <form
              className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4 md:grid-cols-[minmax(0,1fr)_120px_auto] items-end"
              onSubmit={handleAddItem}
            >
              <div className="space-y-1">
                <label className={`block ${labelCls}`}>Select Media</label>
                <select value={selectedMediaUrl} onChange={(event) => setSelectedMediaUrl(event.target.value)} className={inputCls}>
                  {compatibleMedia.length === 0 && (
                    <option value="">No compatible files — upload first</option>
                  )}
                  {compatibleMedia.map((item: MediaLibraryItem) => (
                    <option key={item.url} value={item.url}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={`block ${labelCls}`}>Duration (secs)</label>
                <input
                  type="number"
                  min={1}
                  value={durationSeconds}
                  onChange={(event) => setDurationSeconds(Number(event.target.value))}
                  className={inputCls}
                />
              </div>
              <button
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
                type="submit"
              >
                Add Item
              </button>
            </form>

            {/* Item list */}
            <div className="space-y-3">
              {(selectedPlaylist.items?.length ?? 0) === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  This playlist is empty. Add files from the media library above.
                </div>
              )}
              {selectedPlaylist.items?.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="aspect-video overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600 relative">
                    {item.content_type === 'video' ? (
                      <video src={item.file_path} className="h-full w-full object-cover" muted
                        onError={(e) => { (e.currentTarget.style.display = 'none'); }}
                      />
                    ) : item.content_type === 'html5' ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">HTML5</div>
                    ) : (
                      <img
                        src={item.file_path}
                        className="h-full w-full object-cover"
                        alt={item.display_name ?? ''}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const p = e.currentTarget.parentElement;
                          if (p && !p.querySelector('.thumb-err')) {
                            const d = document.createElement('div');
                            d.className = 'thumb-err text-xs text-gray-400 dark:text-gray-500';
                            d.textContent = 'No preview';
                            p.appendChild(d);
                          }
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {item.display_name ?? item.file_path.split('/').pop()}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <label className="font-medium">Order</label>
                        <input
                          type="number"
                          min={1}
                          defaultValue={item.sort_order}
                          onBlur={(e) =>
                            handleUpdateItem(item.id, item.duration_seconds ?? selectedPlaylist.transition_seconds, Number(e.target.value))
                          }
                          className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="font-medium">Duration (s)</label>
                        <input
                          type="number"
                          min={1}
                          defaultValue={item.duration_seconds ?? selectedPlaylist.transition_seconds}
                          onBlur={(e) => handleUpdateItem(item.id, Number(e.target.value), item.sort_order)}
                          className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-2 break-all text-xs text-gray-400 dark:text-gray-500 font-mono">{item.file_path.split('/').pop()}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteItem(item)}
                    className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {status && <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{status}</p>}
      </section>
    </div>
  );
}