import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getApiUrl, setApiUrl } from '../config';
import { colors } from '../theme';
import type { ScreenProps } from '../navigation';

export default function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => setUrl(getApiUrl()), []);

  async function save() {
    await setApiUrl(url);
    setSaved(true);
    setTimeout(() => navigation.goBack(), 500);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Backend URL</Text>
      <Text style={styles.hint}>
        The address of the AI-Board API/web server reachable from this device.
        {'\n\n'}• Android emulator → http://10.0.2.2:4000{'\n'}• Real device on Wi-Fi →
        http://YOUR_COMPUTER_IP:4000{'\n'}• Deployed → https://board.yourcompany.com
      </Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="http://10.0.2.2:4000"
        placeholderTextColor={colors.muted}
      />
      <Pressable style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>{saved ? 'Saved ✓' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  hint: { color: colors.muted, marginBottom: 16, lineHeight: 20 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
