import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';

import { theme } from '@/src/theme';
import { api, Nave } from '@/src/api';

const NAVE_IMG =
  'https://images.unsplash.com/photo-1685459143116-efdf5fbee0dd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3YXJlaG91c2UlMjBleHRlcmlvciUyMGJ1aWxkaW5nJTIwbmlnaHR8ZW58MHx8fHwxNzg2NjYyNzMzfDA&ixlib=rb-4.1.0&q=85';

export default function NavesScreen() {
  const router = useRouter();
  const [naves, setNaves] = useState<Nave[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Naves</Text>
        <Text style={styles.subtitle}>{naves.length} en servicio</Text>
      </View>

      <FlatList
        data={naves}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 100, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.color.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="warehouse" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No hay naves asignadas</Text>
            <Text style={styles.emptySubtext}>Añade la primera nave del servicio</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`nave-card-${item.id}`}
            onLongPress={() => onDelete(item)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
          >
            <Image source={{ uri: NAVE_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(18,18,18,0.5)', 'rgba(18,18,18,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cardContent}>
              <View style={styles.badge}>
                <MaterialCommunityIcons name="warehouse" size={14} color={theme.color.brand} />
                <Text style={styles.badgeText}>NAVE</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.address && <Text style={styles.cardAddr}>{item.address}</Text>}
                {!!item.notes && <Text style={styles.cardNotes} numberOfLines={2}>{item.notes}</Text>}
              </View>
            </View>
          </Pressable>
        )}
      />

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, paddingBottom: theme.space.sm },
  title: { color: theme.color.onSurface, fontSize: 28, fontWeight: '800' },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 2 },

  card: {
    height: 160,
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
  cardAddr: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 4 },
  cardNotes: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },

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
