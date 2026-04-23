import { useState, useRef, useEffect } from 'react';
import { apiClient } from '../api/client';
import { ExternalLink, Trash2 } from 'lucide-react';

interface StorageInfo {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
}

interface MediaItem {
  name: string;
  url: string;
  content_type: string;
  suggested_mode: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Upload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLibrary = async () => {
    try {
      const res = await apiClient.get('/media-library');
      setMediaLibrary(res.data || []);
    } catch (error) {
      console.error('Failed to fetch media library:', error);
    }
  };

  const fetchStorage = async () => {
    try {
      const res = await apiClient.get('/system/storage');
      setStorageInfo(res.data);
    } catch (error) {
      console.error('Failed to fetch storage info:', error);
    }
  };

  useEffect(() => {
    void fetchLibrary();
    void fetchStorage();
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let overwrite = false;

      const existingItem = mediaLibrary.find((item) => item.name === file.name);
      if (existingItem) {
        const ok = window.confirm(`"${file.name}" already exists. Overwrite?`);
        if (!ok) {
          setStatus(`Skipped: ${file.name}`);
          continue;
        }
        overwrite = true;
      }

      setUploading(true);
      setProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      if (overwrite) formData.append('overwrite', 'true');

      try {
        await apiClient.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            setProgress(pct);
          },
        });
        setStatus(`Uploaded: ${file.name}`);
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        if (err?.response?.status === 409) {
          setStatus(`Conflict: ${file.name} already exists (not overwritten).`);
        } else {
          setStatus(`Upload failed: ${file.name}`);
        }
      } finally {
        setUploading(false);
        setProgress(0);
      }
    }

    await fetchLibrary();
    await fetchStorage();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete "${filename}"? This may affect playlists currently using this file.`)) return;
    try {
      await apiClient.delete(`/media/${encodeURIComponent(filename)}`);
      setStatus(`Deleted: ${filename}`);
      await fetchLibrary();
      await fetchStorage();
    } catch (error) {
      console.error(error);
      setStatus(`Delete failed: ${filename}`);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      void handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Upload Media</h2>
        {storageInfo && (
          <div className="mt-2 md:mt-0 text-sm text-gray-500 dark:text-gray-400">
            Storage:{' '}
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{formatBytes(storageInfo.used_bytes)}</span>
            {' / '}
            {formatBytes(storageInfo.total_bytes)}
            {' ('}
            {formatBytes(storageInfo.free_bytes)} free{')'}
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer bg-white dark:bg-gray-800 ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => void handleUpload(e.target.files)}
          accept="image/*,video/*,.html,.zip"
          multiple
        />
        <div className="text-gray-600 dark:text-gray-400">
          <p className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Click or drag files to upload</p>
          <p className="text-sm">Supports standalone HTML, images, and videos. Uploaded files appear in the Playlists media library.</p>
        </div>
      </div>

      {status && <p className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">{status}</p>}

      {uploading && (
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1 text-gray-700 dark:text-gray-300">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {mediaLibrary.length > 0 && (
        <div className="mt-10">
          <h3 className="font-semibold mb-4 text-lg border-b border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-gray-100">
            Media Library ({mediaLibrary.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mediaLibrary.map((f) => (
              <div
                key={f.url}
                className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col relative group"
              >
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 overflow-hidden flex items-center justify-center relative">
                  {f.url.match(/\.(mp4|webm)$/i) ? (
                    <video src={f.url} className="max-w-full max-h-full" />
                  ) : f.url.match(/\.html$/i) ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400">HTML5 Content</div>
                  ) : (
                    <img src={f.url} className="max-w-full max-h-full object-contain" alt={f.name} />
                  )}
                  <div className="absolute top-2 left-2">
                    <span className="text-xs px-2 py-1 bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 rounded">
                      {f.suggested_mode.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-2" title={f.name}>
                  {f.name}
                </p>

                {/* Actions overlay */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-white dark:bg-gray-700 shadow rounded text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    title="View"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => void handleDelete(f.name)}
                    className="p-1.5 bg-white dark:bg-gray-700 shadow rounded text-gray-700 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}