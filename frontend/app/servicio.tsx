import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, session } from '@/src/api';

export default function ServicioScreen() {
  const router = useRouter();
  const [guard, setGuard] = useState('');
  const [services, setServices] = useState<{ name: string }[]>([]);
  const [loadingName, setLoadingName] = useState<string | null>(null);
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
        const list = await api.listServices();
        setServices(list);
      } catch (e) {
        setError('No se pudo cargar la lista de servicios');
      }
    })();
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const selectService = async (name: string) => {
    setLoadingName(name);
    setError('');
    try {
      const turno = await api.startTurno(guard, name);
      await session.setTurnoId(turno.id);
      await session.setServiceName(name);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.replace('/(tabs)/panel');
    } catch (e) {
      setError('No se pudo iniciar el turno. Inténtalo de nuevo.');
    } finally {
      setLoadingName(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="back-to-name" onPress={() => router.replace('/')} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Elige tu servicio</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.hello}>Vigilante</Text>
        <Text style={styles.guardName}>{guard || '—'}</Text>
        <Text style={styles.hint}>Selecciona el servicio para iniciar tu turno automáticamente</Text>

        <View style={{ marginTop: theme.space.xl, gap: 12 }}>
          {services.map((s) => (
            <Pressable
              key={s.name}
              testID={`service-${s.name}`}
              onPress={() => selectService(s.name)}
              disabled={!!loadingName}
              style={({ pressed }) => [styles.serviceCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.serviceIcon}>
                <MaterialCommunityIcons name="office-building-marker" size={26} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{s.name}</Text>
                <Text style={styles.serviceSub}>Tocar para iniciar turno</Text>
              </View>
              {loadingName === s.name ? (
                <ActivityIndicator color={theme.color.brand} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.color.onSurfaceTertiary} />
              )}
            </Pressable>
          ))}
          {services.length === 0 && !error && <ActivityIndicator color={theme.color.brand} />}
        </View>
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
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
  },
  serviceIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.color.brandTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceName: { color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  serviceSub: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  error: { color: theme.color.error, marginTop: 16, fontSize: 13, textAlign: 'center' },
});
