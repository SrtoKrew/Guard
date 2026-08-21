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

export type Nave = {
  id: string; name: string; address?: string; notes?: string; service_name?: string;
  has_access_buttons: boolean; check_items: string[]; custom_actions: string[]; has_vehicles: boolean;
  created_at: string;
};
export type Event = {
  id: string;
  guard: string;
  type: string;
  nave_id?: string;
  nave_name?: string;
  note?: string;
  photo_path?: string;
  turno_id?: string;
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
  turno_id?: string;
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
export type TurnoOpcion = { tipo: 'dia' | 'noche'; label: string; horario: string };
export type Turno = {
  id: string;
  guard: string;
  service_name: string;
  turno_tipo?: 'dia' | 'noche';
  start_time: string;
  scheduled_end?: string;
  end_time?: string;
  status: 'activo' | 'finalizado';
  auto_finalizado?: boolean;
  summary?: {
    total_eventos: number;
    incidencias: number;
    llamadas_centralita: number;
    entradas_nave: number;
    salidas_nave: number;
    descansos: number;
    chequeos: number;
    duracion_segundos?: number;
  };
};
export type Vehicle = {
  id: string;
  nave_id: string;
  tipo: string;
  matricula: string;
  zone: 'linea' | 'frente';
  order: number;
  vandalizado: boolean;
  vandalizado_detalle?: string;
  photo_path?: string;
  created_at: string;
  updated_at: string;
};
export type NaveCheck = {
  nave_id: string;
  turno_id: string;
  item_name: string;
  checked: boolean;
  checked_by?: string | null;
  checked_at?: string | null;
};

export const api = {
  base: BASE,
  // Servicios
  listServices: () => req<{ name: string }[]>('/services'),
  // Turnos
  turnoOpciones: () => req<TurnoOpcion[]>('/turnos/opciones'),
  startTurno: (guard: string, service_name: string, turno_tipo: string, lat?: number | null, lng?: number | null) =>
    req<Turno>('/turnos', { method: 'POST', body: JSON.stringify({ guard, service_name, turno_tipo, lat, lng }) }),
  getActiveTurno: (guard: string) => req<Turno | null>(`/turnos/active?guard=${encodeURIComponent(guard)}`),
  getTurno: (id: string) => req<Turno>(`/turnos/${id}`),
  listTurnos: (guard?: string) => req<Turno[]>(`/turnos${guard ? `?guard=${encodeURIComponent(guard)}` : ''}`),
  finalizarTurno: (id: string, lat?: number | null, lng?: number | null) =>
    req<Turno>(`/turnos/${id}/finalizar`, { method: 'POST', body: JSON.stringify({ lat, lng }) }),
  // Naves
  listNaves: () => req<Nave[]>('/naves'),
  createNave: (payload: { name: string; address?: string; notes?: string }) =>
    req<Nave>('/naves', { method: 'POST', body: JSON.stringify(payload) }),
  deleteNave: (id: string) => req(`/naves/${id}`, { method: 'DELETE' }),
  reorderNaves: (ids: string[]) => req('/naves/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  // Events
  listEvents: (guard?: string, turnoId?: string) => {
    const params = new URLSearchParams();
    if (guard) params.append('guard', guard);
    if (turnoId) params.append('turno_id', turnoId);
    const qs = params.toString();
    return req<Event[]>(`/events${qs ? `?${qs}` : ''}`);
  },
  createEvent: (payload: {
    guard: string;
    type: string;
    nave_id?: string;
    nave_name?: string;
    note?: string;
    photo_path?: string;
    turno_id?: string;
  }) => req<Event>('/events', { method: 'POST', body: JSON.stringify(payload) }),
  deleteEvent: (id: string) => req(`/events/${id}`, { method: 'DELETE' }),
  // Incidents
  listIncidents: (guard?: string, turnoId?: string) => {
    const params = new URLSearchParams();
    if (guard) params.append('guard', guard);
    if (turnoId) params.append('turno_id', turnoId);
    const qs = params.toString();
    return req<Incident[]>(`/incidents${qs ? `?${qs}` : ''}`);
  },
  createIncident: (payload: {
    guard: string;
    tipo: string;
    nave_id?: string;
    nave_name?: string;
    description: string;
    photo_path?: string;
    turno_id?: string;
    lat?: number | null;
    lng?: number | null;
  }) => req<Incident>('/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  // Tasks
  listTasks: () => req<Task[]>('/tasks'),
  createTask: (payload: { title: string; description?: string; nave_id?: string; nave_name?: string }) =>
    req<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  toggleTask: (id: string, guard: string) =>
    req<Task>(`/tasks/${id}/toggle?guard=${encodeURIComponent(guard)}`, { method: 'POST' }),
  deleteTask: (id: string) => req(`/tasks/${id}`, { method: 'DELETE' }),
  // Vehículos
  listVehicles: (naveId: string) => req<Vehicle[]>(`/naves/${naveId}/vehiculos`),
  createVehicle: (payload: { nave_id: string; tipo: string; matricula: string; zone: string; vandalizado?: boolean; vandalizado_detalle?: string; photo_path?: string; guard?: string; turno_id?: string }) =>
    req<Vehicle>('/vehiculos', { method: 'POST', body: JSON.stringify(payload) }),
  updateVehicle: (id: string, payload: Partial<{ tipo: string; matricula: string; zone: string; vandalizado: boolean; vandalizado_detalle?: string | null; photo_path?: string | null; guard?: string; turno_id?: string }>) =>
    req<Vehicle>(`/vehiculos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteVehicle: (id: string) => req(`/vehiculos/${id}`, { method: 'DELETE' }),
  reorderVehicles: (nave_id: string, zone: string, ids: string[]) =>
    req(`/vehiculos/reorder`, { method: 'POST', body: JSON.stringify({ nave_id, zone, ids }) }),
  // Cajetines de nave
  getNaveChecks: (naveId: string, turnoId: string) =>
    req<NaveCheck[]>(`/naves/${naveId}/checks?turno_id=${encodeURIComponent(turnoId)}`),
  toggleNaveCheck: (naveId: string, itemName: string, guard: string, turnoId: string) =>
    req<NaveCheck>(`/naves/${naveId}/checks/${encodeURIComponent(itemName)}/toggle?guard=${encodeURIComponent(guard)}&turno_id=${encodeURIComponent(turnoId)}`, { method: 'POST' }),
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
  exportPdfUrl: (opts?: { guard?: string; turnoId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.guard) params.append('guard', opts.guard);
    if (opts?.turnoId) params.append('turno_id', opts.turnoId);
    const qs = params.toString();
    return `${BASE}/api/export/pdf${qs ? `?${qs}` : ''}`;
  },
  exportExcelUrl: (opts?: { guard?: string; turnoId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.guard) params.append('guard', opts.guard);
    if (opts?.turnoId) params.append('turno_id', opts.turnoId);
    const qs = params.toString();
    return `${BASE}/api/export/excel${qs ? `?${qs}` : ''}`;
  },
};

// Session
const GUARD_KEY = 'cg.guard.name';
const TURNO_KEY = 'cg.turno.id';
const SERVICE_KEY = 'cg.service.name';
export const session = {
  async getGuard(): Promise<string | null> {
    return AsyncStorage.getItem(GUARD_KEY);
  },
  async setGuard(name: string) {
    await AsyncStorage.setItem(GUARD_KEY, name);
  },
  async getTurnoId(): Promise<string | null> {
    return AsyncStorage.getItem(TURNO_KEY);
  },
  async setTurnoId(id: string) {
    await AsyncStorage.setItem(TURNO_KEY, id);
  },
  async getServiceName(): Promise<string | null> {
    return AsyncStorage.getItem(SERVICE_KEY);
  },
  async setServiceName(name: string) {
    await AsyncStorage.setItem(SERVICE_KEY, name);
  },
  async clear() {
    await AsyncStorage.multiRemove([GUARD_KEY, TURNO_KEY, SERVICE_KEY]);
  },
};
