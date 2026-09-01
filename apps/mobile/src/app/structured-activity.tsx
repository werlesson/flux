import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { createActionGuard, formatActivityDistance, formatActivityPace, formatActivityTime, signalQualityToGpsStatus } from '@/activity/presentation';
import { Button, GpsStatusPill, Screen } from '@/components';
import { colors, fontSizes, tabularMetric, type StepTypeSlug } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';
import { formatDuration } from '@/utils/formatters';

export default function StructuredActivityScreen() {
  const activity = useActivity(); const theme = useTheme(); const router = useRouter(); const guard = useRef(createActionGuard()).current; const completionHandled = useRef(false); const paused = activity.status === 'paused'; const step = activity.currentStep;
  useEffect(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', () => true); return () => subscription.remove(); }, []);
  const finish = () => guard(async () => { await activity.finish(); router.replace(routes.activityResult); });
  useEffect(() => { if (!activity.trainingFinished || completionHandled.current) return; completionHandled.current = true; void finish(); }, [activity.trainingFinished]);
  const accent = paused ? theme.colors.highlight : step ? colors.step[step.slug as StepTypeSlug] ?? theme.colors.action : theme.colors.action;
  const progress = step ? Math.min(1, step.actualDurationSeconds / step.plannedDurationSeconds) : 1;

  return <Screen scrollable testID="structured-activity-screen"><View style={styles.content}>
    <View style={styles.headingRow}><Text style={[styles.eyebrow, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.semibold }]}>{(activity.trainingName ?? 'TREINO ESTRUTURADO').toLocaleUpperCase('pt-BR')}</Text>{step && step.repeatCount > 1 ? <Text style={[styles.repetition, { color: theme.colors.text, fontFamily: theme.fonts.data.semibold }]}>{step.repetitionIndex} de {step.repeatCount}</Text> : null}{paused ? <Text style={[styles.pausedBadge, { borderColor: theme.colors.highlight, color: theme.colors.highlight }]}>PAUSADA</Text> : null}</View>
    <View style={[styles.currentCard, { backgroundColor: paused ? '#FDF3E0' : '#FDEDE7', borderColor: accent }]}>
      <View style={styles.cardHeading}><Text style={[styles.stepType, { color: accent, fontFamily: theme.fonts.title.semibold }]}>{step?.name ?? 'Treino concluído'}</Text><Text style={[styles.cardLabel, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>{paused ? 'ETAPA CONGELADA' : 'ETAPA ATUAL'}</Text></View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.remaining, tabularMetric, { color: theme.colors.text }]}>{formatDuration(step?.remainingSeconds ?? 0)}</Text>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}><View testID="step-progress" style={[styles.progressFill, { backgroundColor: accent, width: `${progress * 100}%` }]} /></View>
      <Text style={[styles.legend, { color: theme.colors.textSecondary }]}>{paused ? 'o motor de treino não avança em pausa' : 'restam nesta etapa'}</Text>
      {step?.instructions ? <Text style={[styles.instructions, { color: theme.colors.text }]}>{step.instructions}</Text> : null}
    </View>
    <View style={[styles.nextCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>{step?.next ? <><Text style={[styles.nextLabel, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>PRÓXIMA</Text><View style={styles.nextRow}><Text style={[styles.nextName, { color: theme.colors.text }]}>{step.next.name}</Text><Text style={[styles.nextDuration, tabularMetric, { color: theme.colors.text }]}>{formatDuration(step.next.plannedDurationSeconds)}</Text></View></> : <Text style={[styles.lastStep, { color: theme.colors.text }]}>Última etapa do treino</Text>}</View>
    <View style={styles.metrics}><Metric label="TEMPO TOTAL" value={formatActivityTime(activity.elapsed)} /><Metric label={activity.signalQuality === 'sem_sinal' ? 'DISTÂNCIA · SEM AVANÇAR' : 'DISTÂNCIA'} value={formatActivityDistance(activity.distance)} /><Metric label="PACE MÉDIO" value={formatActivityPace(activity.averagePace)} /></View>
    {paused ? <View style={styles.actions}><View style={styles.action}><Button onPress={() => void guard(activity.resume)}>RETOMAR</Button></View><View style={styles.action}><Button variant="destructive-outline" onPress={() => void finish()}>FINALIZAR TREINO</Button></View></View> : <View style={styles.actions}><View style={styles.action}><Button variant="secondary" onPress={() => void guard(activity.skipTrainingStep)}>PULAR ETAPA</Button></View><View style={styles.action}><Button onPress={() => void guard(activity.pause)}>PAUSAR</Button></View></View>}
    <GpsStatusPill status={signalQualityToGpsStatus(activity.signalQuality)} />
  </View></Screen>;
}
function Metric({ label, value }: { label: string; value: string }) { const theme = useTheme(); return <View style={styles.metric}><Text style={[styles.metricLabel, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, tabularMetric, { color: theme.colors.text }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ content: { flex: 1, paddingBottom: 8 }, headingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 12 }, eyebrow: { flex: 1, fontSize: 12, letterSpacing: 1.7 }, repetition: { fontSize: 14 }, pausedBadge: { borderRadius: 999, borderWidth: 1, fontSize: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 }, currentCard: { borderRadius: 20, borderWidth: 2, marginTop: 16, padding: 18 }, cardHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, stepType: { fontSize: 25 }, cardLabel: { fontSize: 10, letterSpacing: 1.5 }, remaining: { fontSize: fontSizes.activityStepRemaining, letterSpacing: -4, lineHeight: fontSizes.activityStepRemaining + 6, marginTop: 4, textAlign: 'center' }, progressTrack: { borderRadius: 4, height: 7, marginTop: 8, overflow: 'hidden' }, progressFill: { borderRadius: 4, height: 7 }, legend: { fontSize: 14, marginTop: 8, textAlign: 'center' }, instructions: { fontSize: 17, lineHeight: 23, marginTop: 14, textAlign: 'center' }, nextCard: { borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 16 }, nextLabel: { fontSize: 10, letterSpacing: 1.6 }, nextRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }, nextName: { fontSize: 20 }, nextDuration: { fontSize: 19 }, lastStep: { fontSize: 18, textAlign: 'center' }, metrics: { flexDirection: 'row', gap: 8, marginTop: 18 }, metric: { flex: 1 }, metricLabel: { fontSize: 9, letterSpacing: 1 }, metricValue: { fontSize: 17, marginTop: 4 }, actions: { flexDirection: 'row', gap: 10, marginTop: 22 }, action: { flex: 1 } });
