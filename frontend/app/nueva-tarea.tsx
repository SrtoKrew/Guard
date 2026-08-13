import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme';
import { api, Nave } from '@/src/api';

export default function NuevaTarea() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [naves, setNaves] = useState<Nave[]>([]);
  const [selectedNave, setSelectedNave] = useState<Nave | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setNaves(await api.listNaves()); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        nave_id: selectedNave?.id,
        nave_name: selectedNave?.name,
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.back();
    } catch {
      setError('No se pudo guardar');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable testID="close-modal" onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={24} color={theme.color.onSurface} />
          </Pressable>
          <Text style={styles.title}>Nueva tarea</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              testID="task-title-input"
              style={styles.input}
              placeholder="Ej. Revisar puerta trasera"
              placeholderTextColor={theme.color.info}
              value={title}
              onChangeText={(v) => { setTitle(v); if (error) setError(''); }}
            />
          </View>

          <View>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              testID="task-desc-input"
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Detalles adicionales..."
              placeholderTextColor={theme.color.info}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View>
            <Text style={styles.label}>Nave (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
              <Pressable
                onPress={() => setSelectedNave(null)}
                style={[styles.chip, !selectedNave && styles.chipActive]}
              >
                <Text style={[styles.chipText, !selectedNave && styles.chipTextActive]}>Sin nave</Text>
              </Pressable>
              {naves.map(n => (
                <Pressable
                  key={n.id}
                  testID={`select-nave-${n.id}`}
                  onPress={() => setSelectedNave(n)}
                  style={[styles.chip, selectedNave?.id === n.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedNave?.id === n.id && styles.chipTextActive]}>{n.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.cta}>
          <Pressable testID="save-task-btn" style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
            <MaterialCommunityIcons name="check" size={22} color={theme.color.onBrand} />
            <Text style={styles.primaryBtnText}>GUARDAR TAREA</Text>
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
  label: { color: theme.color.onSurfaceTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    color: theme.color.onSurface, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    flexShrink: 0,
  },
  chipActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brandTertiary },
  chipText: { color: theme.color.onSurfaceTertiary, fontWeight: '600' },
  chipTextActive: { color: theme.color.brand },
  error: { color: theme.color.error, fontSize: 13 },
  cta: { padding: theme.space.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  primaryBtn: {
    backgroundColor: theme.color.brand, borderRadius: theme.radius.md,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { color: theme.color.onBrand, fontSize: 15, fontWeight: '800', letterSpacing: 1.4 },
});
