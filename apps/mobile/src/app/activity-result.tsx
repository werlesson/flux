import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { discardSummary, resultMetrics, resultSubtitle } from '@/activity/result';
import { ActivitySplits } from '@/components/activity-splits';
import { Button, Card, ConfirmDialog, MetricGrid, MetricTile, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { ActivityStepsRepository, type ActivityStepResult } from '@/database/repositories/activity-steps';
import type { Activity, ActivitySplit, StepExecutionStatusSlug } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';
import { formatDuration } from '@/utils/formatters';

type ResultData = { activity: Activity; validPoints: number; splits: ActivitySplit[]; steps: ActivityStepResult[] };
const STATUS: Record<StepExecutionStatusSlug, string> = { completed: 'Concluída', skipped: 'Pulada', not_performed: 'Não realizada' };

export default function ActivityResultScreen() {
  const { activityId, discard } = useActivity();
  const router = useRouter();
  const theme = useTheme();
  const [data, setData] = useState<ResultData | null>(null);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const goToHistory = useCallback(() => router.replace(routes.history), [router]);

  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goToHistory(); return true; });
    return () => listener.remove();
  }, [goToHistory]));

  useEffect(() => {
    let active = true;
    if (activityId === null) return () => { active = false; };
    void initializeDatabase().then(async database => {
      const activity = await new ActivitiesRepository(database).buscarPorId(activityId);
      if (!activity) return null;
      const [{ count: validPoints }] = await database.all<{ count: number }>('SELECT COUNT(*) count FROM activity_points WHERE activity_id=? AND is_valid=1', [activityId]);
      const [splits, steps] = await Promise.all([new ActivitySplitsRepository(database).listar(activityId), new ActivityStepsRepository(database).listarResultado(activityId)]);
      return { activity, validPoints, splits, steps };
    }).then(value => { if (active && value) setData(value); });
    return () => { active = false; };
  }, [activityId]);

  if (!data) return <Screen canGoBack onBack={goToHistory} title="Atividade concluída"><Text style={{ color: theme.colors.textSecondary }}>Carregando atividade…</Text></Screen>;
  const metrics = resultMetrics(data.activity, data.validPoints > 0);
  const shownSteps = showAllSteps ? data.steps : data.steps.slice(0, 3);
  const summary = discardSummary(data.activity, data.splits.length);

  async function confirmDiscard() { await discard(); setDiscardVisible(false); router.replace(routes.home); }

  return <Screen canGoBack onBack={goToHistory} title="Atividade concluída">
    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{resultSubtitle(data.activity)}</Text>
    <View style={styles.highlights}><View><Text style={[styles.big, { color: theme.colors.text }]}>{metrics.distance}</Text><Text style={styles.label}>DISTÂNCIA</Text></View><View style={styles.right}><Text style={[styles.big, { color: theme.colors.text }]}>{metrics.elapsed}</Text><Text style={styles.label}>TEMPO TOTAL</Text></View></View>
    <MetricGrid><MetricTile label="PACE MÉDIO" value={metrics.averagePace} /><MetricTile label="MELHOR KM" value={metrics.bestPace} /><MetricTile label="TEMPO CORRENDO" value={metrics.moving} /><MetricTile label="TEMPO CAMINHANDO" value={metrics.stopped} /></MetricGrid>
    <Card style={[styles.route, !data.steps.length && styles.freeRoute]}>{data.validPoints ? <Text style={{ color: theme.colors.textSecondary }}>Percurso gravado · {data.validPoints} pontos válidos</Text> : <><Text style={[styles.routeTitle, { color: theme.colors.highlight }]}>SEM PERCURSO PARA EXIBIR</Text><Text style={{ color: theme.colors.textSecondary }}>Nenhum ponto de GPS válido foi registrado nesta atividade, então o mapa não é exibido. O tempo gravado é mantido.</Text></>}</Card>
    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>SPLITS</Text><ActivitySplits splits={data.validPoints > 0 ? data.splits : []} />
    {data.steps.length ? <View><View style={styles.stepHeader}><Text style={[styles.section, { color: theme.colors.textSecondary }]}>ETAPAS EXECUTADAS · {data.steps.length}</Text>{data.steps.length > 3 ? <Pressable onPress={() => setShowAllSteps(value => !value)}><Text style={{ color: theme.colors.action }}>{showAllSteps ? 'Ver menos' : 'Ver todas'}</Text></Pressable> : null}</View>
      {shownSteps.map(step => <View key={step.id} style={[styles.step, step.status_slug === 'not_performed' && styles.dimmed, { backgroundColor: theme.colors.surface }]}><Text style={[styles.stepName, { color: theme.colors.text }]}>{step.step_type_name}{step.repetition_index > 1 ? ` ${step.repetition_index}` : ''}</Text><Text style={{ color: theme.colors.textSecondary }}>{step.status_slug === 'skipped' ? `${formatDuration(step.actual_duration_seconds)}/${formatDuration(step.planned_duration_seconds)}` : formatDuration(step.status_slug === 'not_performed' ? step.planned_duration_seconds : step.actual_duration_seconds)}</Text><Text style={{ color: step.status_slug === 'completed' ? theme.colors.confirmation : step.status_slug === 'skipped' ? theme.colors.highlight : theme.colors.textSecondary }}>{STATUS[step.status_slug]}</Text></View>)}
    </View> : null}
    <View style={styles.actions}><Button onPress={() => router.push(routes.rpe)}>Avaliar esforço</Button><Button onPress={() => setDiscardVisible(true)} variant="destructive-outline">Descartar atividade</Button></View>
    <ConfirmDialog visible={discardVisible} title="Descartar esta atividade?" message="A atividade, os pontos de GPS e os splits serão apagados definitivamente. Não é possível desfazer." summary={<View style={styles.summary}>{summary.map(value => <Text key={value} style={{ color: theme.colors.text }}>{value}</Text>)}</View>} confirmLabel="Descartar" destructive onCancel={() => setDiscardVisible(false)} onConfirm={() => { void confirmDiscard(); }} />
  </Screen>;
}

const styles = StyleSheet.create({ subtitle: { fontSize: 16, marginBottom: 24 }, highlights: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }, right: { alignItems: 'flex-end' }, big: { fontSize: 38, fontVariant: ['tabular-nums'] }, label: { color: '#8E7D6B', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }, route: { marginTop: 20, minHeight: 120, padding: 18 }, freeRoute: { minHeight: 210 }, routeTitle: { fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }, section: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginTop: 28 }, stepHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }, step: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, marginBottom: 8, minHeight: 54, paddingHorizontal: 14 }, stepName: { flex: 1, fontWeight: '600' }, dimmed: { opacity: 0.5 }, actions: { gap: 10, marginTop: 28 }, summary: { flexDirection: 'row', justifyContent: 'space-between' } });
