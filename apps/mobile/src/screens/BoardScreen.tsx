import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, ApiError } from '../api';
import { colors } from '../theme';
import type { ScreenProps } from '../navigation';
import { objectText, type Board, type BoardCommandResult, type BoardObjectBase, type BoardSnapshot } from '../types';

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BoardScreen({ route }: ScreenProps<'Board'>) {
  const { boardId } = route.params;
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [command, setCommand] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const board = await api<Board>(`/boards/${boardId}`);
    setSnapshot(board.snapshot ?? { schemaVersion: 1, objects: [], edges: [] });
  }, [boardId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function persist(next: BoardSnapshot) {
    setSnapshot(next);
    await api(`/boards/${boardId}/snapshot`, { method: 'PUT', body: next }).catch(() => undefined);
  }

  async function addNote() {
    if (!snapshot) return;
    const obj: BoardObjectBase = {
      id: genId(),
      type: 'sticky_note',
      position: { x: 0, y: 0 },
      size: { width: 180, height: 180 },
      zIndex: 0,
      data: { text: 'New note' },
      style: { background: colors.sticky },
    };
    await persist({ ...snapshot, objects: [...snapshot.objects, obj] });
  }

  async function deleteObject(id: string) {
    if (!snapshot) return;
    await persist({
      ...snapshot,
      objects: snapshot.objects.filter((o) => o.id !== id),
      edges: snapshot.edges.filter((e) => e.source !== id && e.target !== id),
    });
  }

  async function runCommand() {
    if (!command.trim()) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const res = await api<BoardCommandResult>(`/boards/${boardId}/ai/command`, {
        method: 'POST',
        body: { instruction: command.trim() },
      });
      setReply(res.reply);
      setCommand('');
      // The server persisted the changes; reload to reflect them.
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Command failed');
    } finally {
      setBusy(false);
    }
  }

  if (!snapshot) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        data={[...snapshot.objects].sort((a, b) => a.zIndex - b.zIndex)}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={
          <Pressable style={styles.addBtn} onPress={addNote}>
            <Text style={styles.addBtnText}>+ Add note</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            This board is empty. Add a note, or ask the assistant below to build it for you.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.note,
              { backgroundColor: (item.style?.background as string) ?? colors.surface },
            ]}
          >
            <Text style={styles.noteType}>{item.type.replace(/_/g, ' ')}</Text>
            <Text style={styles.noteText}>{objectText(item) || '—'}</Text>
            <Pressable style={styles.del} onPress={() => deleteObject(item.id)} hitSlop={8}>
              <Text style={styles.delText}>✕</Text>
            </Pressable>
          </View>
        )}
      />

      {reply && <Text style={styles.reply}>🤖 {reply}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.bar}>
        <TextInput
          style={styles.input}
          placeholder="Tell the assistant to edit the board…"
          placeholderTextColor={colors.muted}
          value={command}
          onChangeText={setCommand}
          editable={!busy}
        />
        <Pressable style={styles.run} onPress={runCommand} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.runText}>Run</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtnText: { color: colors.primary, fontWeight: '700' },
  note: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  noteType: { color: '#1f2937', fontSize: 10, textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 },
  noteText: { color: '#111827', fontSize: 15 },
  del: { position: 'absolute', top: 8, right: 10 },
  delText: { color: '#111827', opacity: 0.5, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24, lineHeight: 20 },
  reply: { color: colors.text, paddingHorizontal: 16, paddingVertical: 6 },
  error: { color: colors.danger, paddingHorizontal: 16, paddingVertical: 6 },
  bar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  run: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  runText: { color: '#fff', fontWeight: '700' },
});
