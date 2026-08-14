// Paleta de marca ASERGRUP — Seguridad Integral
export const theme = {
  color: {
    surface: '#0D1117',
    onSurface: '#F2F4F7',
    surfaceSecondary: '#161B22',
    onSurfaceSecondary: '#C7CBD1',
    surfaceTertiary: '#1F2630',
    onSurfaceTertiary: '#8A9099',
    surfaceInverse: '#F2F4F7',
    onSurfaceInverse: '#0D1117',
    brand: '#E53935',
    brandSecondary: '#C62828',
    brandTertiary: '#3A1517',
    onBrand: '#F2F4F7',
    success: '#43A047',
    warning: '#FFB300',
    error: '#E53935',
    onError: '#FFFFFF',
    info: '#5A606C',
    border: '#232B36',
    borderStrong: '#3A4250',
    divider: '#1A2029',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, pill: 999 },
  font: {
    display: 'System',
    text: 'System',
  },
} as const;

export const EVENT_LABELS: Record<string, string> = {
  entrada: 'Fichar Entrada',
  salida: 'Fichar Salida',
  ronda_inicio: 'Inicio Ronda',
  ronda_fin: 'Fin Ronda',
  tarea: 'Tarea',
  incidencia: 'Incidencia',
  descanso_inicio: 'Inicio Descanso',
  descanso_fin: 'Fin Descanso',
  entrada_nave: 'Entrada a Nave',
  salida_nave: 'Salida de Nave',
  llamada_centralita: 'Llamada Centralita',
  chequeo: 'Chequeo',
};

export const EVENT_ICONS: Record<string, string> = {
  entrada: 'login',
  salida: 'logout',
  ronda_inicio: 'walk',
  ronda_fin: 'flag-checkered',
  tarea: 'check-circle-outline',
  incidencia: 'alert-octagon',
  descanso_inicio: 'coffee',
  descanso_fin: 'coffee-off',
  entrada_nave: 'location-enter',
  salida_nave: 'location-exit',
  llamada_centralita: 'phone-in-talk',
  chequeo: 'checkbox-marked-circle-outline',
};

export const VEHICLE_TIPOS = ['Camión', 'Grúa', 'Grúa TO', 'Contenedor', 'Furgoneta', 'Otro'];

export function vehicleIcon(tipo: string): any {
  const m: Record<string, string> = {
    'Camión': 'truck',
    'Grúa': 'crane',
    'Grúa TO': 'crane',
    'Contenedor': 'archive-outline',
    'Furgoneta': 'van-utility',
    'Otro': 'car',
  };
  return m[tipo] || 'help-circle-outline';
}
