import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { formatActivityDistance, formatActivityPace, formatActivityTime } from '@/activity/presentation';
import { PersistedActivitySplits } from '@/components/activity-splits';
import { Button, Card, MetricGrid, MetricTile, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityStepsRepository } from '@/database/repositories/activity-steps';
import type { Activity } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';

type ResultData = { activity: Activity; validPoints: number; stepCount: number };
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function formatStartedAt(date: Date) { return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }

export default function ActivityResultScreen() {
  const { activityId } = useActivity(); const theme = useTheme(); const [data, setData] = useState<ResultData | null>(null);
  useEffect(() => { let active = true; if (activityId === null) return () => { active = false; }; void initializeDatabase().then(async db => {
    const activity = await new ActivitiesRepository(db).buscarPorId(activityId); if (!activity) return null;
    const [{ count: validPoints }] = await db.all<{ count: number }>('SELECT COUNT(*) count FROM activity_points WHERE activity_id=? AND is_valid=1', [activityId]);
    const steps = await new ActivityStepsRepository(db).listar(activityId); return { activity, validPoints, stepCount: steps.length };
  }).then(value => { if (active && value) setData(value); }); return () => { active = false; }; }, [activityId]);
  if (!data) return <Screen canGoBack title="Atividade concluída"><Text style={{ color: theme.colors.textSecondary }}>Carregando atividade…</Text></Screen>;
  const { activity } = data; const walking = Math.max(0, activity.elapsed_duration_seconds - activity.moving_duration_seconds);
  return <Screen canGoBack title="Atividade concluída">
    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{activity.training_session_name ?? 'Corrida livre'} · {formatStartedAt(activity.started_at)}</Text>
    <View style={styles.highlights}><View><Text style={[styles.big, { color: theme.colors.text }]}>{formatActivityDistance(activity.distance_meters)}</Text><Text style={{ color: theme.colors.textSecondary }}>DISTÂNCIA</Text></View><View><Text style={[styles.big, { color: theme.colors.text }]}>{formatActivityTime(activity.elapsed_duration_seconds)}</Text><Text style={{ color: theme.colors.textSecondary }}>TEMPO TOTAL</Text></View></View>
    <MetricGrid><MetricTile label="PACE MÉDIO" value={formatActivityPace(activity.average_pace_seconds_per_km)} /><MetricTile label="MELHOR KM" value={formatActivityPace(activity.best_pace_seconds_per_km)} /><MetricTile label="TEMPO CORRENDO" value={formatActivityTime(activity.moving_duration_seconds)} /><MetricTile label="TEMPO CAMINHANDO" value={formatActivityTime(walking)} /></MetricGrid>
    <Card style={styles.route}>{data.validPoints ? <Text style={{ color: theme.colors.textSecondary }}>Percurso gravado · {data.validPoints} pontos válidos</Text> : <><Text style={[styles.routeTitle, { color: theme.colors.text }]}>SEM PERCURSO PARA EXIBIR</Text><Text style={{ color: theme.colors.textSecondary }}>Nenhum ponto de GPS válido foi registrado nesta atividade, então o mapa não é exibido. O tempo gravado é mantido.</Text></>}</Card>
    <Text style={[styles.section, { color: theme.colors.text }]}>SPLITS</Text><PersistedActivitySplits activityId={activityId} />
    {data.stepCount ? <Text style={[styles.section, { color: theme.colors.text }]}>ETAPAS EXECUTADAS · {data.stepCount}</Text> : null}
    <View style={styles.actions}><Button>Avaliar esforço</Button><Button variant="destructive-outline">Descartar atividade</Button></View>
  </Screen>;
}
const styles = StyleSheet.create({ subtitle: { fontSize: 16, marginBottom: 24 }, highlights: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }, big: { fontSize: 38 }, route: { marginTop: 20, padding: 18 }, routeTitle: { fontWeight: '700', marginBottom: 8 }, section: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginTop: 28 }, actions: { gap: 10, marginTop: 28 } });
