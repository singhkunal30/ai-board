import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api';
import { colors } from '../theme';
import type { ScreenProps } from '../navigation';
import type { Board } from '../types';

export default function BoardsScreen({ navigation, route }: ScreenProps<'Boards'>) {
  const { workspaceId, workspaceName } = route.params;
  const [items, setItems] = useState<Board[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await api<Board[]>(`/workspaces/${workspaceId}/boards`));
  }, [workspaceId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: workspaceName });
  }, [navigation, workspaceName]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api<Board>(`/workspaces/${workspaceId}/boards`, {
        method: 'POST',
        body: { title: title.trim() },
      });
      setTitle('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="New board"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
        />
        <Pressable style={styles.add} onPress={create} disabled={busy}>
          <Text style={styles.addText}>{busy ? '…' : 'Add'}</Text>
        </Pressable>
      </View>

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          ListEmptyComponent={<Text style={styles.empty}>No boards yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('Board', { boardId: item.id, title: item.title })}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                Updated {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  add: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  addText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 32 },
});
