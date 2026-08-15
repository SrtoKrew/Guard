import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, Alert, Linking, Platform, Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, Event, session } from '@/src/api';

const EVENT_LABEL: Record<string, string> = {
  entrada: 'Entrada', salida: 'Salida',
  ronda_inicio: 'Inicio de ronda', ronda_fin: 'Fin de ronda',
  tarea: 'Tarea completada', incidencia: 'Incidencia',
  descanso_inicio: 'Inicio descanso', descanso_fin: 'Fin descanso',
  entrada_nave: 'Entrada a Nave', salida_nave: 'Salida de Nave',
  llamada_centralita: 'Llamada Centralita', chequeo: 'Chequeo',
  accion_nave: 'Acción de Nave',
  vehiculo_vandalizado: 'Vehículo Vandalizado', vehiculo_reparado: 'Vehículo Reparado / Sin Daños',
};
const EVENT_ICON: Record<string, string> = {
  entrada: 'login', salida: 'logout',
  ronda_inicio: 'walk', ronda_fin: 'flag-checkered',
  tarea: 'check-circle-outline', incidencia: 'alert-octagon',
  descanso_inicio: 'coffee', descanso_fin: 'coffee-off',
  entrada_nave: 'location-enter', salida_nave: 'location-exit',
  llamada_centralita: 'phone-in-talk', chequeo: 'checkbox-marked-circle-outline',
  accion_nave: 'clipboard-check-outline',
  vehiculo_vandalizado: 'car-wrench', vehiculo_reparado: 'car-outline',
};
const EVENT_COLOR: Record<string, string> = {
  entrada: theme.color.success, salida: theme.color.error,
  ronda_inicio: theme.color.brand, ronda_fin: theme.color.warning,
  tarea: theme.color.success, incidencia: theme.color.error,
  descanso_inicio: theme.color.onSurface, descanso_fin: theme.color.onSurface,
  entrada_nave: theme.color.success, salida_nave: theme.color.brand,
  llamada_centralita: theme.color.onSurface, chequeo: theme.color.onSurface,
  accion_nave: theme.color.onSurface,
  vehiculo_vandalizado: theme.color.error, vehiculo_reparado: theme.color.success,
};

export default function ControlScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [guard, setGuard] = useState('');
  const [turnoId, setTurnoId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    const g = (await session.getGuard()) || '';
    const t = (await session.getTurnoId()) || undefined;
    setGuard(g);
    setTurnoId(t);
    try {
      const list = await api.listEvents(g, t);
      setEvents(list);
    } catch (e) {
      console.log('events err', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = events;

  const openExport = async (kind: 'pdf' | 'excel') => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const url = kind === 'pdf' ? api.exportPdfUrl({ guard, turnoId }) : api.exportExcelUrl({ guard, turnoId });
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir', url);
    }
  };

  const onDelete = (ev: Event) => {
    Alert.alert('Eliminar registro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await api.deleteEvent(ev.id); load(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Control horario</Text>
        <Text style={styles.subtitle}>{filtered.length} registros de este turno</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: theme.space.lg, paddingBottom: 160, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.color.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clock-outline" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>Sin registros</Text>
            <Text style={styles.emptySubtext}>Los eventos del turno aparecerán aquí</Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.timestamp);
          const color = EVENT_COLOR[item.type] || theme.color.brand;
          return (
            <Pressable
              testID={`event-${item.id}`}
              onLongPress={() => onDelete(item)}
              style={styles.eventCard}
            >
              <View style={styles.timeCol}>
                <Text style={styles.time}>{d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}</Text>
                <Text style={styles.date}>{d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid' })}</Text>
              </View>
              <View style={[styles.iconCol, { borderLeftColor: color }]}>
                <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color }]}>
                  <MaterialCommunityIcons name={(EVENT_ICON[item.type] || 'circle') as any} size={18} color={color} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>
                  {item.type === 'accion_nave' && item.note ? item.note : (EVENT_LABEL[item.type] || item.type)}
                </Text>
                {!!item.nave_name && <Text style={styles.eventNave}>{item.nave_name}</Text>}
                {!!item.note && item.type !== 'accion_nave' && <Text style={styles.eventNote} numberOfLines={2}>{item.note}</Text>}
                {!!item.photo_path && (
                  <RNImage source={{ uri: api.fileUrl(item.photo_path) }} style={styles.eventThumb} />
                )}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.exportBar}>
        <Pressable testID="export-excel-btn" style={[styles.exportBtn, { backgroundColor: theme.color.success }]} onPress={() => openExport('excel')}>
          <MaterialCommunityIcons name="file-excel" size={20} color={theme.color.onSurface} />
          <Text style={styles.exportText}>EXPORTAR EXCEL</Text>
        </Pressable>
        <Pressable testID="export-pdf-btn" style={[styles.exportBtn, { backgroundColor: theme.color.error }]} onPress={() => openExport('pdf')}>
          <MaterialCommunityIcons name="file-pdf-box" size={20} color={theme.color.onSurface} />
          <Text style={styles.exportText}>EXPORTAR PDF</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, paddingBottom: theme.space.sm },
  title: { color: theme.color.onSurface, fontSize: 28, fontWeight: '800' },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  chipRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm,
  },
  chip: {
    height: 36, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
  },
  chipActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brandTertiary },
  chipText: { color: theme.color.onSurfaceTertiary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: theme.color.brand },

  eventCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1, borderColor: theme.color.border,
    gap: 12,
  },
  timeCol: { width: 60 },
  time: { color: theme.color.onSurface, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
  date: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  iconCol: {
    borderLeftWidth: 2, paddingLeft: 12, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  eventTitle: { color: theme.color.onSurface, fontWeight: '600', fontSize: 15 },
  eventNave: { color: theme.color.brand, fontSize: 12, marginTop: 2, fontWeight: '600' },
  eventNote: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  eventThumb: { width: 96, height: 72, borderRadius: theme.radius.sm, marginTop: 6, backgroundColor: theme.color.surfaceTertiary },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: theme.color.onSurfaceTertiary, fontSize: 13 },

  exportBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 8,
    padding: theme.space.md,
    paddingBottom: Platform.OS === 'ios' ? 20 : theme.space.md,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1, borderTopColor: theme.color.border,
  },
  exportBtn: {
    flex: 1, height: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: theme.radius.md,
  },
  exportText: { color: theme.color.onSurface, fontWeight: '800', letterSpacing: 1, fontSize: 12 },
});
