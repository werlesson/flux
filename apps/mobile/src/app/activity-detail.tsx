import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resultMetrics } from '@/activity/result';
import { ActivitySplits } from '@/components/activity-splits';
import { ActivityRouteMap, Button, Card, ConfirmDialog, MetricGrid, MetricTile, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository } from '@/database/repositories/activity-points';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { ActivityStepsRepository, type ActivityStepResult } from '@/database/repositories/activity-steps';
import type { Activity, ActivityPoint, ActivitySplit, StepExecutionStatusSlug } from '@/database/types';
import { activityOrigin, partialDistanceMeters, perceivedEffort, stepCountSummary, type StepCounts } from '@/history/presentation';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';
import { formatDateTime, formatDistance, formatDuration } from '@/utils/formatters';

type DetailData = { activity: Activity; points: ActivityPoint[]; splits: ActivitySplit[]; steps: ActivityStepResult[]; counts: StepCounts };
const STATUS: Record<StepExecutionStatusSlug, string> = { completed: 'Concluída', skipped: 'Pulada', not_performed: 'Não realizada' };

export default function ActivityDetailScreen() {
  const { activityId } = useLocalSearchParams<{ activityId?: string }>();
  const id = Number(activityId);
  const router = useRouter(); const theme = useTheme();
  const [data, setData] = useState<DetailData | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false); const [showAllSteps, setShowAllSteps] = useState(false);
  useFocusEffect(useCallback(() => { let active = true; if (!Number.isInteger(id) || id <= 0) return () => { active = false; };
    void initializeDatabase().then(async database => { const activity = await new ActivitiesRepository(database).buscarPorId(id); if (!activity || activity.finished_at === null) return null; const stepsRepository = new ActivityStepsRepository(database); const [points, splits, steps, counts] = await Promise.all([new ActivityPointsRepository(database).listarValidos(id), new ActivitySplitsRepository(database).listar(id), stepsRepository.listarResultado(id), stepsRepository.contarPorStatus(id)]); return { activity, points, splits, steps, counts }; }).then(result => { if (active) setData(result); });
    return () => { active = false; }; }, [id]));
  const editEvaluation = () => router.push({ pathname: routes.rpe, params: { activityId: id, mode: 'edit' } });
  async function confirmDelete() { const database = await initializeDatabase(); await new ActivitiesRepository(database).excluir(id); setDeleteVisible(false); router.back(); }
  if (!data) return <Screen canGoBack title="Detalhe da atividade"><Text style={{ color: theme.colors.textSecondary }}>Carregando atividade…</Text></Screen>;
  const metrics = resultMetrics(data.activity, data.points.length > 0); const counts = stepCountSummary(data.counts); const effort = perceivedEffort(data.activity); const partial = data.steps.length === 0 ? partialDistanceMeters(data.activity) : 0;
  return <Screen canGoBack headerAction={<Pressable accessibilityRole="button" onPress={() => setDeleteVisible(true)}><Text style={{ color: theme.colors.destructive, fontWeight: '700' }}>Excluir</Text></Pressable>} title={formatDateTime(data.activity.started_at, 'detail')}>
    <Text style={[styles.origin, { color: theme.colors.textSecondary }]}>{activityOrigin(data.activity)}</Text>
    <View style={styles.highlights}><View><Text style={[styles.big, { color: theme.colors.text }]}>{metrics.distance}</Text><Text style={styles.label}>DISTÂNCIA</Text></View><View style={styles.right}><Text style={[styles.big, { color: theme.colors.text }]}>{metrics.elapsed}</Text><Text style={styles.label}>TEMPO TOTAL</Text></View></View>
    <MetricGrid><MetricTile label="PACE MÉDIO" value={metrics.averagePace} /><MetricTile label="MELHOR KM" value={metrics.bestPace} /><MetricTile label="TEMPO CORRENDO" value={metrics.moving} /><MetricTile label="TEMPO CAMINHANDO" value={metrics.stopped} /></MetricGrid>
    {data.points.length ? <ActivityRouteMap points={data.points} /> : <Card style={styles.route}><Text style={[styles.routeTitle, { color: theme.colors.highlight }]}>SEM PERCURSO PARA EXIBIR</Text><Text style={{ color: theme.colors.textSecondary }}>Nenhum ponto de GPS válido foi registrado nesta atividade, então o mapa não é exibido.</Text></Card>}
    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>SPLITS</Text><ActivitySplits splits={data.points.length > 0 ? data.splits : []} />
    {partial > 0 ? <Card style={styles.partial}><Text style={{ color: theme.colors.text }}>{formatDistance(partial)} · sem split</Text></Card> : null}
    {data.steps.length ? <View><View style={styles.stepHeader}><Text style={[styles.section, { color: theme.colors.textSecondary }]}>ETAPAS EXECUTADAS · {counts.total}</Text><Pressable onPress={() => setShowAllSteps(value => !value)}><Text style={{ color: theme.colors.action }}>{showAllSteps ? 'Ocultar' : 'Ver todas'}</Text></Pressable></View><Text style={[styles.counts, { color: theme.colors.textSecondary }]}>{counts.labels.join(' · ')}</Text>{showAllSteps ? data.steps.map(step => <View key={step.id} style={[styles.step, { backgroundColor: theme.colors.surface }]}><Text style={[styles.stepName, { color: theme.colors.text }]}>{step.step_type_name}</Text><Text style={{ color: theme.colors.textSecondary }}>{formatDuration(step.actual_duration_seconds)}</Text><Text style={{ color: step.status_slug === 'completed' ? theme.colors.confirmation : step.status_slug === 'skipped' ? theme.colors.highlight : theme.colors.textSecondary }}>{STATUS[step.status_slug]}</Text></View>) : null}</View> : null}
    {effort ? <Card style={styles.effort}><View style={styles.effortHeader}><Text style={[styles.sectionInline, { color: theme.colors.textSecondary }]}>ESFORÇO PERCEBIDO</Text><Pressable onPress={editEvaluation}><Text style={{ color: theme.colors.action }}>Editar</Text></Pressable></View><Text style={[styles.effortValue, { color: theme.colors.text }]}>{effort.value}</Text><Text style={{ color: theme.colors.textSecondary }}>{effort.range}</Text>{effort.notes ? <Text style={[styles.notes, { color: theme.colors.text }]}>{effort.notes}</Text> : null}</Card> : <Card style={[styles.effort, { backgroundColor: '#FDF3E0', borderColor: '#D8B45A' }]}><Text style={styles.pendingTitle}>PENDENTE DE AVALIAÇÃO</Text><Text style={styles.pendingCopy}>Esta atividade foi salva sem esforço percebido. Você pode preencher agora — as métricas objetivas não mudam.</Text><Button onPress={editEvaluation}>Avaliar esforço</Button></Card>}
    <ConfirmDialog visible={deleteVisible} title="Excluir esta atividade?" message="Os pontos de GPS e os splits também serão apagados. Não é possível desfazer." confirmLabel="Excluir" destructive onCancel={() => setDeleteVisible(false)} onConfirm={() => { void confirmDelete(); }} />
  </Screen>;
}
const styles = StyleSheet.create({ origin: { fontSize: 16, marginBottom: 24 }, highlights: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }, right: { alignItems: 'flex-end' }, big: { fontSize: 38, fontVariant: ['tabular-nums'] }, label: { color: '#8E7D6B', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }, route: { marginTop: 20, minHeight: 120, padding: 18 }, routeTitle: { fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }, section: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginTop: 28 }, partial: { marginTop: 8, padding: 14 }, stepHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' }, counts: { marginBottom: 12, marginTop: 8 }, step: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, marginBottom: 8, minHeight: 54, paddingHorizontal: 14 }, stepName: { flex: 1, fontWeight: '600' }, effort: { marginTop: 28, padding: 18 }, effortHeader: { flexDirection: 'row', justifyContent: 'space-between' }, sectionInline: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5 }, effortValue: { fontSize: 32, fontWeight: '700', marginTop: 16 }, notes: { fontSize: 16, lineHeight: 23, marginTop: 16 }, pendingTitle: { color: '#9A6B00', fontSize: 13, fontWeight: '700', letterSpacing: 1.3 }, pendingCopy: { color: '#6F5315', fontSize: 16, lineHeight: 23, marginBottom: 18, marginTop: 10 } });
