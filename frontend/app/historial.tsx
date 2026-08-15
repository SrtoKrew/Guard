import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, Turno } from '@/src/api';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid',
  });
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

export default function HistorialScreen() {
  const router = useRouter();
  const { guard } = useLocalSearchParams<{ guard?: string }>();
  const guardName = String(guard || '');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!guardName) {
      setLoading(false);
      return;
    }
    try {
      const list = await api.listTurnos(guardName);
      setTurnos(list.filter((t) => t.status === 'finalizado'));
    } catch (e) {
      console.log('historial err', e);
    } finally {
      setLoading(false);
    }
  }, [guardName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openExport = async (turno: Turno, kind: 'pdf' | 'excel') => {
    setExportingId(turno.id + kind);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const url = kind === 'pdf'
      ? api.exportPdfUrl({ turnoId: turno.id })
      : api.exportExcelUrl({ turnoId: turno.id });
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir', url);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="historial-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Historial de Turnos</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.subtitle}>{guardName || '—'}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.brand} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
        >
          {turnos.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="history" size={64} color={theme.color.onSurfaceTertiary} />
              <Text style={styles.emptyText}>Sin turnos finalizados</Text>
              <Text style={styles.emptySubtext}>Aquí aparecerán tus turnos anteriores una vez finalizados.</Text>
            </View>
          ) : (
            turnos.map((t) => (
              <View key={t.id} style={styles.card} testID={`historial-item-${t.id}`}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <MaterialCommunityIcons
                      name={t.turno_tipo === 'dia' ? 'weather-sunny' : 'weather-night'}
                      size={20} color={theme.color.brand}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDate}>{formatDate(t.start_time)}</Text>
                    <Text style={styles.cardSub}>
                      {t.service_name} · {t.turno_tipo === 'dia' ? 'Turno de Día' : 'Turno Nocturno'}
                    </Text>
                  </View>
                  {t.auto_finalizado && (
                    <View style={styles.autoBadge}>
                      <Text style={styles.autoBadgeText}>AUTO</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardTimes}>
                  <Text style={styles.cardTimeText}>
                    {formatTime(t.start_time)} → {formatTime(t.end_time)}
                  </Text>
                  <Text style={styles.cardDuration}>{formatDuration(t.summary?.duracion_segundos)}</Text>
                </View>

                <View style={styles.cardStats}>
                  <StatChip icon="alert-octagon" value={t.summary?.incidencias ?? 0} label="Incid." />
                  <StatChip icon="phone-in-talk" value={t.summary?.llamadas_centralita ?? 0} label="Llam." />
                  <StatChip icon="format-list-bulleted" value={t.summary?.total_eventos ?? 0} label="Eventos" />
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    testID={`historial-export-excel-${t.id}`}
                    style={[styles.exportBtn, { backgroundColor: theme.color.success + '22', borderColor: theme.color.success }]}
                    onPress={() => openExport(t, 'excel')}
                    disabled={exportingId === t.id + 'excel'}
                  >
                    {exportingId === t.id + 'excel' ? (
                      <ActivityIndicator size="small" color={theme.color.success} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="file-excel" size={16} color={theme.color.success} />
                        <Text style={[styles.exportBtnText, { color: theme.color.success }]}>EXCEL</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    testID={`historial-export-pdf-${t.id}`}
                    style={[styles.exportBtn, { backgroundColor: theme.color.brand + '22', borderColor: theme.color.brand }]}
                    onPress={() => openExport(t, 'pdf')}
                    disabled={exportingId === t.id + 'pdf'}
                  >
                    {exportingId === t.id + 'pdf' ? (
                      <ActivityIndicator size="small" color={theme.color.brand} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="file-pdf-box" size={16} color={theme.color.brand} />
                        <Text style={[styles.exportBtnText, { color: theme.color.brand }]}>PDF</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatChip({ icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <View style={styles.statChip}>
      <MaterialCommunityIcons name={icon} size={14} color={theme.color.onSurfaceTertiary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', padding: theme.space.md },
  title: { flex: 1, textAlign: 'center', color: theme.color.onSurface, fontSize: 17, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  subtitle: {
    color: theme.color.onSurfaceTertiary, fontSize: 13, textAlign: 'center',
    marginBottom: theme.space.sm, fontWeight: '600',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: theme.color.onSurfaceTertiary, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  card: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    marginBottom: 12,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.color.brandTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  cardDate: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  cardSub: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  autoBadge: {
    backgroundColor: theme.color.info + '33', borderRadius: theme.radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  autoBadgeText: { color: theme.color.info, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cardTimes: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: theme.color.border, paddingTop: 10,
  },
  cardTimeText: { color: theme.color.onSurfaceSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cardDuration: { color: theme.color.brand, fontSize: 13, fontWeight: '800' },

  cardStats: { flexDirection: 'row', gap: 8 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.color.surface, borderRadius: theme.radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.color.border,
  },
  statValue: { color: theme.color.onSurface, fontSize: 12, fontWeight: '800' },
  statLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11 },

  cardActions: { flexDirection: 'row', gap: 8 },
  exportBtn: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: theme.radius.md, borderWidth: 1,
  },
  exportBtnText: { fontWeight: '800', letterSpacing: 0.5, fontSize: 12 },
});
