import api from './api';

export interface SongItem {
  type: 'chord' | 'lyric';
  value: string;
}

export interface SongLine {
  items: SongItem[];
}

export interface SongSection {
  type: string;
  lines: SongLine[];
}

export interface SongStructure {
  sections: SongSection[];
}

export interface SongVersion {
  id: string;
  structureJson: SongStructure;
  createdAt: string;
}

export interface Song {
  id: string;
  title: string;
  originalKey: string;
  author?: string | null;
  createdAt: string;
  versions: SongVersion[];
}

export interface CreateSongPayload {
  title: string;
  originalKey: string;
  author?: string;
  structureJson: SongStructure;
}

export interface UpdateSongPayload {
  title?: string;
  originalKey?: string;
  author?: string;
  structureJson?: SongStructure;
}

export async function getSongs(): Promise<Song[]> {
  const { data } = await api.get<Song[]>('/songs');
  return data;
}

export async function getSong(id: string): Promise<Song> {
  const { data } = await api.get<Song>(`/songs/${id}`);
  return data;
}

export async function createSong(payload: CreateSongPayload): Promise<Song> {
  const { data } = await api.post<Song>('/songs', payload);
  return data;
}

export async function updateSong(id: string, payload: UpdateSongPayload): Promise<Song> {
  const { data } = await api.put<Song>(`/songs/${id}`, payload);
  return data;
}

export async function deleteSong(id: string): Promise<Song> {
  const { data } = await api.delete<Song>(`/songs/${id}`);
  return data;
}
