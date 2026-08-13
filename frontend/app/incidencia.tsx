import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@/src/theme';
import { api, Nave, session } from '@/src/api';

const TIPOS = ['Intrusión', 'Sabotaje', 'Fuego / Alarma', 'Avería', 'Vehículo', 'Puerta abierta', 'Otro'];

export default function Incidencia() {
  const router = useRouter();
  const [guard, setGuard] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS[0]);
  const [description, setDescription] = useState('');
  const [naves, setNaves] = useState<Nave[]>([]);
  const [selectedNave, setSelectedNave] = useState<Nave | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setGuard((await session.getGuard()) || 'anon');
    try { setNaves(await api.listNaves()); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // fallback to library
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPerm.granted) { setError('Permiso de cámara/galería denegado'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Permiso denegado'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const send = async () => {
    if (!description.trim()) { setError('Describe la incidencia'); return; }
    setSaving(true);
    let photo_path: string | undefined;
    try {
      if (photoUri) {
        setUploading(true);
        const r = await api.uploadPhoto(photoUri, guard);
        photo_path = r.path;
        setUploading(false);
      }
      await api.createIncident({
        guard,
        tipo,
        description: description.trim(),
        nave_id: selectedNave?.id,
        nave_name: selectedNave?.name,
        photo_path,
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.back();
    } catch (e: any) {
      setError('No se pudo enviar el reporte');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable testID="close-modal" onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={24} color={theme.color.onSurface} />
          </Pressable>
          <Text style={styles.title}>Reportar incidencia</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Tipo de incidencia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
              {TIPOS.map(t => (
                <Pressable
                  key={t}
                  testID={`tipo-${t}`}
                  onPress={() => setTipo(t)}
                  style={[styles.chip, tipo === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={styles.label}>Nave / Ubicación</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
              <Pressable onPress={() => setSelectedNave(null)} style={[styles.chip, !selectedNave && styles.chipActive]}>
                <Text style={[styles.chipText, !selectedNave && styles.chipTextActive]}>Sin ubicación</Text>
              </Pressable>
              {naves.map(n => (
                <Pressable key={n.id} onPress={() => setSelectedNave(n)} style={[styles.chip, selectedNave?.id === n.id && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedNave?.id === n.id && styles.chipTextActive]}>{n.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              testID="incident-desc-input"
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Describe lo ocurrido con detalle..."
              placeholderTextColor={theme.color.info}
              value={description}
              onChangeText={(v) => { setDescription(v); if (error) setError(''); }}
              multiline
            />
          </View>

          <View>
            <Text style={styles.label}>Foto de evidencia</Text>
            {photoUri ? (
              <View style={styles.photoWrap}>
                <RNImage source={{ uri: photoUri }} style={styles.photo} />
                <Pressable testID="remove-photo" style={styles.photoRemove} onPress={() => setPhotoUri(null)}>
                  <MaterialCommunityIcons name="close" size={18} color={theme.color.onSurface} />
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable testID="take-photo-btn" style={styles.photoBtn} onPress={pickPhoto}>
                  <MaterialCommunityIcons name="camera" size={22} color={theme.color.brand} />
                  <Text style={styles.photoBtnText}>CÁMARA</Text>
                </Pressable>
                <Pressable testID="gallery-btn" style={styles.photoBtn} onPress={pickFromGallery}>
                  <MaterialCommunityIcons name="image-multiple" size={22} color={theme.color.brand} />
                  <Text style={styles.photoBtnText}>GALERÍA</Text>
                </Pressable>
              </View>
            )}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.cta}>
          <Pressable testID="send-incident-btn" style={[styles.primaryBtn, (saving || uploading) && { opacity: 0.6 }]} disabled={saving} onPress={send}>
            {saving ? (
              <ActivityIndicator color={theme.color.onBrand} />
            ) : (
              <>
                <MaterialCommunityIcons name="alert-octagon" size={22} color={theme.color.onBrand} />
                <Text style={styles.primaryBtnText}>ENVIAR REPORTE</Text>
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
  photoBtn: {
    flex: 1, height: 100,
    borderRadius: theme.radius.md,
    borderWidth: 2, borderColor: theme.color.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.surfaceSecondary,
    gap: 6,
  },
  photoBtnText: { color: theme.color.brand, fontWeight: '700', letterSpacing: 1, fontSize: 12 },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 220, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSecondary },
  photoRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  error: { color: theme.color.error, fontSize: 13 },
  cta: { padding: theme.space.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  primaryBtn: {
    backgroundColor: theme.color.error, borderRadius: theme.radius.md,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { color: theme.color.onSurface, fontSize: 15, fontWeight: '800', letterSpacing: 1.4 },
});
