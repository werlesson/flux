import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, spacing, tabularMetric } from '@/constants/theme';
import type { ActivitySplit } from '@/database/types';
import { initializeDatabase } from '@/database';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/utils/formatters';

export interface PresentedActivitySplit extends ActivitySplit { isBest: boolean }

export function presentActivitySplits(splits: readonly ActivitySplit[]): PresentedActivitySplit[] {
  const best = splits.length ? Math.min(...splits.map(split => split.pace_seconds_per_km)) : null;
  return [...splits].sort((a, b) => a.kilometer - b.kilometer).map(split => ({ ...split, isBest: split.pace_seconds_per_km === best }));
}

export function ActivitySplits({ splits }: { splits: readonly ActivitySplit[] }) {
  const theme = useTheme();
  const presented = presentActivitySplits(splits);
  if (!presented.length) return <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>Nenhum quilômetro completo.</Text>;
  const longest = Math.max(...presented.map(split => split.duration_seconds));
  return <View>{presented.map(split => <View key={split.id} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
    <View style={[styles.bar, { backgroundColor: split.isBest ? theme.colors.highlight : theme.colors.border, width: `${Math.max(12, (split.duration_seconds / longest) * 100)}%` }]} />
    <Text style={[styles.kilometer, { color: split.isBest ? theme.colors.highlight : theme.colors.text }]}>KM {split.kilometer}</Text>
    <Text style={[styles.pace, { color: split.isBest ? theme.colors.highlight : theme.colors.text }]}>{formatDuration(split.duration_seconds)}</Text>
  </View>)}</View>;
}

/** Fonte compartilhada pela tela de resultado e pelo detalhe do historico. */
export function PersistedActivitySplits({ activityId }: { activityId: number | null }) {
  const [splits, setSplits] = useState<ActivitySplit[]>([]);
  useEffect(() => {
    let active = true;
    if (activityId === null) { setSplits([]); return () => { active = false; }; }
    void initializeDatabase().then(database => new ActivitySplitsRepository(database).listar(activityId)).then(rows => { if (active) setSplits(rows); });
    return () => { active = false; };
  }, [activityId]);
  return <ActivitySplits splits={splits} />;
}

const styles = StyleSheet.create({
  empty: { fontFamily: fonts.title.regular, paddingVertical: spacing.lg },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  bar: { bottom: 3, left: 0, opacity: 0.12, position: 'absolute', top: 3 },
  kilometer: { fontFamily: fonts.data.semibold, fontSize: 12 },
  pace: { ...tabularMetric, fontFamily: fonts.data.semibold, fontSize: 18 },
});
