import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import type { SortableGridRenderItem } from 'react-native-sortables';

import { theme } from '@/src/theme';
import { api, Nave } from '@/src/api';

const NAVE_IMG =
  'https://images.unsplash.com/photo-1685459143116-efdf5fbee0dd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3YXJlaG91c2UlMjBleHRlcmlvciUyMGJ1aWxkaW5nJTIwbmlnaHR8ZW58MHx8fHwxNzg2NjYyNzMzfDA&ixlib=rb-4.1.0&q=85';

const VIEW_MODE_KEY = 'cg.naves.viewmode';

export default function NavesScreen() {
  const router = useRouter();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [naves, setNaves] = useState<Nave[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grande' | 'lista'>('grande');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'grande' || saved === 'lista') setViewMode(saved);
    })();
  }, []);

  const changeViewMode = async (mode: 'grande' | 'lista') => {
    setViewMode(mode);
    await AsyncStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const load = useCallback(async () => {
    try {
      const list = await api.listNaves();
      setNaves(list);
    } catch (e) {
      console.log('naves err', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (n: Nave) => {
    Alert.alert('Eliminar nave', `¿Eliminar "${n.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await api.deleteNave(n.id);
          load();
        }
      },
    ]);
  };

  const onDragEnd = useCallback(async ({ data }: { data: Nave[] }) => {
    setNaves(data);
    try { await api.reorderNaves(data.map((d) => d.id)); } catch (e) { console.log(e); }
  }, []);

  const renderItem: SortableGridRenderItem<Nave> = useCallback(({ item }) => (
    viewMode === 'grande' ? (
      <NaveCardGrande item={item} onPress={() => router.push(`/nave/${item.id}`)} onLongPress={() => onDelete(item)} />
    ) : (
      <NaveCardLista item={item} onPress={() => router.push(`/nave/${item.id}`)} onLongPress={() => onDelete(item)} />
    )
  ), [viewMode]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Naves</Text>
          <Text style={styles.subtitle}>{naves.length} en servicio · mantén pulsado el asa para reordenar</Text>
        </View>
        <View style={styles.viewToggle}>
          <Pressable
            testID="view-mode-grande"
            onPress={() => changeViewMode('grande')}
            style={[styles.viewBtn, viewMode === 'grande' && styles.viewBtnActive]}
          >
            <MaterialCommunityIcons name="view-agenda-outline" size={18} color={viewMode === 'grande' ? theme.color.brand : theme.color.onSurfaceTertiary} />
          </Pressable>
          <Pressable
            testID="view-mode-lista"
            onPress={() => changeViewMode('lista')}
            style={[styles.viewBtn, viewMode === 'lista' && styles.viewBtnActive]}
          >
            <MaterialCommunityIcons name="view-list-outline" size={18} color={viewMode === 'lista' ? theme.color.brand : theme.color.onSurfaceTertiary} />
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.color.brand} />}
      >
        {naves.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="warehouse" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No hay naves asignadas</Text>
            <Text style={styles.emptySubtext}>Añade la primera nave del servicio</Text>
          </View>
        ) : (
          <Sortable.Grid
            key={viewMode}
            columns={1}
            data={naves}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            rowGap={12}
            customHandle
            hapticsEnabled
            onDragEnd={onDragEnd}
            scrollableRef={scrollRef}
          />
        )}
      </Animated.ScrollView>

      <Pressable
        testID="fab-add-nave"
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/nueva-nave')}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.color.onBrand} />
      </Pressable>
    </SafeAreaView>
  );
}

function NaveCardGrande({ item, onPress, onLongPress }: { item: Nave; onPress: () => void; onLongPress: () => void }) {
  return (
    <View style={[styles.card, { height: 160 }]}>
      <Pressable testID={`nave-card-${item.id}`} onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }}>
        <Image source={{ uri: NAVE_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(13,17,23,0.5)', 'rgba(13,17,23,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardContent}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="warehouse" size={14} color={theme.color.brand} />
            <Text style={styles.badgeText}>NAVE</Text>
          </View>
          <View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {!!item.notes && <Text style={styles.cardNotes} numberOfLines={2}>{item.notes}</Text>}
          </View>
        </View>
      </Pressable>
      <Sortable.Handle style={styles.handleGrande}>
        <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color="#fff" />
      </Sortable.Handle>
    </View>
  );
}

function NaveCardLista({ item, onPress, onLongPress }: { item: Nave; onPress: () => void; onLongPress: () => void }) {
  return (
    <View style={styles.listCard}>
      <Pressable testID={`nave-card-${item.id}`} onPress={onPress} onLongPress={onLongPress} style={styles.listCardMain}>
        <View style={styles.listIcon}>
          <MaterialCommunityIcons name="warehouse" size={20} color={theme.color.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{item.name}</Text>
          {!!item.notes && <Text style={styles.listNotes} numberOfLines={1}>{item.notes}</Text>}
        </View>
      </Pressable>
      <Sortable.Handle style={styles.handleLista}>
        <MaterialCommunityIcons name="drag-horizontal-variant" size={18} color={theme.color.onSurfaceTertiary} />
      </Sortable.Handle>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, paddingBottom: theme.space.sm, gap: 12 },
  title: { color: theme.color.onSurface, fontSize: 28, fontWeight: '800' },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  viewToggle: { flexDirection: 'row', backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border },
  viewBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  viewBtnActive: { backgroundColor: theme.color.brandTertiary, borderRadius: theme.radius.md },

  card: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  cardContent: {
    flex: 1, padding: theme.space.lg,
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.color.surface + 'CC',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.color.brand,
  },
  badgeText: { color: theme.color.brand, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardTitle: { color: theme.color.onSurface, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  cardNotes: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  handleGrande: {
    position: 'absolute', top: 10, right: 10,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },

  listCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border,
    overflow: 'hidden',
  },
  listCardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  listIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.color.brandTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  listTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: '700' },
  listNotes: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  handleLista: { width: 34, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: theme.color.onSurface, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: theme.color.onSurfaceTertiary, fontSize: 13 },

  fab: {
    position: 'absolute', right: 16, bottom: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 8,
  },
});
