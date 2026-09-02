import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, GpsInspectionReportView, GpsPurgePanel, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository, type InspectedActivityPoint } from '@/database/repositories/activity-points';
import { LookupRepository } from '@/database/repositories/lookups';
import type { Activity, GpsRejectionReasonSlug } from '@/database/types';
import { buildGpsInspectionReport, gpsRejectionReasonOrder, inspectionRouteCoordinates } from '@/gps/inspection';
import { useTheme } from '@/hooks/use-theme';
import { isDevelopmentBuild } from '@/utils/environment';
import { formatDateTime, formatDistance } from '@/utils/formatters';

type ReasonLabels = Record<GpsRejectionReasonSlug, string>;
interface InspectorData { activities: Activity[]; labels: ReasonLabels }

export default function GpsInspectorScreen() {
  const theme = useTheme();
  const [data, setData] = useState<InspectorData | null>(null);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [points, setPoints] = useState<InspectedActivityPoint[]>([]);
  const [includeRejected, setIncludeRejected] = useState(false);
  const available = isDevelopmentBuild();

  const loadPoints = useCallback(async (activity: Activity) => {
    const database = await initializeDatabase();
    setPoints(await new ActivityPointsRepository(database).listarParaInspecao(activity.id));
  }, []);

  useFocusEffect(useCallback(() => {
    if (!available) return;
    let active = true;
    void initializeDatabase().then(async database => {
      const activities = await new ActivitiesRepository(database).listarFinalizadas();
      const lookups = new LookupRepository(database);
      const entries = await Promise.all(gpsRejectionReasonOrder.map(async slug => [slug, (await lookups.porSlug('gps_rejection_reasons', slug)).name] as const));
      return { activities, labels: Object.fromEntries(entries) as ReasonLabels };
    }).then(value => { if (active) setData(value); });
    return () => { active = false; };
  }, [available]));

  const report = useMemo(() => buildGpsInspectionReport(points), [points]);
  const coordinates = useMemo(() => inspectionRouteCoordinates(points, includeRejected), [points, includeRejected]);

  async function selectActivity(activity: Activity) {
    setSelected(activity); setIncludeRejected(false); await loadPoints(activity);
  }

  /** O painel só chama isto depois da confirmação digitada e do diálogo; aqui só resta reler o que sobrou. */
  async function purgeRejected(activity: Activity) {
    const database = await initializeDatabase();
    await new ActivityPointsRepository(database).expurgarRejeitados(activity.id);
    await loadPoints(activity);
  }

  if (!available) {
    return <Screen canGoBack title="Inspeção do GPS">
      <Card style={styles.card}>
        <Text style={[styles.eyebrow, { color: theme.colors.highlight }]}>FERRAMENTA DE DESENVOLVIMENTO</Text>
        <Text style={{ color: theme.colors.text }}>A inspeção do GPS existe apenas no development build e não faz parte do app distribuído.</Text>
      </Card>
    </Screen>;
  }

  return <Screen canGoBack title="Inspeção do GPS">
    <Text style={[styles.eyebrow, { color: theme.colors.highlight }]}>FERRAMENTA DE DESENVOLVIMENTO</Text>
    <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>Contagem de pontos rejeitados por motivo, distribuição de accuracy dos aceitos e comparação do percurso com e sem os descartes.</Text>
    {data === null ? <Text style={{ color: theme.colors.textSecondary }}>Carregando atividades…</Text> : null}
    {data !== null && data.activities.length === 0 ? <Text style={{ color: theme.colors.textSecondary }}>Nenhuma atividade finalizada para inspecionar.</Text> : null}
    {data?.activities.map(activity => <Card
      key={activity.id}
      accessibilityLabel={`Inspecionar atividade de ${formatDateTime(activity.started_at, 'detail')}`}
      onPress={() => { void selectActivity(activity); }}
      style={[styles.activity, selected?.id === activity.id ? { borderColor: theme.colors.action } : null]}
    >
      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{formatDateTime(activity.started_at, 'detail')}</Text>
      <Text style={{ color: theme.colors.textSecondary }}>{formatDistance(activity.distance_meters)} · atividade #{activity.id}</Text>
    </Card>)}
    {selected && data ? <View>
      <GpsInspectionReportView
        coordinates={coordinates}
        includeRejected={includeRejected}
        labels={data.labels}
        onToggleRejected={setIncludeRejected}
        report={report}
      />
      <GpsPurgePanel onPurge={() => purgeRejected(selected)} rejectedPoints={report.rejectedPoints} />
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 16, marginTop: 8 },
  activity: { marginBottom: 8, padding: 16 },
});
