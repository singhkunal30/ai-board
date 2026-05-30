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
import { useAuth } from '../auth';
import { colors } from '../theme';
import type { ScreenProps } from '../navigation';
import type { Workspace } from '../types';

export default function WorkspacesScreen({ navigation }: ScreenProps<'Workspaces'>) {
  const { signOut } = useAuth();
  const [items, setItems] = useState<Workspace[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await api<Workspace[]>('/workspaces'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={{ color: colors.primary }}>Sign out</Text>
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api<Workspace>('/workspaces', { method: 'POST', body: { name: name.trim() } });
      setName('');
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
          placeholder="New workspace"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
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
          keyExtractor={(w) => w.id}
          ListEmptyComponent={<Text style={styles.empty}>No workspaces yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('Boards', { workspaceId: item.id, workspaceName: item.name })
              }
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.role}</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardMeta: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 32 },
});
