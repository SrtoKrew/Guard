import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { theme } from '@/src/theme';
import { api, Task, session } from '@/src/api';

export default function TareasScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [guard, setGuard] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setGuard((await session.getGuard()) || '');
    try {
      const list = await api.listTasks();
      setTasks(list);
    } catch (e) {
      console.log('tasks err', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (t: Task) => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    await api.toggleTask(t.id, guard);
    load();
  };
  const remove = (t: Task) => {
    Alert.alert('Eliminar tarea', `¿Eliminar "${t.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await api.deleteTask(t.id); load(); } },
    ]);
  };

  const pending = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tareas</Text>
        <Text style={styles.subtitle}>{pending.length} pendientes · {done.length} completadas</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 100, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.color.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-check" size={64} color={theme.color.onSurfaceTertiary} />
            <Text style={styles.emptyText}>Sin tareas</Text>
            <Text style={styles.emptySubtext}>Añade tareas del turno</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`task-${item.id}`}
            onPress={() => toggle(item)}
            onLongPress={() => remove(item)}
            style={[styles.taskCard, item.done && styles.taskDone]}
          >
            <View style={[styles.checkBox, item.done && styles.checkBoxDone]}>
              {item.done && <MaterialCommunityIcons name="check" size={18} color={theme.color.onBrand} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, item.done && styles.strike]}>{item.title}</Text>
              {!!item.description && <Text style={styles.taskDesc}>{item.description}</Text>}
              <View style={styles.taskMeta}>
                {!!item.nave_name && (
                  <View style={styles.metaChip}>
                    <MaterialCommunityIcons name="warehouse" size={11} color={theme.color.brand} />
                    <Text style={styles.metaText}>{item.nave_name}</Text>
                  </View>
                )}
                {item.done && item.done_by && (
                  <View style={styles.metaChip}>
                    <MaterialCommunityIcons name="check" size={11} color={theme.color.success} />
                    <Text style={styles.metaText}>{item.done_by}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        testID="fab-add-task"
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/nueva-tarea')}
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

  taskCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: theme.color.surfaceSecondary,
    padding: 14, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border,
  },
  taskDone: { opacity: 0.6 },
  checkBox: {
    width: 26, height: 26, borderRadius: 6,
    borderWidth: 2, borderColor: theme.color.borderStrong,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxDone: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  taskTitle: { color: theme.color.onSurface, fontWeight: '600', fontSize: 15 },
  strike: { textDecorationLine: 'line-through' },
  taskDesc: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  taskMeta: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: theme.color.surfaceTertiary,
    borderRadius: theme.radius.pill,
  },
  metaText: { color: theme.color.onSurfaceSecondary, fontSize: 11, fontWeight: '600' },

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
