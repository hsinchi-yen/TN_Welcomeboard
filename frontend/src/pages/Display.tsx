import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

interface PlaylistItem {
  id: string;
  content_type: string;
  file_path: string;
  duration_seconds: number;
}

interface PlaylistPayload {
  playlist_id: string;
  mode: 'html5_slides' | 'image_loop' | 'video_loop';
  transition_seconds: number;
  items: PlaylistItem[];
}

export default function Display() {
  const { deviceId } = useParams();
  const [payload, setPayload] = useState<PlaylistPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();

  const connect = (backoff = 1000) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Use current host for dynamic ws URL if proxied or standard setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?device_id=${deviceId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to display hub');
      setError(null);
      backoff = 1000; // Reset backoff on success
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SWITCH_PLAYLIST') {
          const newPayload = msg.payload as PlaylistPayload;
          setPayload(newPayload);
          localStorage.setItem('last_playlist', JSON.stringify(newPayload));
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      console.warn('WS disconnected. Reconnecting in', backoff);
      setError('Connection lost. Reconnecting...');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect(Math.min(backoff * 2, 30000));
      }, backoff);
    };

    ws.onerror = (e) => {
      console.error('WS Error', e);
      ws.close(); // Triggers onclose and backoff
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    // Try to load cached playlist first
    const cached = localStorage.getItem('last_playlist');
    if (cached) {
      try {
        setPayload(JSON.parse(cached));
      } catch (e) {
        // ignore
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect loop
        wsRef.current.close();
      }
    };
  }, [deviceId]);

  if (!payload) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-gray-500 font-mono">
        <div className="text-2xl mb-4">Waiting for content...</div>
        {error && <div className="text-red-500 text-sm animate-pulse">{error}</div>}
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <PlaylistRenderer payload={payload} />
      {error && (
        <div className="absolute top-4 right-4 bg-red-900/80 text-white px-3 py-1 rounded text-xs z-50 animate-pulse">
          Offline
        </div>
      )}
    </div>
  );
}

function PlaylistRenderer({ payload }: { payload: PlaylistPayload }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0); // Reset when payload changes
  }, [payload]);

  useEffect(() => {
    if (!payload.items || payload.items.length <= 1) return;

    let timeout: number;
    
    // For video_loop, duration is handled by 'ended' event in the Video player component
    // For others, use duration_seconds from item or fallback to playlist transition
    if (payload.mode !== 'video_loop') {
      const currentItem = payload.items[currentIndex];
      const durationMs = (currentItem?.duration_seconds || payload.transition_seconds) * 1000;
      
      timeout = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % payload.items.length);
      }, durationMs);
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, payload]);

  if (!payload.items || payload.items.length === 0) {
    return <div className="w-full h-full bg-black"></div>;
  }

  const currentItem = payload.items[currentIndex];

  switch (payload.mode) {
    case 'html5_slides':
      return (
        <div className="w-full h-full relative">
          {payload.items.map((item, idx) => (
            <iframe
              key={item.id}
              src={item.file_path}
              className={`absolute top-0 left-0 w-full h-full border-0 transition-opacity duration-300 ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            />
          ))}
        </div>
      );
    case 'image_loop':
      return (
        <div className="w-full h-full relative bg-black">
          {payload.items.map((item, idx) => (
            <img
              key={item.id}
              src={item.file_path}
              className={`absolute top-0 left-0 w-full h-full object-contain transition-opacity duration-500 ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            />
          ))}
        </div>
      );
    case 'video_loop':
      return (
        <div className="w-full h-full">
          <video
            key={currentItem.id} // forces recreation of video element to ensure proper playback
            src={currentItem.file_path}
            autoPlay
            muted
            className="w-full h-full object-contain"
            onEnded={() => {
              if (payload.items.length > 1) {
                setCurrentIndex((prev) => (prev + 1) % payload.items.length);
              }
            }}
          />
        </div>
      );
    default:
      return null;
  }
}
