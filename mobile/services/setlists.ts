import api from './api';

export interface SetlistSongSummary {
  id: string;
  title: string;
  author: string | null;
  originalKey: string;
}

export interface SetlistEntry {
  id: string;
  key: string;
  position: number;
  song: SetlistSongSummary;
}

export interface Setlist {
  id: string;
  name: string;
  /** Service date, stored as midnight UTC of that day. */
  date: string | null;
  createdAt: string;
}

export interface SetlistListItem extends Setlist {
  songCount: number;
}

export interface SetlistDetail extends Setlist {
  songs: SetlistEntry[];
}

export async function getSetlists(): Promise<SetlistListItem[]> {
  const { data } = await api.get<SetlistListItem[]>('/setlists');
  return data;
}

export async function getSetlist(id: string): Promise<SetlistDetail> {
  const { data } = await api.get<SetlistDetail>(`/setlists/${id}`);
  return data;
}

export async function createSetlist(payload: { name: string; date?: string | null }): Promise<SetlistDetail> {
  const { data } = await api.post<SetlistDetail>('/setlists', payload);
  return data;
}

export async function updateSetlist(
  id: string,
  payload: { name?: string; date?: string | null },
): Promise<SetlistDetail> {
  const { data } = await api.put<SetlistDetail>(`/setlists/${id}`, payload);
  return data;
}

export async function deleteSetlist(id: string): Promise<void> {
  await api.delete(`/setlists/${id}`);
}

/** Replaces the ordered list of songs (and the key of each one). */
export async function replaceSetlistSongs(
  id: string,
  items: { songId: string; key: string }[],
): Promise<SetlistDetail> {
  const { data } = await api.put<SetlistDetail>(`/setlists/${id}/songs`, { items });
  return data;
}
