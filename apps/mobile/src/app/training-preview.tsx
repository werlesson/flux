import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useActivity } from '@/activity/activity-context';
import { Button, Card, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { TrainingSessionsRepository, type TrainingSessionTree } from '@/database/repositories/training';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';
import { formatDuration } from '@/utils/formatters';

export default function TrainingPreviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const router = useRouter(); const theme = useTheme(); const activity = useActivity();
  const [training, setTraining] = useState<TrainingSessionTree | null>(null); const [starting, setStarting] = useState(false);
  useEffect(() => { let active = true; const trainingId = Number(id); if (Number.isFinite(trainingId)) void initializeDatabase().then(db => new TrainingSessionsRepository(db).buscarPorId(trainingId)).then(value => { if (active) setTraining(value); }); return () => { active = false; }; }, [id]);
  const start = async () => { if (!training || starting) return; if (activity.pendingRecovery || activity.status === 'in_progress' || activity.status === 'paused') { Alert.alert('Atividade em andamento', 'Resolva ou retome a atividade atual antes de iniciar outra.'); return; } setStarting(true); try { await activity.startStructuredRun(training.id, training.name); router.replace('/structured-activity' as Href); } finally { setStarting(false); } };
  const steps = training?.blocks.flatMap(block => Array.from({ length: block.repeat_count }, (_, repetition) => block.steps.map(step => ({ ...step, key: `${block.id}-${repetition}-${step.id}` })))).flat() ?? [];
  return <Screen canGoBack footer={<Button disabled={!training || starting} onPress={() => void start()}>Iniciar treino</Button>} title="Preparar atividade">{training ? <><Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.bold }]}>{training.name}</Text><Text style={{ color: theme.colors.textSecondary }}>Duração estimada · {formatDuration(training.estimated_duration_seconds)}</Text><View style={styles.steps}>{steps.map((step, index) => <Card key={step.key} style={styles.step}><Text style={{ color: theme.colors.text }}>{index + 1}. {step.step_type.name}</Text><Text style={{ color: theme.colors.textSecondary }}>{formatDuration(step.duration_seconds)}</Text></Card>)}</View></> : <Text style={{ color: theme.colors.textSecondary }}>Carregando treino…</Text>}</Screen>;
}
const styles = StyleSheet.create({ title: { fontSize: 30, marginBottom: 4 }, steps: { gap: 8, marginTop: 24 }, step: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 } });
