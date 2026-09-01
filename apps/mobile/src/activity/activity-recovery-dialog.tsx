import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';

import { useActivity } from './activity-context';
import { formatActivityDistance, formatActivityTime } from './presentation';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatRecoveryStart(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function ActivityRecoveryDialog() {
  const theme = useTheme();
  const router = useRouter();
  const activity = useActivity();
  const [working, setWorking] = useState(false);
  const pending = activity.pendingRecovery;
  if (!pending) return null;

  const resume = async () => {
    if (working) return;
    setWorking(true);
    try {
      await activity.resumeInterrupted();
      router.replace(pending.activityType === 'structured' ? '/structured-activity' as Href : routes.activity);
    } finally { setWorking(false); }
  };
  const finish = async () => {
    if (working) return;
    setWorking(true);
    try {
      await activity.finishInterrupted();
      router.replace(routes.activityResult);
    } finally { setWorking(false); }
  };

  return <Modal animationType="fade" onRequestClose={() => undefined} transparent visible>
    <View style={styles.scrim} testID="activity-recovery-dialog">
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.badge, { color: theme.colors.highlight, fontFamily: theme.fonts.data.bold }]}>● ATIVIDADE NÃO FINALIZADA</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.bold }]}>Você tem uma corrida interrompida</Text>
        <Text style={[styles.copy, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>O app foi encerrado durante a atividade. Tudo que havia sido gravado até ali está salvo.</Text>
        <View style={[styles.metrics, { backgroundColor: theme.colors.surfaceElevated }]}>
          <RecoveryRow label="Iniciada" value={formatRecoveryStart(pending.startedAt)} />
          <RecoveryRow label="Distância" value={formatActivityDistance(pending.distance)} />
          <RecoveryRow label="Tempo" value={formatActivityTime(pending.elapsed)} />
          {pending.activityType === 'structured' && pending.currentStep ? <RecoveryRow label="Etapa" value={`${pending.currentStep.name} · ${pending.currentStep.position} de ${pending.currentStep.total}`} /> : null}
        </View>
        <View style={styles.actions}><Button disabled={working} onPress={() => void resume()}>Retomar atividade</Button><Button disabled={working} onPress={() => void finish()} variant="secondary">Finalizar com o que foi gravado</Button></View>
      </View>
    </View>
  </Modal>;
}

function RecoveryRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={styles.row}><Text style={[styles.metricText, { color: theme.colors.text, fontFamily: theme.fonts.data.semibold }]}>{label}</Text><Text style={[styles.metricValue, { color: theme.colors.text, fontFamily: theme.fonts.data.semibold }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  scrim: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.82)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 24, borderWidth: 1, maxWidth: 520, padding: 28, width: '100%' },
  badge: { fontSize: 13, letterSpacing: 1.8 }, title: { fontSize: 34, lineHeight: 40, marginTop: 22 },
  copy: { fontSize: 17, lineHeight: 25, marginTop: 18 }, metrics: { borderRadius: 16, gap: 10, marginTop: 24, padding: 18 },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' }, metricText: { fontSize: 15 }, metricValue: { flexShrink: 1, fontSize: 15, textAlign: 'right' },
  actions: { gap: 12, marginTop: 28 },
});
