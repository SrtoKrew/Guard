export const theme = {
  color: {
    surface: '#121212',
    onSurface: '#F5F5F5',
    surfaceSecondary: '#1E1E1E',
    onSurfaceSecondary: '#E0E0E0',
    surfaceTertiary: '#2C2C2C',
    onSurfaceTertiary: '#BDBDBD',
    surfaceInverse: '#F5F5F5',
    onSurfaceInverse: '#121212',
    brand: '#FF9800',
    brandSecondary: '#F57C00',
    brandTertiary: '#4A3219',
    onBrand: '#121212',
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    onError: '#FFFFFF',
    info: '#9E9E9E',
    border: '#333333',
    borderStrong: '#555555',
    divider: '#2A2A2A',
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
};
