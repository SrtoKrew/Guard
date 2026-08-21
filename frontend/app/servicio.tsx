import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, session, TurnoOpcion } from '@/src/api';
import { getCurrentLocationSafe } from '@/src/location';

export default function ServicioScreen() {
  const router = useRouter();
  const [guard, setGuard] = useState('');
  const [services, setServices] = useState<{ name: string }[]>([]);
  const [opciones, setOpciones] = useState<TurnoOpcion[]>([]);
  const [step, setStep] = useState<'servicio' | 'turno'>('servicio');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const g = await session.getGuard();
      if (!g) {
        router.replace('/');
        return;
      }
      setGuard(g);
      try {
        const [list, ops] = await Promise.all([api.listServices(), api.turnoOpciones()]);
        setServices(list);
        setOpciones(ops);
      } catch (e) {
        setError('No se pudo cargar la lista de servicios');
      }
    })();
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (step === 'turno') {
          setStep('servicio');
          return true;
        }
        router.replace('/');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router, step])
  );

  const chooseService = (name: string) => {
    setSelectedService(name);
    setStep('turno');
  };

  const selectTurno = async (opcion: TurnoOpcion) => {
    if (!selectedService) return;
    setLoadingKey(opcion.tipo);
    setError('');
    try {
      const { lat, lng } = await getCurrentLocationSafe();
      const turno = await api.startTurno(guard, selectedService, opcion.tipo, lat, lng);
      await session.setTurnoId(turno.id);
      await session.setServiceName(selectedService);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.replace('/(tabs)/panel');
    } catch (e) {
      setError('No se pudo iniciar el turno. Inténtalo de nuevo.');
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          testID="back-btn"
          onPress={() => (step === 'turno' ? setStep('servicio') : router.replace('/'))}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>{step === 'servicio' ? 'Elige tu servicio' : 'Elige tu turno'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.hello}>Vigilante</Text>
        <Text style={styles.guardName}>{guard || '—'}</Text>

        {step === 'servicio' ? (
          <>
            <Text style={styles.hint}>Selecciona el servicio para continuar</Text>
            <View style={{ marginTop: theme.space.xl, gap: 12 }}>
              {services.map((s) => (
                <Pressable
                  key={s.name}
                  testID={`service-${s.name}`}
                  onPress={() => chooseService(s.name)}
                  style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.optionIcon}>
                    <MaterialCommunityIcons name="office-building-marker" size={26} color={theme.color.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{s.name}</Text>
                    <Text style={styles.optionSub}>Tocar para elegir turno</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={theme.color.onSurfaceTertiary} />
                </Pressable>
              ))}
              {services.length === 0 && !error && <ActivityIndicator color={theme.color.brand} />}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hint}>{selectedService} · Selecciona el turno de hoy</Text>
            <View style={{ marginTop: theme.space.xl, gap: 12 }}>
              {opciones.map((op) => (
                <Pressable
                  key={op.tipo}
                  testID={`turno-${op.tipo}`}
                  onPress={() => selectTurno(op)}
                  disabled={!!loadingKey}
                  style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.optionIcon}>
                    <MaterialCommunityIcons
                      name={op.tipo === 'dia' ? 'weather-sunny' : 'weather-night'}
                      size={26}
                      color={theme.color.brand}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{op.label}</Text>
                    <Text style={styles.optionSub}>{op.horario}</Text>
                  </View>
                  {loadingKey === op.tipo ? (
                    <ActivityIndicator color={theme.color.brand} />
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.color.onSurfaceTertiary} />
                  )}
                </Pressable>
              ))}
              {opciones.length === 0 && !error && <ActivityIndicator color={theme.color.brand} />}
            </View>
            <Text style={styles.autoNote}>
              El turno se cerrará automáticamente al finalizar su horario si no lo finalizas antes.
            </Text>
          </>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', padding: theme.space.md },
  title: { flex: 1, textAlign: 'center', color: theme.color.onSurface, fontSize: 17, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg },
  hello: { color: theme.color.onSurfaceTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  guardName: { color: theme.color.onSurface, fontSize: 26, fontWeight: '800', marginTop: 2 },
  hint: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 8 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.color.brandTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  optionName: { color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  optionSub: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  autoNote: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: theme.space.lg, textAlign: 'center' },
  error: { color: theme.color.error, marginTop: 16, fontSize: 13, textAlign: 'center' },
});
