import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { BottomSheet, Button, Card, GpsStatusPill, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { TrainingSessionsRepository, type TrainingSessionTree } from '@/database/repositories/training';
import { useTheme } from '@/hooks/use-theme';
import { acquireInitialFix, type InitialFixAttempt, type InitialFixState } from '@/location/initial-fix';
import { LocationPermissions } from '@/location/permissions';
import { routes } from '@/navigation/routes';
import { formatDuration } from '@/utils/formatters';

export default function TrainingPreviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const router = useRouter(); const theme = useTheme(); const activity = useActivity();
  const [training, setTraining] = useState<TrainingSessionTree | null>(null); const [starting, setStarting] = useState(false); const [sheetVisible, setSheetVisible] = useState(false); const [waiting, setWaiting] = useState(false);
  const [fix, setFix] = useState<InitialFixState>({ status: 'sem_precisao_aceitavel', location: null }); const attempt = useRef<InitialFixAttempt | null>(null); const waitingRef = useRef(false); const creatingRef = useRef(false);
  useEffect(() => { let active = true; const trainingId = Number(id); if (Number.isFinite(trainingId)) void initializeDatabase().then(db => new TrainingSessionsRepository(db).buscarPorId(trainingId)).then(value => { if (active) setTraining(value); }); return () => { active = false; attempt.current?.cancel(); }; }, [id]);

  const createActivity = async () => { if (!training || creatingRef.current) return; creatingRef.current = true; setStarting(true); try { await activity.startStructuredRun(training.id, training.name); attempt.current?.cancel(); setSheetVisible(false); router.replace('/structured-activity' as Href); } finally { creatingRef.current = false; setStarting(false); } };
  const begin = async () => {
    if (!training || starting) return;
    if (activity.pendingRecovery || activity.status === 'in_progress' || activity.status === 'paused') { Alert.alert('Atividade em andamento', 'Resolva ou retome a atividade atual antes de iniciar outra.'); return; }
    setStarting(true); const permissions = await new LocationPermissions().checkAndRequest();
    if (permissions.foreground !== 'concedida' || permissions.background !== 'concedida') { setStarting(false); router.push({ pathname: routes.activityBlocked, params: { foreground: permissions.foreground, background: permissions.background } }); return; }
    waitingRef.current = false; setWaiting(false);
    attempt.current = acquireInitialFix(state => { setFix(state); if (state.status === 'boa_precisao' && !waitingRef.current) void createActivity(); else { setSheetVisible(true); setStarting(false); } }, 15_000, true);
  };
  const dismissSheet = () => { attempt.current?.cancel(); attempt.current = null; waitingRef.current = false; setWaiting(false); setSheetVisible(false); };
  const waitForSignal = () => { if (fix.status === 'boa_precisao') { void createActivity(); return; } waitingRef.current = true; setWaiting(true); };
  const expandedCount = training?.blocks.reduce((sum, block) => sum + block.repeat_count * block.steps.length, 0) ?? 0;

  return <Screen canGoBack onBack={() => router.replace(routes.trainingLibrary)} title={training?.name ?? 'Preparar treino'} footer={<View><GpsStatusPill status={fix.status === 'boa_precisao' ? 'good' : 'unacceptable'} /><Button disabled={!training || starting} onPress={() => void begin()}>Iniciar treino</Button></View>}>
    {training ? <><View style={styles.metrics}><TopMetric label="DURAÇÃO ESTIMADA" value={formatDuration(training.estimated_duration_seconds)} /><TopMetric label="ETAPAS" value={String(expandedCount)} /></View><View style={styles.steps}>{training.blocks.map(block => block.repeat_count > 1 ? <View key={block.id} style={styles.block}><Text style={[styles.repeat, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{block.repeat_count}× repetições</Text>{block.steps.map(step => <StepRow key={step.id} name={step.step_type.name} duration={step.duration_seconds} indented />)}</View> : block.steps.map(step => <StepRow key={step.id} name={step.step_type.name} duration={step.duration_seconds} />))}</View></> : <Text style={{ color: theme.colors.textSecondary }}>Carregando treino…</Text>}
    <BottomSheet visible={sheetVisible} onDismiss={dismissSheet} footer={<View style={styles.sheetActions}><Button variant="secondary" disabled={starting} onPress={() => void createActivity()}>Iniciar assim mesmo</Button><Button disabled={starting} onPress={waitForSignal}>{fix.status === 'boa_precisao' ? 'Iniciar' : 'Aguardar sinal'}</Button></View>}><GpsStatusPill status={fix.status === 'boa_precisao' ? 'good' : 'unacceptable'} /><Text style={[styles.sheetTitle, { color: theme.colors.text, fontFamily: theme.fonts.title.bold }]}>Iniciar agora pode registrar os primeiros metros com erro</Text><Text style={[styles.sheetCopy, { color: theme.colors.textSecondary }]}>O aparelho ainda está buscando sinal. Esperar alguns segundos a céu aberto melhora a precisão da distância e do percurso. A decisão é sua.</Text>{waiting ? <Text style={[styles.waiting, { color: theme.colors.highlight }]}>Monitorando o sinal…</Text> : null}</BottomSheet>
  </Screen>;
}
function TopMetric({ label, value }: { label: string; value: string }) { const theme = useTheme(); return <View style={styles.topMetric}><Text style={[styles.metricLabel, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>{label}</Text><Text style={[styles.metricValue, { color: theme.colors.text, fontFamily: theme.fonts.data.semibold }]}>{value}</Text></View>; }
function StepRow({ name, duration, indented = false }: { name: string; duration: number; indented?: boolean }) { const theme = useTheme(); return <Card style={[styles.step, indented && styles.indented]}><Text style={[styles.stepName, { color: theme.colors.text }]}>{name}</Text><Text style={[styles.stepDuration, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>{formatDuration(duration)}</Text></Card>; }
const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: 12, marginTop: 16 }, topMetric: { flex: 1 }, metricLabel: { fontSize: 11, letterSpacing: 1.5 }, metricValue: { fontSize: 30, marginTop: 4 }, steps: { gap: 10, marginTop: 28 }, block: { gap: 8 }, repeat: { fontSize: 18, marginBottom: 2 }, step: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 16 }, indented: { marginLeft: 24 }, stepName: { fontSize: 17 }, stepDuration: { fontSize: 15 }, sheetActions: { gap: 10 }, sheetTitle: { fontSize: 28, lineHeight: 34, marginTop: 22 }, sheetCopy: { fontSize: 17, lineHeight: 25, marginTop: 14 }, waiting: { marginTop: 18, textAlign: 'center' } });
