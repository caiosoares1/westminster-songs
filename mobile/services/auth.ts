import api from './api';

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Member extends User {
  createdAt: string;
}

interface Session {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<Session> {
  const { data } = await api.post<Session>('/auth/login', { email, password });
  return data;
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}): Promise<Session> {
  const { data } = await api.post<Session>('/auth/register', payload);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function getMembers(): Promise<Member[]> {
  const { data } = await api.get<Member[]>('/users');
  return data;
}

export async function setMemberRole(id: string, role: UserRole): Promise<void> {
  await api.patch(`/users/${id}`, { role });
}

export async function removeMember(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
