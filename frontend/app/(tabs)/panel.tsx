import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, session, Event } from '@/src/api';

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

export default function PanelScreen() {
  const router = useRouter();
  const now = useNow();
  const [guard, setGuard] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const g = (await session.getGuard()) || '';
    setGuard(g);
    if (!g) {
      router.replace('/');
      return;
    }
    try {
      const list = await api.listEvents(g);
      setEvents(list);
    } catch (e) {
      console.log('load events err', e);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const lastEntrada = events.find(e => e.type === 'entrada');
  const lastSalida = events.find(e => e.type === 'salida');
  const enTurno = lastEntrada && (!lastSalida || new Date(lastEntrada.timestamp) > new Date(lastSalida.timestamp));

  const lastRondaInicio = events.find(e => e.type === 'ronda_inicio');
  const lastRondaFin = events.find(e => e.type === 'ronda_fin');
  const enRonda = lastRondaInicio && (!lastRondaFin || new Date(lastRondaInicio.timestamp) > new Date(lastRondaFin.timestamp));

  const registerEvent = async (type: string) => {
    try {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
      await api.createEvent({ guard, type });
      await load();
    } catch (e) {
      console.log('register err', e);
    }
  };

  const changeGuard = async () => {
    await session.clear();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Guardia</Text>
            <Text style={styles.guardName} testID="guard-name-label">{guard || '—'}</Text>
          </View>
          <Pressable testID="change-guard-btn" onPress={changeGuard} style={styles.changeBtn}>
            <MaterialCommunityIcons name="account-switch" size={22} color={theme.color.onSurfaceTertiary} />
          </Pressable>
        </View>

        <View style={styles.clockCard}>
          <LinearGradient
            colors={[theme.color.brandTertiary + 'CC', theme.color.surface]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.clockDate}>{formatDate(now)}</Text>
          <Text style={styles.clock} testID="realtime-clock">{formatTime(now)}</Text>
          <View style={[styles.statusPill, enTurno ? styles.statusOn : styles.statusOff]}>
            <View style={[styles.statusDot, enTurno ? { backgroundColor: theme.color.success } : { backgroundColor: theme.color.info }]} />
            <Text style={styles.statusText}>{enTurno ? 'EN TURNO' : 'FUERA DE TURNO'}</Text>
          </View>
        </View>

        <View style={styles.ficharRow}>
          <Pressable
            testID="fichar-entrada-btn"
            style={[styles.ficharBtn, { backgroundColor: theme.color.success }, enTurno && { opacity: 0.4 }]}
            disabled={!!enTurno}
            onPress={() => registerEvent('entrada')}
          >
            <MaterialCommunityIcons name="login" size={26} color={theme.color.onSurface} />
            <Text style={styles.ficharText}>FICHAR ENTRADA</Text>
          </Pressable>
          <Pressable
            testID="fichar-salida-btn"
            style={[styles.ficharBtn, { backgroundColor: theme.color.error }, !enTurno && { opacity: 0.4 }]}
            disabled={!enTurno}
            onPress={() => registerEvent('salida')}
          >
            <MaterialCommunityIcons name="logout" size={26} color={theme.color.onSurface} />
            <Text style={styles.ficharText}>FICHAR SALIDA</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.grid}>
          <QuickAction
            icon={enRonda ? 'flag-checkered' : 'walk'}
            label={enRonda ? 'FIN RONDA' : 'INICIAR RONDA'}
            testID="ronda-btn"
            color={enRonda ? theme.color.warning : theme.color.brand}
            onPress={() => registerEvent(enRonda ? 'ronda_fin' : 'ronda_inicio')}
          />
          <QuickAction
            icon="alert-octagon"
            label="INCIDENCIA"
            testID="incidencia-btn"
            color={theme.color.error}
            onPress={() => router.push('/incidencia')}
          />
          <QuickAction
            icon="coffee"
            label="DESCANSO"
            testID="descanso-btn"
            color={theme.color.info}
            onPress={() => registerEvent('descanso_inicio')}
          />
          <QuickAction
            icon="coffee-off"
            label="FIN DESCANSO"
            testID="fin-descanso-btn"
            color={theme.color.info}
            onPress={() => registerEvent('descanso_fin')}
          />
        </View>

        <Text style={styles.sectionTitle}>Últimos registros</Text>
        <View style={{ paddingHorizontal: theme.space.lg, gap: 8 }}>
          {events.slice(0, 5).length === 0 && (
            <Text style={styles.empty}>Sin registros aún. Ficha tu entrada para comenzar.</Text>
          )}
          {events.slice(0, 5).map(ev => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={styles.eventIcon}>
                <MaterialCommunityIcons name={eventIcon(ev.type)} size={18} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{eventLabel(ev.type)}</Text>
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

function eventLabel(t: string) {
  const m: Record<string, string> = {
    entrada: 'Entrada', salida: 'Salida',
    ronda_inicio: 'Inicio de ronda', ronda_fin: 'Fin de ronda',
    tarea: 'Tarea', incidencia: 'Incidencia',
    descanso_inicio: 'Inicio descanso', descanso_fin: 'Fin descanso',
  };
  return m[t] || t;
}
function eventIcon(t: string): any {
  const m: Record<string, string> = {
    entrada: 'login', salida: 'logout',
    ronda_inicio: 'walk', ronda_fin: 'flag-checkered',
    tarea: 'check-circle-outline', incidencia: 'alert-octagon',
    descanso_inicio: 'coffee', descanso_fin: 'coffee-off',
  };
  return m[t] || 'circle-outline';
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
  changeBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
  },
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
  statusOn: { borderColor: theme.color.success, backgroundColor: '#4CAF5033' },
  statusOff: { borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: theme.color.onSurface, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  ficharRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: theme.space.lg,
    marginTop: theme.space.lg,
  },
  ficharBtn: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  ficharText: {
    color: theme.color.onSurface, fontWeight: '800',
    letterSpacing: 1, fontSize: 12,
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
