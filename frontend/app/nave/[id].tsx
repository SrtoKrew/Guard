import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Alert, Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import type { SortableGridRenderItem } from 'react-native-sortables';

import { theme, vehicleIcon, EVENT_LABELS } from '@/src/theme';
import { api, Nave, Vehicle, NaveCheck, session } from '@/src/api';
import { useToast } from '@/src/toast';

export default function NaveDetail() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const naveId = String(id);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const [nave, setNave] = useState<Nave | null>(null);
  const [guard, setGuard] = useState('');
  const [turnoId, setTurnoId] = useState<string | null>(null);
  const [checks, setChecks] = useState<NaveCheck[]>([]);
  const [linea, setLinea] = useState<Vehicle[]>([]);
  const [frente, setFrente] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    const g = (await session.getGuard()) || '';
    const t = await session.getTurnoId();
    setGuard(g);
    setTurnoId(t);
    try {
      const naves = await api.listNaves();
      const found = naves.find((n) => n.id === naveId) || null;
      setNave(found);
      if (found?.has_vehicles) {
        const vehicles = await api.listVehicles(naveId);
        setLinea(vehicles.filter((v) => v.zone === 'linea'));
        setFrente(vehicles.filter((v) => v.zone === 'frente'));
      }
      if (t && found && found.check_items.length > 0) {
        setChecks(await api.getNaveChecks(naveId, t));
      }
    } catch (e) {
      console.log('nave detail err', e);
    }
  }, [naveId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const registerEvent = async (type: string, note?: string) => {
    const key = note || type;
    setBusyAction(key);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    try {
      await api.createEvent({ guard, type, note, nave_id: naveId, nave_name: nave?.name, turno_id: turnoId || undefined });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      const label = note || EVENT_LABELS[type] || type;
      toast.show(`${label} registrado en el control`, 'check-circle');
    } catch (e) {
      console.log('register err', e);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleCheck = async (item: string) => {
    if (!turnoId) return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    try {
      const result = await api.toggleNaveCheck(naveId, item, guard, turnoId);
      setChecks(await api.getNaveChecks(naveId, turnoId));
      toast.show(`${item} ${result.checked ? 'verificado' : 'desmarcado'}`, 'check-circle');
    } catch (e) {
      console.log('check err', e);
    }
  };

  const openAddVehicle = (zone: 'linea' | 'frente') => {
    router.push({ pathname: '/vehiculo', params: { naveId, zone } });
  };
  const openEditVehicle = (v: Vehicle) => {
    router.push({ pathname: '/vehiculo', params: { naveId, id: v.id } });
  };
  const deleteVehicle = (v: Vehicle) => {
    Alert.alert('Eliminar vehículo', `¿Eliminar ${v.matricula}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await api.deleteVehicle(v.id); load(); } },
    ]);
  };

  const onDragEndLinea = useCallback(async ({ data }: { data: Vehicle[] }) => {
    setLinea(data);
    try { await api.reorderVehicles(naveId, 'linea', data.map((d) => d.id)); } catch (e) { console.log(e); }
  }, [naveId]);

  const onDragEndFrente = useCallback(async ({ data }: { data: Vehicle[] }) => {
    setFrente(data);
    try { await api.reorderVehicles(naveId, 'frente', data.map((d) => d.id)); } catch (e) { console.log(e); }
  }, [naveId]);

  const renderVehicle: SortableGridRenderItem<Vehicle> = useCallback(({ item }) => (
    <VehicleCard item={item} onPress={() => openEditVehicle(item)} onLongPress={() => deleteVehicle(item)} />
  ), []);

  if (!nave) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="nave-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.color.onSurface} />
          </Pressable>
          <Text style={styles.title}>Nave</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable testID="nave-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{nave.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
      >
        {!!nave.notes && <Text style={styles.notes}>{nave.notes}</Text>}

        {nave.check_items.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { paddingHorizontal: theme.space.lg, marginTop: theme.space.md }]}>Verificación de acceso</Text>
            <View style={styles.checksRow}>
              {nave.check_items.map((item) => {
                const c = checks.find((x) => x.item_name === item);
                const checked = !!c?.checked;
                return (
                  <Pressable
                    key={item}
                    testID={`check-${item.replace(/\s+/g, '-')}`}
                    onPress={() => toggleCheck(item)}
                    style={[styles.checkBox, checked && styles.checkBoxOn]}
                  >
                    <MaterialCommunityIcons
                      name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={checked ? theme.color.success : theme.color.onSurfaceTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkLabel}>{item}</Text>
                      {checked && !!c?.checked_by && (
                        <Text style={styles.checkMeta}>
                          {c.checked_by} · {c.checked_at ? new Date(c.checked_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : ''}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {nave.has_access_buttons && (
          <View style={styles.accessRow}>
            <Pressable testID="entrada-nave-btn" style={[styles.accessBtn, { backgroundColor: theme.color.success }]} onPress={() => registerEvent('entrada_nave')}>
              <MaterialCommunityIcons name="location-enter" size={24} color={theme.color.onSurface} />
              <Text style={styles.accessText}>ENTRADA A NAVE</Text>
            </Pressable>
            <Pressable testID="salida-nave-btn" style={[styles.accessBtn, { backgroundColor: theme.color.brand }]} onPress={() => registerEvent('salida_nave')}>
              <MaterialCommunityIcons name="location-exit" size={24} color={theme.color.onBrand} />
              <Text style={[styles.accessText, { color: theme.color.onBrand }]}>SALIDA DE NAVE</Text>
            </Pressable>
          </View>
        )}

        {nave.custom_actions.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { paddingHorizontal: theme.space.lg, marginTop: theme.space.xl }]}>Acciones</Text>
            <View style={styles.customRow}>
              {nave.custom_actions.map((label) => (
                <Pressable
                  key={label}
                  testID={`custom-action-${label.replace(/\s+/g, '-')}`}
                  style={styles.customBtn}
                  disabled={busyAction === label}
                  onPress={() => registerEvent('accion_nave', label)}
                >
                  <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={theme.color.onSurface} />
                  <Text style={styles.customBtnText}>{label.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {nave.has_vehicles && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vehículos en línea · Cochera ({linea.length})</Text>
              <Pressable testID="add-vehicle-linea" onPress={() => openAddVehicle('linea')} style={styles.addBtn}>
                <MaterialCommunityIcons name="plus" size={16} color={theme.color.brand} />
                <Text style={styles.addBtnText}>AÑADIR</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: theme.space.lg }}>
              {linea.length === 0 ? (
                <Text style={styles.empty}>Sin vehículos en esta zona</Text>
              ) : (
                <Sortable.Grid
                  columns={1}
                  data={linea}
                  renderItem={renderVehicle}
                  keyExtractor={(item) => item.id}
                  rowGap={10}
                  customHandle
                  hapticsEnabled
                  onDragEnd={onDragEndLinea}
                  scrollableRef={scrollRef}
                />
              )}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vehículos aparcados en frente ({frente.length})</Text>
              <Pressable testID="add-vehicle-frente" onPress={() => openAddVehicle('frente')} style={styles.addBtn}>
                <MaterialCommunityIcons name="plus" size={16} color={theme.color.brand} />
                <Text style={styles.addBtnText}>AÑADIR</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: theme.space.lg }}>
              {frente.length === 0 ? (
                <Text style={styles.empty}>Sin vehículos en esta zona</Text>
              ) : (
                <Sortable.Grid
                  columns={1}
                  data={frente}
                  renderItem={renderVehicle}
                  keyExtractor={(item) => item.id}
                  rowGap={10}
                  customHandle
                  hapticsEnabled
                  onDragEnd={onDragEndFrente}
                  scrollableRef={scrollRef}
                />
              )}
            </View>
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function VehicleCard({ item, onPress, onLongPress }: { item: Vehicle; onPress: () => void; onLongPress: () => void }) {
  return (
    <View style={styles.vehicleCard}>
      <View style={styles.vehicleRow}>
        <Pressable style={styles.vehicleMain} onPress={onPress} onLongPress={onLongPress}>
          <View style={styles.vehicleIconWrap}>
            <MaterialCommunityIcons name={vehicleIcon(item.tipo)} size={22} color={theme.color.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehiclePlate}>{item.matricula}</Text>
            <Text style={styles.vehicleTipo}>{item.tipo}</Text>
          </View>
          <View style={[styles.badge, item.vandalizado ? styles.badgeBad : styles.badgeOk]}>
            <Text style={[styles.badgeText, { color: item.vandalizado ? theme.color.error : theme.color.success }]}>
              {item.vandalizado ? 'VANDALIZADO' : 'OK'}
            </Text>
          </View>
        </Pressable>
        <Sortable.Handle>
          <View style={styles.dragHandle}>
            <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color={theme.color.onSurfaceTertiary} />
          </View>
        </Sortable.Handle>
      </View>
      {item.vandalizado && (!!item.vandalizado_detalle || !!item.photo_path) && (
        <Pressable onPress={onPress} style={styles.vehicleExtra}>
          {!!item.vandalizado_detalle && <Text style={styles.vehicleDetail}>{item.vandalizado_detalle}</Text>}
          {!!item.photo_path && <RNImage source={{ uri: api.fileUrl(item.photo_path) }} style={styles.thumb} />}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  title: { flex: 1, textAlign: 'center', color: theme.color.onSurface, fontSize: 18, fontWeight: '800' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  notes: { color: theme.color.onSurfaceTertiary, fontSize: 13, paddingHorizontal: theme.space.lg, marginTop: theme.space.sm },
  sectionTitle: {
    color: theme.color.onSurfaceTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg, marginTop: theme.space.xl, marginBottom: theme.space.sm,
  },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { color: theme.color.brand, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  checksRow: { paddingHorizontal: theme.space.lg, marginTop: theme.space.sm, gap: 8 },
  checkBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md, padding: 12,
  },
  checkBoxOn: { borderColor: theme.color.success },
  checkLabel: { color: theme.color.onSurface, fontWeight: '700', fontSize: 14 },
  checkMeta: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },

  accessRow: { flexDirection: 'row', gap: 8, paddingHorizontal: theme.space.lg, marginTop: theme.space.lg },
  accessBtn: {
    flex: 1, paddingVertical: 18, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  accessText: { color: theme.color.onSurface, fontWeight: '800', letterSpacing: 1, fontSize: 12 },

  customRow: { paddingHorizontal: theme.space.lg, gap: 8 },
  customBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md, paddingVertical: 16, paddingHorizontal: 14,
  },
  customBtnText: { color: theme.color.onSurface, fontWeight: '800', letterSpacing: 1, fontSize: 13 },

  empty: { color: theme.color.onSurfaceTertiary, fontSize: 13, paddingVertical: 8 },

  vehicleCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border,
    overflow: 'hidden',
  },
  vehicleRow: { flexDirection: 'row', alignItems: 'stretch' },
  vehicleMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  vehicleIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.color.brandTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  vehiclePlate: { color: theme.color.onSurface, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  vehicleTipo: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: 1 },
  badgeOk: { borderColor: theme.color.success, backgroundColor: '#43A04722' },
  badgeBad: { borderColor: theme.color.error, backgroundColor: '#E5393522' },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dragHandle: { width: 40, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: theme.color.border },
  vehicleExtra: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  vehicleDetail: { color: theme.color.error, fontSize: 12, fontWeight: '600' },
  thumb: { width: '100%', height: 120, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceTertiary },
});
