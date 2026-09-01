import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database';
import { AppPreferencesRepository } from '@/database/repositories/preferences';
import { useTheme } from '@/hooks/use-theme';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { SwitchRow } from './switch-row';

export function GuidanceSheet({ visible, structured, onDismiss, onPreferenceChange }: { visible: boolean; structured: boolean; onDismiss: () => void; onPreferenceChange?: (key: 'audio_cues_enabled' | 'haptic_cues_enabled', value: boolean) => Promise<void> }) {
  const theme = useTheme();
  const [audio, setAudio] = useState(true);
  const [haptic, setHaptic] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void initializeDatabase().then(async database => {
      const preferences = new AppPreferencesRepository(database);
      const values = await Promise.all([preferences.ler('audio_cues_enabled', true), preferences.ler('haptic_cues_enabled', true)]);
      if (active) { setAudio(values[0]); setHaptic(values[1]); }
    });
    return () => { active = false; };
  }, [visible]);

  const save = (key: 'audio_cues_enabled' | 'haptic_cues_enabled', value: boolean) => {
    if (key === 'audio_cues_enabled') setAudio(value); else setHaptic(value);
    if (onPreferenceChange) void onPreferenceChange(key, value);
    else void initializeDatabase().then(database => new AppPreferencesRepository(database).gravar(key, value));
  };

  return <BottomSheet visible={visible} onDismiss={onDismiss} footer={<Button variant="secondary" onPress={onDismiss}>Fechar</Button>}>
    <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>Orientações</Text>
    <View style={[styles.setting, { backgroundColor: theme.colors.surface }]}><SwitchRow label="Locução" caption="voz em pt-BR" value={audio} onValueChange={value => save('audio_cues_enabled', value)} /></View>
    <View style={[styles.setting, { backgroundColor: theme.colors.surface }]}><SwitchRow label="Vibração" caption="continua com a locução desligada" value={haptic} onValueChange={value => save('haptic_cues_enabled', value)} /></View>
    <Text style={[styles.section, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.semibold }]}>QUANDO O APP AVISA</Text>
    {structured ? <Cue number="01" text="Início e fim de cada etapa" /> : null}
    <Cue number="02" text="30 segundos antes do fim da etapa" />
    <Cue number="03" text="A cada quilômetro completo, com o pace do split" />
    <View style={[styles.examples, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>Exemplos: “Comece a correr.” · “Faltam trinta segundos.” · “Dois quilômetros. Pace nove minutos e cinco segundos.”</Text>
      {!audio ? <Text style={[styles.note, { color: theme.colors.text }]}>Os avisos continuam apenas por vibração.</Text> : null}
    </View>
  </BottomSheet>;
}

function Cue({ number, text }: { number: string; text: string }) {
  const theme = useTheme();
  return <View style={styles.cue}><Text style={[styles.number, { color: theme.colors.action, fontFamily: theme.fonts.data.medium }]}>{number}</Text><Text style={[styles.cueText, { color: theme.colors.text }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, marginBottom: 12 },
  setting: { borderRadius: 16, marginBottom: 10, paddingHorizontal: 16 },
  section: { fontSize: 11, letterSpacing: 1.8, marginBottom: 12, marginTop: 12 },
  cue: { alignItems: 'flex-start', flexDirection: 'row', marginBottom: 12 },
  number: { fontSize: 15, width: 42 },
  cueText: { flex: 1, fontSize: 17, lineHeight: 22 },
  examples: { borderRadius: 16, marginTop: 8, padding: 16 },
  exampleText: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 14, marginTop: 12 },
});
