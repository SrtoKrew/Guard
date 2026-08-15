import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, Turno, session } from '@/src/api';

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

export default function ResumenTurno() {
  const router = useRouter();
  const { turnoId } = useLocalSearchParams<{ turnoId: string }>();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!turnoId) return;
    try {
      const t = await api.getTurno(String(turnoId));
      setTurno(t);
    } catch (e) {
      console.log('resumen turno err', e);
    } finally {
      setLoading(false);
    }
  }, [turnoId]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => true; // block hardware back, force explicit exit
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [])
  );

  const openExport = async (kind: 'pdf' | 'excel') => {
    if (!turnoId) return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const url = kind === 'pdf' ? api.exportPdfUrl({ turnoId: String(turnoId) }) : api.exportExcelUrl({ turnoId: String(turnoId) });
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir', url);
    }
  };

  const volverAlInicio = async () => {
    await session.clear();
    router.replace('/');
  };

  if (loading || !turno) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.color.brand} size="large" />
      </SafeAreaView>
    );
  }

  const s = turno.summary;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 32 }}>
        <View style={styles.badgeWrap}>
          <MaterialCommunityIcons name="check-decagram" size={56} color={theme.color.success} />
        </View>
        <Text style={styles.title}>Turno finalizado</Text>
        <Text style={styles.subtitle}>{turno.guard} · {turno.service_name}</Text>

        <View style={styles.timeCard}>
          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>INICIO</Text>
            <Text style={styles.timeValue}>{formatDateTime(turno.start_time)}</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={20} color={theme.color.onSurfaceTertiary} />
          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>FIN</Text>
            <Text style={styles.timeValue}>{formatDateTime(turno.end_time)}</Text>
          </View>
        </View>
        <Text style={styles.duration}>Duración total: {formatDuration(s?.duracion_segundos)}</Text>

        <Text style={styles.sectionTitle}>Resumen del turno</Text>
        <View style={styles.grid}>
          <SummaryCard icon="alert-octagon" label="Incidencias" value={s?.incidencias ?? 0} color={theme.color.error} />
          <SummaryCard icon="phone-in-talk" label="Llamadas Centralita" value={s?.llamadas_centralita ?? 0} color={theme.color.onSurface} />
          <SummaryCard icon="location-enter" label="Entradas a Nave" value={s?.entradas_nave ?? 0} color={theme.color.success} />
          <SummaryCard icon="location-exit" label="Salidas de Nave" value={s?.salidas_nave ?? 0} color={theme.color.brand} />
          <SummaryCard icon="checkbox-marked-circle-outline" label="Chequeos" value={s?.chequeos ?? 0} color={theme.color.onSurface} />
          <SummaryCard icon="format-list-bulleted" label="Total Eventos" value={s?.total_eventos ?? 0} color={theme.color.onSurfaceSecondary} />
        </View>

        <Text style={styles.sectionTitle}>Exportar control del turno</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="resumen-export-excel" style={[styles.exportBtn, { backgroundColor: theme.color.success }]} onPress={() => openExport('excel')}>
            <MaterialCommunityIcons name="file-excel" size={20} color={theme.color.onSurface} />
            <Text style={styles.exportText}>EXCEL</Text>
          </Pressable>
          <Pressable testID="resumen-export-pdf" style={[styles.exportBtn, { backgroundColor: theme.color.brand }]} onPress={() => openExport('pdf')}>
            <MaterialCommunityIcons name="file-pdf-box" size={20} color={theme.color.onBrand} />
            <Text style={[styles.exportText, { color: theme.color.onBrand }]}>PDF</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="volver-inicio-btn" style={styles.primaryBtn} onPress={volverAlInicio}>
          <MaterialCommunityIcons name="home" size={20} color={theme.color.onBrand} />
          <Text style={styles.primaryBtnText}>VOLVER AL INICIO</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value, color }: any) {
  return (
    <View style={styles.card}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  badgeWrap: { alignItems: 'center', marginTop: theme.space.md },
  title: { color: theme.color.onSurface, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  timeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border,
    padding: theme.space.lg, marginTop: theme.space.xl,
  },
  timeCol: { alignItems: 'center', gap: 4 },
  timeLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, letterSpacing: 1 },
  timeValue: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700' },
  duration: { color: theme.color.brand, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  sectionTitle: {
    color: theme.color.onSurfaceTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5,
    marginTop: theme.space.xl, marginBottom: theme.space.sm, fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '31%', backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md,
    padding: 12, alignItems: 'center', gap: 4,
  },
  cardValue: { color: theme.color.onSurface, fontSize: 20, fontWeight: '800' },
  cardLabel: { color: theme.color.onSurfaceTertiary, fontSize: 10, textAlign: 'center' },
  exportBtn: {
    flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: theme.radius.md,
  },
  exportText: { color: theme.color.onSurface, fontWeight: '800', letterSpacing: 1, fontSize: 13 },
  footer: { padding: theme.space.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  primaryBtn: {
    backgroundColor: theme.color.brand, borderRadius: theme.radius.md,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { color: theme.color.onBrand, fontSize: 15, fontWeight: '800', letterSpacing: 1.4 },
});
