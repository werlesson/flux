import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { rpeReading, saveActivityEvaluation } from '@/activity/result';
import { Button, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';

const RPE_VALUES = Array.from({ length: 10 }, (_, index) => index + 1);
const ANCHORS = [{ label: '1–3 Fácil', min: 1, max: 3 }, { label: '4–6 Controlado', min: 4, max: 6 }, { label: '7–10 Difícil', min: 7, max: 10 }];

export default function RpeScreen() {
  const { activityId } = useActivity();
  const params = useLocalSearchParams<{ activityId?: string; mode?: string }>();
  const editActivityId = Number(params.activityId);
  const editing = params.mode === 'edit' && Number.isInteger(editActivityId) && editActivityId > 0;
  const targetActivityId = editing ? editActivityId : activityId;
  const router = useRouter();
  const theme = useTheme();
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const canSave = rpe !== null || notes.trim().length > 0;
  const skip = useCallback(() => editing ? router.back() : router.replace(routes.history), [editing, router]);

  useEffect(() => {
    let active = true;
    if (!editing) return () => { active = false; };
    void initializeDatabase().then(database => new ActivitiesRepository(database).buscarPorId(editActivityId)).then(activity => {
      if (active && activity) { setRpe(activity.rpe); setNotes(activity.notes ?? ''); }
    });
    return () => { active = false; };
  }, [editActivityId, editing]);

  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { skip(); return true; });
    return () => listener.remove();
  }, [skip]));

  async function save() {
    if (targetActivityId === null || !canSave || saving) return;
    setSaving(true);
    try {
      const database = await initializeDatabase();
      await saveActivityEvaluation(new ActivitiesRepository(database), targetActivityId, rpe, notes);
      if (editing) router.back();
      else router.replace(routes.history);
    } finally { setSaving(false); }
  }

  return <Screen canGoBack onBack={skip} title="Como foi o treino?" footer={<View style={styles.footer}><Button disabled={!canSave || saving} onPress={() => { void save(); }} variant={canSave ? 'primary' : 'secondary'}>Salvar avaliação</Button>{editing ? <Button onPress={skip} variant="secondary">Cancelar</Button> : <Button onPress={skip} variant={canSave ? 'secondary' : 'primary'}>Salvar sem avaliar</Button>}</View>}>
    <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>O esforço percebido é opcional. Você pode responder depois, pelo histórico.</Text>
    <View style={styles.rpeHeader}><Text style={[styles.section, { color: theme.colors.textSecondary }]}>RPE</Text><Text style={[styles.reading, { color: rpe === null ? theme.colors.textSecondary : theme.colors.action }]}>{rpeReading(rpe)}</Text></View>
    <View style={styles.grid}>{RPE_VALUES.map(value => { const selected = value === rpe; return <Pressable accessibilityLabel={`RPE ${value}`} accessibilityRole="button" accessibilityState={{ selected }} key={value} onPress={() => setRpe(current => current === value ? null : value)} style={[styles.rpeButton, { backgroundColor: selected ? theme.colors.action : theme.colors.surface, borderColor: selected ? theme.colors.action : theme.colors.border }]}><Text style={[styles.rpeValue, { color: selected ? '#FFFFFF' : theme.colors.text }]}>{value}</Text></Pressable>; })}</View>
    <View style={styles.anchors}>{ANCHORS.map(anchor => { const selected = rpe !== null && rpe >= anchor.min && rpe <= anchor.max; return <Text key={anchor.label} style={{ color: selected ? theme.colors.action : theme.colors.textSecondary, fontWeight: selected ? '700' : '400' }}>{anchor.label}</Text>; })}</View>
    <Text style={[styles.notesLabel, { color: theme.colors.textSecondary }]}>OBSERVAÇÕES · OPCIONAL</Text>
    <TextInput multiline onChangeText={setNotes} placeholder="Como você se sentiu, o clima, o terreno…" placeholderTextColor={theme.colors.textSecondary} style={[styles.notes, { backgroundColor: theme.colors.surface, borderColor: notes ? theme.colors.action : theme.colors.border, color: theme.colors.text }]} textAlignVertical="top" value={notes} />
  </Screen>;
}

const styles = StyleSheet.create({ intro: { fontSize: 17, lineHeight: 25, marginBottom: 30 }, rpeHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }, section: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5 }, reading: { fontSize: 22, fontWeight: '700' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, rpeButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexBasis: '18%', flexGrow: 1, justifyContent: 'center', minHeight: 84 }, rpeValue: { fontSize: 28, fontWeight: '700' }, anchors: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, notesLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 1.4, marginBottom: 12, marginTop: 34 }, notes: { borderRadius: 14, borderWidth: 1, fontSize: 16, lineHeight: 23, minHeight: 154, padding: 16 }, footer: { gap: 10, paddingBottom: 12 } });
