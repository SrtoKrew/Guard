import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

async function req<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${res.status} ${t}`);
  }
  return res.json();
}

export type Nave = { id: string; name: string; address?: string; notes?: string; created_at: string };
export type Event = {
  id: string;
  guard: string;
  type: string;
  nave_id?: string;
  nave_name?: string;
  note?: string;
  timestamp: string;
};
export type Incident = {
  id: string;
  guard: string;
  tipo: string;
  nave_id?: string;
  nave_name?: string;
  description: string;
  photo_path?: string;
  timestamp: string;
};
export type Task = {
  id: string;
  title: string;
  description?: string;
  nave_id?: string;
  nave_name?: string;
  done: boolean;
  done_by?: string;
  done_at?: string;
  created_at: string;
};

export const api = {
  base: BASE,
  // Naves
  listNaves: () => req<Nave[]>('/naves'),
  createNave: (payload: { name: string; address?: string; notes?: string }) =>
    req<Nave>('/naves', { method: 'POST', body: JSON.stringify(payload) }),
  deleteNave: (id: string) => req(`/naves/${id}`, { method: 'DELETE' }),
  // Events
  listEvents: (guard?: string) =>
    req<Event[]>(`/events${guard ? `?guard=${encodeURIComponent(guard)}` : ''}`),
  createEvent: (payload: {
    guard: string;
    type: string;
    nave_id?: string;
    nave_name?: string;
    note?: string;
  }) => req<Event>('/events', { method: 'POST', body: JSON.stringify(payload) }),
  deleteEvent: (id: string) => req(`/events/${id}`, { method: 'DELETE' }),
  // Incidents
  listIncidents: (guard?: string) =>
    req<Incident[]>(`/incidents${guard ? `?guard=${encodeURIComponent(guard)}` : ''}`),
  createIncident: (payload: {
    guard: string;
    tipo: string;
    nave_id?: string;
    nave_name?: string;
    description: string;
    photo_path?: string;
  }) => req<Incident>('/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  // Tasks
  listTasks: () => req<Task[]>('/tasks'),
  createTask: (payload: { title: string; description?: string; nave_id?: string; nave_name?: string }) =>
    req<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  toggleTask: (id: string, guard: string) =>
    req<Task>(`/tasks/${id}/toggle?guard=${encodeURIComponent(guard)}`, { method: 'POST' }),
  deleteTask: (id: string) => req(`/tasks/${id}`, { method: 'DELETE' }),
  // Upload
  uploadPhoto: async (uri: string, guard: string) => {
    const form = new FormData();
    const name = `photo_${Date.now()}.jpg`;
    // @ts-expect-error native FormData shape
    form.append('file', { uri, name, type: 'image/jpeg' });
    form.append('guard', guard);
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form as any });
    if (!res.ok) throw new Error(`upload ${res.status}`);
    return res.json() as Promise<{ path: string; size: number }>;
  },
  fileUrl: (path: string) => `${BASE}/api/files/${path}`,
  exportPdfUrl: (guard?: string) =>
    `${BASE}/api/export/pdf${guard ? `?guard=${encodeURIComponent(guard)}` : ''}`,
  exportExcelUrl: (guard?: string) =>
    `${BASE}/api/export/excel${guard ? `?guard=${encodeURIComponent(guard)}` : ''}`,
};

// Session
const GUARD_KEY = 'cg.guard.name';
export const session = {
  async getGuard(): Promise<string | null> {
    return AsyncStorage.getItem(GUARD_KEY);
  },
  async setGuard(name: string) {
    await AsyncStorage.setItem(GUARD_KEY, name);
  },
  async clear() {
    await AsyncStorage.removeItem(GUARD_KEY);
  },
};
