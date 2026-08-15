import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { session } from '@/src/api';
import { theme } from '@/src/theme';

export default function IndexScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const g = await session.getGuard();
      const turnoId = await session.getTurnoId();
      if (g && turnoId) {
        router.replace('/(tabs)/panel');
      } else if (g) {
        router.replace('/servicio');
      }
    })();
  }, [router]);

  const onStart = async () => {
    const clean = name.trim();
    if (!clean) {
      setError('Introduce tu nombre para continuar');
      return;
    }
    await session.setGuard(clean);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    router.replace('/servicio');
  };

  const onViewHistory = async () => {
    const clean = name.trim();
    if (!clean) {
      setError('Introduce tu nombre para ver tu historial');
      return;
    }
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    router.push({ pathname: '/historial', params: { guard: clean } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            <View style={styles.hero}>
              <LinearGradient
                colors={[theme.color.brandTertiary, theme.color.surface]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroBg}
              />
              <View style={styles.logo}>
                <Image source={require('@/assets/images/logo-mark.png')} style={styles.logoImg} resizeMode="contain" />
              </View>
              <Text style={styles.appName}>
                <Text style={{ color: theme.color.brand }}>ASER</Text>
                <Text style={{ color: theme.color.onSurface }}>GRUP</Text>
              </Text>
              <Text style={styles.appSubtitle}>Control Diario · Seguridad Integral</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Nombre del vigilante</Text>
              <TextInput
                testID="guard-name-input"
                style={styles.input}
                placeholder="Ej. Juan Pérez"
                placeholderTextColor={theme.color.info}
                value={name}
                onChangeText={(t) => { setName(t); if (error) setError(''); }}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={onStart}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
            </View>

            <View style={styles.cta}>
              <Pressable
                testID="start-shift-button"
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={onStart}
              >
                <Text style={styles.primaryBtnText}>CONTINUAR</Text>
                <MaterialCommunityIcons name="arrow-right" size={22} color={theme.color.onBrand} />
              </Pressable>
              <Pressable
                testID="view-history-button"
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
                onPress={onViewHistory}
              >
                <MaterialCommunityIcons name="history" size={18} color={theme.color.onSurfaceSecondary} />
                <Text style={styles.secondaryBtnText}>Ver historial de turnos</Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  container: { flex: 1, justifyContent: 'space-between' },
  hero: {
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroBg: { ...StyleSheet.absoluteFillObject },
  logo: {
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: theme.color.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.color.border,
    marginBottom: 16,
    padding: 18,
  },
  logoImg: { width: '100%', height: '100%' },
  appName: {
    fontSize: 28, fontWeight: '800', color: theme.color.onSurface,
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 13, color: theme.color.onSurfaceTertiary,
    marginTop: 4, letterSpacing: 1, textTransform: 'uppercase',
  },
  form: {
    paddingHorizontal: theme.space.xl,
  },
  label: {
    fontSize: 12, color: theme.color.onSurfaceTertiary,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  input: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    color: theme.color.onSurface,
    fontSize: 18, paddingHorizontal: 16, paddingVertical: 14,
  },
  error: { color: theme.color.error, marginTop: 8, fontSize: 13 },
  cta: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.md,
    paddingTop: theme.space.md,
  },
  primaryBtn: {
    backgroundColor: theme.color.brand,
    borderRadius: theme.radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: theme.color.onBrand, fontSize: 16, fontWeight: '800',
    letterSpacing: 1.4,
  },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  secondaryBtnText: {
    color: theme.color.onSurfaceSecondary, fontSize: 13, fontWeight: '600',
  },
});
