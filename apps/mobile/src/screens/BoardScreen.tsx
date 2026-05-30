import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { genId } from '../util';
import { Canvas } from '../board/Canvas';
import { useBoardSync } from '../board/useBoardSync';
import type { ScreenProps } from '../navigation';
import {
  objectText,
  type AppliedBoardOp,
  type BoardCommandResult,
  type BoardObjectBase,
} from '../types';

export default function BoardScreen({ route }: ScreenProps<'Board'>) {
  const { boardId } = route.params;
  const { user } = useAuth();
  const sync = useBoardSync(boardId, user?.id ?? 'anon');

  const [command, setCommand] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced persistence of the live doc to the REST snapshot so the
  // server-side AI features read current content (mirrors the web client).
  useEffect(() => {
    if (!sync.connected) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void api(`/boards/${boardId}/snapshot`, {
        method: 'PUT',
        body: { schemaVersion: 1, objects: sync.objects, edges: sync.edges },
      }).catch(() => undefined);
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sync.objects, sync.edges, sync.connected, boardId]);

  const addNote = useCallback(() => {
    const n = sync.objects.length;
    const obj: BoardObjectBase = {
      id: genId(),
      type: 'sticky_note',
      position: { x: (n % 5) * 40, y: Math.floor(n / 5) * 40 },
      size: { width: 180, height: 180 },
      zIndex: 0,
      data: { text: 'New note' },
      style: { background: '#fde68a' },
    };
    sync.addObject(obj);
    setEditId(obj.id);
    setEditText('New note');
  }, [sync]);

  const onMove = useCallback(
    (id: string, x: number, y: number) => sync.patchObject(id, { position: { x, y } }),
    [sync],
  );

  const onPressNote = useCallback(
    (id: string) => {
      const obj = sync.objects.find((o) => o.id === id);
      if (!obj) return;
      setEditId(id);
      setEditText(objectText(obj));
    },
    [sync.objects],
  );

  function saveEdit() {
    if (editId) sync.patchObject(editId, { data: { text: editText } });
    setEditId(null);
  }
  function deleteEdit() {
    if (editId) sync.removeObjects([editId]);
    setEditId(null);
  }

  const applyOps = useCallback(
    (ops: AppliedBoardOp[]) => {
      for (const op of ops) {
        if (op.kind === 'add') sync.addObject(op.object);
        else if (op.kind === 'update')
          sync.patchObject(op.id, { data: op.data, style: op.style, position: op.position });
        else if (op.kind === 'delete') sync.removeObjects(op.ids);
        else if (op.kind === 'connect') sync.addEdge(op.edge);
      }
    },
    [sync],
  );

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
      applyOps(res.operations);
      setReply(res.reply);
      setCommand('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Command failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.dot, { backgroundColor: sync.connected ? '#22c55e' : '#f59e0b' }]} />
          <Text style={styles.statusText}>
            {sync.connected ? 'Live' : 'Connecting…'}
            {sync.collaborators > 0 ? ` · ${sync.collaborators} other` : ''}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={addNote}>
          <Text style={styles.addBtnText}>+ Note</Text>
        </Pressable>
      </View>

      <Canvas objects={sync.objects} onMove={onMove} onPressNote={onPressNote} />

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

      <Modal
        visible={editId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditId(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditId(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Edit note</Text>
            <TextInput
              style={styles.sheetInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Note text"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={deleteEdit}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <Pressable onPress={() => setEditId(null)}>
                  <Text style={{ color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEdit}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { color: colors.muted, fontSize: 12 },
  addBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  reply: { color: colors.text, paddingHorizontal: 14, paddingVertical: 6 },
  error: { color: colors.danger, paddingHorizontal: 14, paddingVertical: 6 },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 14, padding: 18 },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sheetInput: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
});
