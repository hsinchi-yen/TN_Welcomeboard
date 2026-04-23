import { create } from 'zustand';
import { apiClient } from '../api/client';

export interface Device {
  id: string;
  name: string;
  description?: string | null;
  last_seen_at?: string | null;
  created_at: string;
  is_online: boolean;
}

export type PlaylistMode = 'html5_slides' | 'image_loop' | 'video_loop';

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  content_type: 'html5' | 'image' | 'video';
  file_path: string;
  display_name?: string | null;
  sort_order: number;
  duration_seconds?: number | null;
  created_at: string;
}

export interface Playlist {
  id: string;
  name: string;
  mode: PlaylistMode;
  transition_seconds: number;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: PlaylistItem[];
}

export interface Schedule {
  id: string;
  device_id: string;
  playlist_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  is_active: boolean;
  created_at: string;
}

export interface MediaLibraryItem {
  name: string;
  url: string;
  content_type: 'html5' | 'image' | 'video';
  suggested_mode: PlaylistMode;
}

interface StoreState {
  devices: Device[];
  playlists: Playlist[];
  schedules: Schedule[];
  mediaLibrary: MediaLibraryItem[];
  fetchDevices: () => Promise<void>;
  createDevice: (payload: { name: string; description?: string }) => Promise<Device>;
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (payload: { name: string; mode: PlaylistMode; transition_seconds: number }) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  fetchSchedules: () => Promise<void>;
  createSchedule: (payload: {
    device_id: string;
    playlist_id: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    is_active: boolean;
  }) => Promise<Schedule>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
  fetchMediaLibrary: () => Promise<void>;
  pushToDevice: (deviceId: string, playlistId: string) => Promise<void>;
}

export const useStore = create<StoreState>((set) => ({
  devices: [],
  playlists: [],
  schedules: [],
  mediaLibrary: [],
  fetchDevices: async () => {
    const res = await apiClient.get('/devices');
    set({ devices: res.data || [] });
  },
  createDevice: async (payload) => {
    const res = await apiClient.post('/devices', payload);
    set((state) => ({ devices: [res.data, ...(state.devices || [])] }));
    return res.data;
  },
  fetchPlaylists: async () => {
    const res = await apiClient.get('/playlists');
    set({ playlists: res.data || [] });
  },
  createPlaylist: async (payload) => {
    const res = await apiClient.post('/playlists', payload);
    set((state) => ({ playlists: [res.data, ...(state.playlists || [])] }));
    return res.data;
  },
  deletePlaylist: async (playlistId) => {
    await apiClient.delete(`/playlists/${playlistId}`);
    set((state) => ({ playlists: (state.playlists || []).filter((playlist) => playlist.id !== playlistId) }));
  },
  fetchSchedules: async () => {
    const res = await apiClient.get('/schedules');
    set({ schedules: res.data || [] });
  },
  createSchedule: async (payload) => {
    const res = await apiClient.post('/schedules', payload);
    set((state) => ({ schedules: [res.data, ...(state.schedules || [])] }));
    return res.data;
  },
  deleteSchedule: async (scheduleId) => {
    await apiClient.delete(`/schedules/${scheduleId}`);
    set((state) => ({ schedules: (state.schedules || []).filter((schedule) => schedule.id !== scheduleId) }));
  },
  fetchMediaLibrary: async () => {
    const res = await apiClient.get('/media-library');
    // 統一 name 欄位，兼容 Name/name
    const items = (res.data || []).map((item: any) => ({
      ...item,
      name: item.name || item.Name
    }));
    set({ mediaLibrary: items });
  },
  pushToDevice: async (deviceId, playlistId) => {
    await apiClient.post(`/devices/${deviceId}/push`, { playlist_id: playlistId });
  }
}));
