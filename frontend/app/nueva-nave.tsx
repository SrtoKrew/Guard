import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

export default function NuevaNave() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await api.createNave({ name: name.trim(), address: address.trim() || undefined, notes: notes.trim() || undefined });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.back();
    } catch (e: any) {
      setError('No se pudo guardar');
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
          <Text style={styles.title}>Nueva nave</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Nombre de la nave *" testID="nave-name-input" value={name} onChangeText={(v: string) => { setName(v); if (error) setError(''); }} placeholder="Ej. Nave A - Almacén Norte" />
          <Field label="Dirección" testID="nave-address-input" value={address} onChangeText={setAddress} placeholder="Calle, número, ciudad" />
          <Field label="Notas" testID="nave-notes-input" value={notes} onChangeText={setNotes} placeholder="Accesos, contactos, indicaciones..." multiline />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.cta}>
          <Pressable testID="save-nave-btn" style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
            <MaterialCommunityIcons name="check" size={22} color={theme.color.onBrand} />
            <Text style={styles.primaryBtnText}>GUARDAR NAVE</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, testID, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, multiline && { height: 100, textAlignVertical: 'top' }]}
        placeholderTextColor={theme.color.info}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', padding: theme.space.md, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { flex: 1, textAlign: 'center', color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
