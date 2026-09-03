import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GpsRejectionReasonSlug } from '@/database/types';
import type { AccuracyBucket, GpsInspectionReport, InspectionRouteCoordinate, StepDistribution } from '@/gps/inspection';
import { useTheme } from '@/hooks/use-theme';

import { ActivityRouteMap } from './activity-route-map';
import { MetricGrid, MetricTile } from './metrics';

export interface GpsInspectionReportViewProps {
  report: GpsInspectionReport;
  labels: Record<GpsRejectionReasonSlug, string>;
  coordinates: InspectionRouteCoordinate[];
  includeRejected: boolean;
  onToggleRejected: (includeRejected: boolean) => void;
}

export function formatMeters(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} m`;
}

export function formatShare(share: number): string {
  return `${(share * 100).toFixed(1).replace('.', ',')}%`;
}

export function formatSpeed(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} m/s`;
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} s`;
}

export function bucketLabel(bucket: AccuracyBucket, index: number, edges: readonly number[]): string {
  const lower = index === 0 ? 0 : edges[index - 1]!;
  return bucket.upperBound === null ? `> ${lower} m` : `${lower}–${bucket.upperBound} m`;
}

export function GpsInspectionReportView({ report, labels, coordinates, includeRejected, onToggleRejected }: GpsInspectionReportViewProps) {
  const theme = useTheme();
  const edges = report.accuracy ? report.accuracy.buckets.map(bucket => bucket.upperBound).filter((value): value is number => value !== null) : [];
  return <View>
    <MetricGrid>
      <MetricTile label="PONTOS COLETADOS" value={String(report.totalPoints)} />
      <MetricTile label="ACEITOS" value={String(report.acceptedPoints)} />
      <MetricTile label="REJEITADOS" value={String(report.rejectedPoints)} />
      <MetricTile label="SEGMENTOS" value={String(report.segments)} />
    </MetricGrid>

    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>REJEITADOS POR MOTIVO</Text>
    {report.rejectedPoints === 0
      ? <Text style={{ color: theme.colors.textSecondary }}>Nenhum ponto rejeitado nesta atividade.</Text>
      : report.rejections.map(item => <View key={item.reason} style={[styles.row, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{labels[item.reason]}</Text>
          <Text style={[styles.rowSlug, { color: theme.colors.textSecondary }]}>{item.reason}</Text>
        </View>
        <Text style={[styles.rowValue, { color: theme.colors.text }]}>{item.count}</Text>
        <Text style={[styles.rowShare, { color: theme.colors.textSecondary }]}>{formatShare(item.share)}</Text>
      </View>)}
    {report.rejectedWithoutReason > 0
      ? <Text style={[styles.warning, { color: theme.colors.highlight }]}>{report.rejectedWithoutReason} rejeitado(s) sem motivo gravado — dado inconsistente.</Text>
      : null}

    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>ACCURACY DOS ACEITOS</Text>
    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>É esta distribuição que baliza maxAccuracyMeters na calibração de campo.</Text>
    {report.accuracy === null
      ? <Text style={{ color: theme.colors.textSecondary }}>Nenhum ponto aceito tem accuracy registrada.</Text>
      : <View>
        <MetricGrid>
          <MetricTile label="MEDIANA" value={formatMeters(report.accuracy.median)} />
          <MetricTile label="P90" value={formatMeters(report.accuracy.p90)} />
          <MetricTile label="P95" value={formatMeters(report.accuracy.p95)} />
          <MetricTile label="MÁXIMA" value={formatMeters(report.accuracy.max)} />
          <MetricTile label="MÍNIMA" value={formatMeters(report.accuracy.min)} />
          <MetricTile label="MÉDIA" value={formatMeters(report.accuracy.mean)} />
        </MetricGrid>
        {report.accuracy.buckets.map((bucket, index) => <View key={String(bucket.upperBound)} style={[styles.row, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.rowLabel, styles.rowCopy, { color: theme.colors.text }]}>{bucketLabel(bucket, index, edges)}</Text>
          <Text style={[styles.rowValue, { color: theme.colors.text }]}>{bucket.count}</Text>
          <Text style={[styles.rowShare, { color: theme.colors.textSecondary }]}>{formatShare(bucket.share)}</Text>
        </View>)}
        {report.acceptedWithoutAccuracy > 0
          ? <Text style={[styles.warning, { color: theme.colors.highlight }]}>{report.acceptedWithoutAccuracy} aceito(s) sem accuracy ficam fora da distribuição.</Text>
          : null}
      </View>}

    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>PASSOS ENTRE ACEITOS</Text>
    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>São estes números que balizam maxPlausibleSpeedMetersPerSecond, maxPositionJumpMeters e maxSampleIntervalSeconds na calibração de campo. As transições entre segmentos ficam de fora: a lacuna de sinal não é deslocamento do corredor.</Text>
    {report.steps.count === 0
      ? <Text style={{ color: theme.colors.textSecondary }}>Não há dois aceitos em sequência no mesmo segmento — nenhum passo a medir.</Text>
      : <View>
        <StepDistributionBlock distribution={report.steps.speedMetersPerSecond} format={formatSpeed} title="VELOCIDADE" />
        <StepDistributionBlock distribution={report.steps.jumpMeters} format={formatMeters} title="SALTO" />
        <StepDistributionBlock distribution={report.steps.intervalSeconds} format={formatSeconds} title="INTERVALO" />
        <Text style={[styles.warning, { color: theme.colors.textSecondary }]}>
          {report.steps.count} passo(s) medido(s){report.steps.segmentTransitions > 0 ? ` · ${report.steps.segmentTransitions} transição(ões) de segmento fora da conta` : ''}.
        </Text>
        {report.steps.withoutPositiveInterval > 0
          ? <Text style={[styles.warning, { color: theme.colors.highlight }]}>{report.steps.withoutPositiveInterval} passo(s) sem intervalo positivo ficam fora da velocidade.</Text>
          : null}
      </View>}

    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>PERCURSO</Text>
    <View style={styles.toggle}>
      <ToggleOption active={!includeRejected} label="Só aceitos" onPress={() => onToggleRejected(false)} />
      <ToggleOption active={includeRejected} label="Com rejeitados" onPress={() => onToggleRejected(true)} />
    </View>
    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>{includeRejected ? 'Os pontos descartados voltam à linha na ordem medida: os bicos são o que o filtro removeu.' : 'Apenas os pontos que o filtro aceitou — é este o percurso exibido ao corredor.'}</Text>
    <View style={styles.map}><ActivityRouteMap coordinates={coordinates} /></View>
  </View>;
}

function StepDistributionBlock({ distribution, format, title }: { distribution: StepDistribution | null; format: (value: number) => string; title: string }) {
  const theme = useTheme();
  return <View style={styles.step}>
    <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{title}</Text>
    {distribution === null
      ? <Text style={{ color: theme.colors.textSecondary }}>Nenhum passo aproveitável para esta grandeza.</Text>
      : <MetricGrid>
        <MetricTile label="MEDIANA" value={format(distribution.median)} />
        <MetricTile label="P95" value={format(distribution.p95)} />
        <MetricTile label="MÁXIMO" value={format(distribution.max)} />
      </MetricGrid>}
  </View>;
}

function ToggleOption({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={[styles.toggleOption, { backgroundColor: active ? theme.colors.action : theme.colors.surface, borderColor: theme.colors.border }]}
  ><Text style={{ color: active ? theme.colors.background : theme.colors.text, fontWeight: '700' }}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 28 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  row: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, marginBottom: 8, minHeight: 54, paddingHorizontal: 14 },
  rowCopy: { flex: 1 }, rowLabel: { fontWeight: '600' }, rowSlug: { fontSize: 12, marginTop: 2 },
  rowValue: { fontSize: 20, fontVariant: ['tabular-nums'] }, rowShare: { fontSize: 13, minWidth: 58, textAlign: 'right' },
  warning: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  step: { marginBottom: 14 }, stepTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  toggleOption: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  map: { height: 240 },
});
