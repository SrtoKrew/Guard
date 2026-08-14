import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image as RNImage, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { theme, VEHICLE_TIPOS, vehicleIcon } from '@/src/theme';
import { api, session } from '@/src/api';

export default function VehiculoModal() {
  const router = useRouter();
  const { naveId, zone: zoneParam, id } = useLocalSearchParams<{ naveId: string; zone?: string; id?: string }>();
  const isEdit = !!id;

  const [guard, setGuard] = useState('anon');
  const [tipo, setTipo] = useState(VEHICLE_TIPOS[0]);
  const [matricula, setMatricula] = useState('');
  const [vandalizado, setVandalizado] = useState(false);
  const [detalle, setDetalle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setGuard((await session.getGuard()) || 'anon');
    if (isEdit && naveId) {
      try {
        const list = await api.listVehicles(String(naveId));
        const v = list.find((x) => x.id === id);
        if (v) {
          setTipo(v.tipo);
          setMatricula(v.matricula);
          setVandalizado(v.vandalizado);
          setDetalle(v.vandalizado_detalle || '');
          setExistingPhotoPath(v.photo_path || null);
        }
      } catch (e) {
        console.log('load vehicle err', e);
      }
    }
    setLoading(false);
  }, [id, isEdit, naveId]);

  useEffect(() => { load(); }, [load]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
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

  const save = async () => {
    if (!matricula.trim()) { setError('La matrícula es obligatoria'); return; }
    setSaving(true);
    setError('');
    try {
      let photo_path: string | null | undefined = existingPhotoPath;
      if (photoUri) {
        const r = await api.uploadPhoto(photoUri, guard);
        photo_path = r.path;
      }
      if (!vandalizado) {
        photo_path = null;
      }
      if (isEdit && id) {
        await api.updateVehicle(String(id), {
          tipo, matricula: matricula.trim().toUpperCase(), vandalizado,
          vandalizado_detalle: vandalizado ? (detalle.trim() || undefined) : null,
          photo_path,
        });
      } else {
        await api.createVehicle({
          nave_id: String(naveId),
          tipo, matricula: matricula.trim().toUpperCase(),
          zone: String(zoneParam || 'linea'),
          vandalizado,
          vandalizado_detalle: vandalizado ? (detalle.trim() || undefined) : undefined,
          photo_path: photo_path || undefined,
        });
      }
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.back();
    } catch (e) {
      setError('No se pudo guardar el vehículo');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Eliminar vehículo', `¿Eliminar ${matricula}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await api.deleteVehicle(String(id)); router.back(); } },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.color.brand} size="large" />
      </SafeAreaView>
    );
  }

  const displayPhoto = photoUri || (existingPhotoPath ? api.fileUrl(existingPhotoPath) : null);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable testID="close-modal" onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={24} color={theme.color.onSurface} />
          </Pressable>
          <Text style={styles.title}>{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</Text>
          {isEdit ? (
            <Pressable testID="delete-vehicle-btn" onPress={remove} style={styles.iconBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.color.error} />
            </Pressable>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Tipo de vehículo</Text>
            <View style={styles.chipRow}>
              {VEHICLE_TIPOS.map((t) => (
                <Pressable
                  key={t}
                  testID={`tipo-${t}`}
                  onPress={() => setTipo(t)}
                  style={[styles.chip, tipo === t && styles.chipActive]}
                >
                  <MaterialCommunityIcons name={vehicleIcon(t)} size={14} color={tipo === t ? theme.color.brand : theme.color.onSurfaceTertiary} />
                  <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Matrícula *</Text>
            <TextInput
              testID="vehicle-plate-input"
              style={styles.input}
              placeholder="Ej. 8536 GVP"
              placeholderTextColor={theme.color.info}
              value={matricula}
              onChangeText={(v) => { setMatricula(v); if (error) setError(''); }}
              autoCapitalize="characters"
            />
          </View>

          <View>
            <Text style={styles.label}>¿Vandalizado?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                testID="vandalizado-no"
                onPress={() => setVandalizado(false)}
                style={[styles.toggleBtn, !vandalizado && styles.toggleActiveOk]}
              >
                <Text style={[styles.toggleText, !vandalizado && { color: theme.color.success }]}>NO</Text>
              </Pressable>
              <Pressable
                testID="vandalizado-si"
                onPress={() => setVandalizado(true)}
                style={[styles.toggleBtn, vandalizado && styles.toggleActiveBad]}
              >
                <Text style={[styles.toggleText, vandalizado && { color: theme.color.error }]}>SÍ</Text>
              </Pressable>
            </View>
          </View>

          {vandalizado && (
            <>
              <View>
                <Text style={styles.label}>¿Qué está vandalizado?</Text>
                <TextInput
                  testID="vandalizado-detail-input"
                  style={styles.input}
                  placeholder="Ej. Cerradura Conductor"
                  placeholderTextColor={theme.color.info}
                  value={detalle}
                  onChangeText={setDetalle}
                />
              </View>

              <View>
                <Text style={styles.label}>Foto de evidencia</Text>
                {displayPhoto ? (
                  <View style={styles.photoWrap}>
                    <RNImage source={{ uri: displayPhoto }} style={styles.photo} />
                    <Pressable testID="remove-photo" style={styles.photoRemove} onPress={() => { setPhotoUri(null); setExistingPhotoPath(null); }}>
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
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.cta}>
          <Pressable testID="save-vehicle-btn" style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
            {saving ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <>
                <MaterialCommunityIcons name="check" size={22} color={theme.color.onBrand} />
                <Text style={styles.primaryBtnText}>GUARDAR VEHÍCULO</Text>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 36, paddingHorizontal: 12, borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
  },
  chipActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brandTertiary },
  chipText: { color: theme.color.onSurfaceTertiary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: theme.color.brand },
  toggleBtn: {
    flex: 1, height: 48, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
  },
  toggleActiveOk: { borderColor: theme.color.success, backgroundColor: '#43A04722' },
  toggleActiveBad: { borderColor: theme.color.error, backgroundColor: '#E5393522' },
  toggleText: { color: theme.color.onSurfaceTertiary, fontWeight: '800', letterSpacing: 1 },
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
  photo: { width: '100%', height: 200, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSecondary },
  photoRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
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
