import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useActivity } from '@/activity/activity-context';
import { createActionGuard, formatActivityDistance, formatActivityPace, formatActivityTime } from '@/activity/presentation';
import { Button, Card, Screen } from '@/components';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';

export default function StructuredActivityScreen() {
  const activity = useActivity(); const theme = useTheme(); const router = useRouter(); const paused = activity.status === 'paused';
  const finish = () => createActionGuard()(async () => { await activity.finish(); router.replace(routes.activityResult); });
  return <Screen scrollable={false} testID="structured-activity-screen"><View style={styles.content}><Text style={[styles.eyebrow, { color: theme.colors.textSecondary }]}>TREINO ESTRUTURADO</Text><Card style={styles.step}><Text style={{ color: theme.colors.textSecondary }}>ETAPA ATUAL</Text><Text style={[styles.stepName, { color: theme.colors.text }]}>{activity.currentStep?.name ?? 'Treino concluído'}</Text><Text style={{ color: theme.colors.textSecondary }}>{activity.currentStep ? `${activity.currentStep.position} de ${activity.currentStep.total}` : ''}</Text></Card><Text style={[styles.time, { color: theme.colors.text }]}>{formatActivityTime(activity.elapsed)}</Text><Text style={[styles.distance, { color: theme.colors.text }]}>{formatActivityDistance(activity.distance)}</Text><View style={styles.paces}><Text style={{ color: theme.colors.textSecondary }}>Pace atual  {formatActivityPace(activity.currentPace)}</Text><Text style={{ color: theme.colors.textSecondary }}>Pace médio  {formatActivityPace(activity.averagePace)}</Text></View><View style={styles.spacer} />{paused ? <View style={styles.actions}><Button onPress={() => void activity.resume()}>RETOMAR</Button><Button variant="destructive-outline" onPress={() => void finish()}>FINALIZAR</Button></View> : <Button activity onPress={() => void activity.pause()}>PAUSAR</Button>}</View></Screen>;
}
const styles = StyleSheet.create({ content: { flex: 1 }, eyebrow: { letterSpacing: 2, marginTop: 12 }, step: { marginTop: 20, padding: 18 }, stepName: { fontSize: 28, marginVertical: 6 }, time: { fontSize: 64, marginTop: 28 }, distance: { fontSize: 44, marginTop: 12 }, paces: { gap: 8, marginTop: 18 }, spacer: { flex: 1 }, actions: { gap: 10 } });
