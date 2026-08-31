import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { createActionGuard, formatActivityDistance, formatActivityPace, formatActivityTime, signalQualityToGpsStatus } from '@/activity/presentation';
import { Button, GpsStatusPill, Screen } from '@/components';
import { fontSizes, tabularMetric } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';

export default function ActivityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const activity = useActivity();
  const guard = useRef(createActionGuard()).current;
  const paused = activity.status === 'paused';
  const noSignal = activity.signalQuality === 'sem_sinal';

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const finish = () => guard(async () => { await activity.finish(); router.replace(routes.activityResult); });
  return <Screen scrollable={false} testID="free-run-activity-screen">
    <View style={styles.content}>
      <View style={styles.contextRow}><Text style={[styles.context, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.semibold }]}>CORRIDA LIVRE</Text>{paused ? <Text style={[styles.pausedBadge, { borderColor: theme.colors.highlight, color: theme.colors.highlight }]}>PAUSADA</Text> : null}<View style={styles.contextSpacer} /><Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.replace(routes.home)}><Text style={[styles.homeLink, { color: theme.colors.textSecondary }]}>Início</Text></Pressable></View>
      <Metric label={paused ? 'TEMPO · PARADO' : 'TEMPO'} value={formatActivityTime(activity.elapsed)} color={paused ? theme.colors.highlight : theme.colors.text} size="time" />
      <Metric label={noSignal ? 'DISTÂNCIA · SEM AVANÇAR' : 'DISTÂNCIA'} value={formatActivityDistance(activity.distance)} color={noSignal ? theme.colors.textSecondary : theme.colors.text} size="distance" />
      <View style={styles.paces}><Pace label="Pace atual" value={paused || noSignal ? '—' : formatActivityPace(activity.currentPace)} /><Pace label="Pace médio" value={formatActivityPace(activity.averagePace)} /></View>
      <View style={styles.spacer} />
      {paused ? <View style={styles.pausedActions}><Button onPress={() => void guard(activity.resume)}>RETOMAR</Button><Button variant="destructive-outline" onPress={() => void finish()}>FINALIZAR</Button></View> : <Button activity onPress={() => void guard(activity.pause)}>PAUSAR</Button>}
      <GpsStatusPill status={signalQualityToGpsStatus(activity.signalQuality)} />
    </View>
  </Screen>;
}

function Metric({ label, value, color, size }: { label: string; value: string; color: string; size: 'time' | 'distance' }) {
  const theme = useTheme();
  return <View style={styles.metric}><Text style={[styles.metricLabel, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, size === 'time' ? styles.time : styles.distance, tabularMetric, { color }]}>{value}</Text></View>;
}

function Pace({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={styles.paceRow}><Text style={[styles.paceLabel, { color: theme.colors.textSecondary }]}>{label}</Text><Text style={[styles.paceValue, tabularMetric, { color: theme.colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({ content: { flex: 1, paddingBottom: 12 }, contextRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 12 }, context: { fontSize: 13, letterSpacing: 2 }, contextSpacer: { flex: 1 }, homeLink: { fontSize: 15, textDecorationLine: 'underline' }, pausedBadge: { borderRadius: 999, borderWidth: 1, fontSize: 11, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 }, metric: { marginTop: 22 }, metricLabel: { fontSize: 11, letterSpacing: 1.8, marginBottom: 3 }, metricValue: { letterSpacing: -3 }, time: { fontSize: fontSizes.activityTime, lineHeight: fontSizes.activityTime }, distance: { fontSize: fontSizes.activityDistance, lineHeight: fontSizes.activityDistance }, paces: { gap: 10, marginTop: 20 }, paceRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' }, paceLabel: { fontSize: 17 }, paceValue: { fontSize: 20 }, spacer: { flex: 1, minHeight: 16 }, pausedActions: { gap: 10 }, });
