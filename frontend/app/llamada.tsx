import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme';
import { api, session } from '@/src/api';
import { useToast } from '@/src/toast';

export default function Llamada() {
  const router = useRouter();
  const toast = useToast();
  const [guard, setGuard] = useState('');
  const [turnoId, setTurnoId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setGuard((await session.getGuard()) || 'anon');
      setTurnoId(await session.getTurnoId());
    })();
  }, []);

  const send = async () => {
    setSaving(true);
    setError('');
    try {
      await api.createEvent({
        guard,
        type: 'llamada_centralita',
        note: note.trim() || undefined,
        turno_id: turnoId || undefined,
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      toast.show('Llamada registrada en el control', 'phone-in-talk');
      router.back();
    } catch (e) {
      setError('No se pudo registrar la llamada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable testID="close-modal" onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={24} color={theme.color.onSurface} />
          </Pressable>
          <Text style={styles.title}>Llamada Centralita</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="phone-in-talk" size={48} color={theme.color.onSurface} />
          </View>
          <Text style={styles.label}>Motivo / Detalle (opcional)</Text>
          <TextInput
            testID="llamada-note-input"
            style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
            placeholder="Ej. Aviso de ronda extra, incidencia comunicada..."
            placeholderTextColor={theme.color.info}
            value={note}
            onChangeText={setNote}
            multiline
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.cta}>
          <Pressable testID="save-llamada-btn" style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={send}>
            {saving ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <>
                <MaterialCommunityIcons name="check" size={22} color={theme.color.onBrand} />
                <Text style={styles.primaryBtnText}>REGISTRAR LLAMADA</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', padding: theme.space.md, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { flex: 1, textAlign: 'center', color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    alignSelf: 'center', width: 88, height: 88, borderRadius: 44,
    backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  label: { color: theme.color.onSurfaceTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    color: theme.color.onSurface, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  error: { color: theme.color.error, fontSize: 13 },
  cta: { padding: theme.space.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  primaryBtn: {
    backgroundColor: theme.color.brand, borderRadius: theme.radius.md,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { color: theme.color.onBrand, fontSize: 15, fontWeight: '800', letterSpacing: 1.4 },
});
