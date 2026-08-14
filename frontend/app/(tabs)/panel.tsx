import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme, EVENT_LABELS, EVENT_ICONS } from '@/src/theme';
import { api, session, Event, Turno } from '@/src/api';

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatTime(d: Date) {
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatElapsed(startIso?: string, now?: Date) {
  if (!startIso || !now) return '—';
  const secs = Math.max(0, Math.floor((now.getTime() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

export default function PanelScreen() {
  const router = useRouter();
  const now = useNow();
  const [guard, setGuard] = useState('');
  const [turno, setTurno] = useState<Turno | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const load = useCallback(async () => {
    const g = (await session.getGuard()) || '';
    const turnoId = await session.getTurnoId();
    setGuard(g);
    if (!g) {
      router.replace('/');
      return;
    }
    if (!turnoId) {
      router.replace('/servicio');
      return;
    }
    try {
      const [t, list] = await Promise.all([
        api.getActiveTurno(g),
        api.listEvents(g, turnoId),
      ]);
      if (!t || t.status !== 'activo') {
        await session.clear();
        router.replace('/');
        return;
      }
      setTurno(t);
      setEvents(list);
    } catch (e) {
      console.log('load panel err', e);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const registerEvent = async (type: string) => {
    try {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
      await api.createEvent({ guard, type, turno_id: turno?.id });
      await load();
    } catch (e) {
      console.log('register err', e);
    }
  };

  const confirmFinalizar = () => {
    Alert.alert(
      'Finalizar turno',
      'Se generará un resumen del turno con incidencias, llamadas y accesos, y podrás exportarlo. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: doFinalizar },
      ]
    );
  };

  const doFinalizar = async () => {
    if (!turno) return;
    setFinalizando(true);
    try {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
      await api.finalizarTurno(turno.id);
      router.replace({ pathname: '/resumen-turno', params: { turnoId: turno.id } });
    } catch (e) {
      console.log('finalizar err', e);
      Alert.alert('Error', 'No se pudo finalizar el turno. Inténtalo de nuevo.');
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Vigilante</Text>
            <Text style={styles.guardName} testID="guard-name-label">{guard || '—'}</Text>
            {!!turno && <Text style={styles.serviceName}>{turno.service_name}</Text>}
          </View>
        </View>

        <View style={styles.clockCard}>
          <LinearGradient
            colors={[theme.color.brandTertiary + 'CC', theme.color.surface]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.clockDate}>{formatDate(now)}</Text>
          <Text style={styles.clock} testID="realtime-clock">{formatTime(now)}</Text>
          <View style={[styles.statusPill, styles.statusOn]}>
            <View style={[styles.statusDot, { backgroundColor: theme.color.success }]} />
            <Text style={styles.statusText}>TURNO EN CURSO · {formatElapsed(turno?.start_time, now)}</Text>
          </View>
        </View>

        <View style={styles.finalizarWrap}>
          <Pressable
            testID="finalizar-turno-btn"
            style={({ pressed }) => [styles.finalizarBtn, pressed && { opacity: 0.85 }]}
            onPress={confirmFinalizar}
            disabled={finalizando}
          >
            {finalizando ? (
              <ActivityIndicator color={theme.color.onBrand} />
            ) : (
              <>
                <MaterialCommunityIcons name="flag-checkered" size={24} color={theme.color.onBrand} />
                <Text style={styles.finalizarText}>FINALIZAR TURNO</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.grid}>
          <QuickAction
            icon="alert-octagon"
            label="INCIDENCIA"
            testID="incidencia-btn"
            color={theme.color.brand}
            onPress={() => router.push('/incidencia')}
          />
          <QuickAction
            icon="phone-in-talk"
            label="LLAMADA CENTRALITA"
            testID="llamada-btn"
            color={theme.color.onSurface}
            onPress={() => router.push('/llamada')}
          />
          <QuickAction
            icon="coffee"
            label="DESCANSO"
            testID="descanso-btn"
            color={theme.color.onSurface}
            onPress={() => registerEvent('descanso_inicio')}
          />
          <QuickAction
            icon="coffee-off"
            label="FIN DESCANSO"
            testID="fin-descanso-btn"
            color={theme.color.onSurface}
            onPress={() => registerEvent('descanso_fin')}
          />
        </View>

        <Text style={styles.sectionTitle}>Últimos registros</Text>
        <View style={{ paddingHorizontal: theme.space.lg, gap: 8 }}>
          {events.slice(0, 5).length === 0 && (
            <Text style={styles.empty}>Sin registros aún en este turno.</Text>
          )}
          {events.slice(0, 5).map(ev => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={styles.eventIcon}>
                <MaterialCommunityIcons name={(EVENT_ICONS[ev.type] || 'circle-outline') as any} size={18} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{EVENT_LABELS[ev.type] || ev.type}</Text>
                {!!ev.note && <Text style={styles.eventNote} numberOfLines={1}>{ev.note}</Text>}
              </View>
              <Text style={styles.eventTime}>{new Date(ev.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, color, testID, onPress }: any) {
  return (
    <Pressable testID={testID} style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={26} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md,
  },
  hello: { color: theme.color.onSurfaceTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  guardName: { color: theme.color.onSurface, fontSize: 22, fontWeight: '700' },
  serviceName: { color: theme.color.brand, fontSize: 13, fontWeight: '700', marginTop: 2 },
  clockCard: {
    marginHorizontal: theme.space.lg,
    padding: theme.space.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  clockDate: {
    color: theme.color.onSurfaceTertiary,
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5,
    marginBottom: 8,
  },
  clock: {
    color: theme.color.brand,
    fontSize: 64, fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    marginTop: 12,
  },
  statusOn: { borderColor: theme.color.success, backgroundColor: '#43A04733' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: theme.color.onSurface, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  finalizarWrap: {
    paddingHorizontal: theme.space.lg,
    marginTop: theme.space.lg,
  },
  finalizarBtn: {
    backgroundColor: theme.color.brand,
    borderRadius: theme.radius.md,
    paddingVertical: 20,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 10,
  },
  finalizarText: {
    color: theme.color.onBrand, fontWeight: '800',
    letterSpacing: 1.4, fontSize: 15,
  },

  sectionTitle: {
    color: theme.color.onSurfaceTertiary,
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5,
    paddingHorizontal: theme.space.lg, marginTop: theme.space.xl, marginBottom: theme.space.sm,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: theme.space.lg,
    gap: 8,
  },
  actionCard: {
    width: '48.5%',
    padding: theme.space.lg,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    alignItems: 'flex-start',
    gap: 6,
  },
  actionLabel: { fontWeight: '700', fontSize: 12, letterSpacing: 1 },

  empty: { color: theme.color.onSurfaceTertiary, fontSize: 13, paddingVertical: 8 },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.md, padding: 12,
    borderWidth: 1, borderColor: theme.color.border,
  },
  eventIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.brandTertiary,
  },
  eventTitle: { color: theme.color.onSurface, fontWeight: '600', fontSize: 14 },
  eventNote: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  eventTime: { color: theme.color.brand, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
