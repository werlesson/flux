import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useActivity } from '@/activity/activity-context';
import { BottomSheet, Button, Card, GpsStatusPill, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { formatTrainingCount, type HomeSummary,loadHomeSummary } from '@/home/home-summary';
import { useTheme } from '@/hooks/use-theme';
import { acquireInitialFix, type InitialFixAttempt, type InitialFixState } from '@/location/initial-fix';
import { LocationPermissions } from '@/location/permissions';
import { routes } from '@/navigation/routes';

const EMPTY_SUMMARY: HomeSummary = { latestActivity: null, trainingCount: 0 };

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { startFreeRun } = useLocalSearchParams<{ startFreeRun?: string }>();
  const activity = useActivity();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [fix, setFix] = useState<InitialFixState>({ status: 'sem_precisao_aceitavel', location: null });
  const [sheetVisible, setSheetVisible] = useState(false);
  const [starting, setStarting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const attempt = useRef<InitialFixAttempt | null>(null);
  const autoStartHandled = useRef(false);
  const waitingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void initializeDatabase().then(loadHomeSummary).then(value => { if (active) setSummary(value); });
    return () => { active = false; };
  }, []));

  useEffect(() => () => attempt.current?.cancel(), []);

  const startActivity = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try { await activity.startFreeRun(); attempt.current?.cancel(); setSheetVisible(false); router.replace(routes.activity); }
    finally { setStarting(false); }
  }, [activity, router, starting]);

  const beginFreeRun = async () => {
    if (activity.status === 'in_progress' || activity.status === 'paused' || activity.pendingRecovery !== null) { Alert.alert('Atividade em andamento', 'Resolva ou retome a atividade atual antes de iniciar outra.'); return; }
    if (starting) return;
    setStarting(true);
    const permissions = await new LocationPermissions().checkAndRequest();
    if (permissions.foreground !== 'concedida') {
      setStarting(false);
      router.push({ pathname: routes.activityBlocked, params: { foreground: permissions.foreground, background: permissions.background } });
      return;
    }
    waitingRef.current = false; setWaiting(false);
    attempt.current = acquireInitialFix(state => {
      setFix(state);
      if (state.status === 'boa_precisao' && !waitingRef.current) void startActivity();
      else { setSheetVisible(true); setStarting(false); }
    }, 15_000, true);
  };

  useEffect(() => {
    if (startFreeRun !== '1' || autoStartHandled.current) return;
    autoStartHandled.current = true;
    void beginFreeRun();
  }, [startFreeRun]);

  const dismissSheet = () => { attempt.current?.cancel(); attempt.current = null; setSheetVisible(false); setWaiting(false); waitingRef.current = false; };
  const waitForSignal = () => {
    if (fix.status === 'boa_precisao') { void startActivity(); return; }
    waitingRef.current = true; setWaiting(true);
  };

  return (
    <Screen scrollable testID="home-screen">
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Text accessibilityRole="header" style={[styles.wordmark, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>Flux</Text>
      <Card style={styles.freeRunCard}>
        <Text style={[styles.eyebrow, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>CORRIDA LIVRE</Text>
        <Text style={[styles.description, { color: theme.colors.text, fontFamily: theme.fonts.title.regular }]}>Grava tempo, distância, pace e percurso sem seguir um treino.</Text>
        <Button disabled={starting} onPress={() => void beginFreeRun()}>Iniciar corrida livre</Button>
      </Card>
      {activity.status === 'in_progress' || activity.status === 'paused' ? <Card onPress={() => router.push(routes.activity)} style={styles.activeCard}><Text style={[styles.linkLabel, { color: theme.colors.text }]}>Atividade em andamento</Text><Text style={[styles.linkSummary, { color: theme.colors.textSecondary }]}>Voltar para a corrida ›</Text></Card> : null}
      <View style={styles.links}>
        <HomeLink label="Biblioteca de treinos" onPress={() => router.push(routes.trainingLibrary)} summary={formatTrainingCount(summary.trainingCount)} />
        <HomeLink label="Histórico" onPress={() => router.push(routes.history)} summary={summary.latestActivity ?? 'Nenhuma atividade'} />
      </View>
      <BottomSheet visible={sheetVisible} onDismiss={dismissSheet} footer={<View style={styles.sheetActions}><Button variant="secondary" disabled={starting} onPress={() => void startActivity()}>Iniciar assim mesmo</Button><Button disabled={starting} onPress={waitForSignal}>{fix.status === 'boa_precisao' ? 'Iniciar' : 'Aguardar sinal'}</Button></View>}>
        <GpsStatusPill status={fix.status === 'boa_precisao' ? 'good' : 'unacceptable'} />
        <Text style={[styles.sheetTitle, { color: theme.colors.text, fontFamily: theme.fonts.title.bold }]}>Iniciar agora pode registrar os primeiros metros com erro</Text>
        <Text style={[styles.sheetCopy, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>O aparelho ainda está buscando sinal. Esperar alguns segundos a céu aberto melhora a precisão da distância e do percurso. A decisão é sua.</Text>
        {waiting ? <Text style={[styles.waiting, { color: theme.colors.highlight }]}>Monitorando o sinal…</Text> : null}
      </BottomSheet>
    </Screen>
  );
}

function HomeLink({ label, summary, onPress }: { label: string; summary: string; onPress: () => void }) {
  const theme = useTheme();
  return <Card onPress={onPress} style={styles.linkCard}><View style={styles.linkCopy}><Text style={[styles.linkLabel, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{label}</Text><Text style={[styles.linkSummary, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.regular }]}>{summary}</Text></View><Text aria-hidden style={[styles.chevron, { color: theme.colors.textSecondary }]}>›</Text></Card>;
}

const styles = StyleSheet.create({ wordmark: { fontSize: 40, marginBottom: 32, marginTop: 32 }, freeRunCard: { padding: 24 }, eyebrow: { fontSize: 13, letterSpacing: 2.2 }, description: { fontSize: 18, lineHeight: 26, marginBottom: 20, marginTop: 14 }, activeCard: { marginTop: 12, padding: 18 }, links: { gap: 12, marginTop: 20 }, linkCard: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 18 }, linkCopy: { flex: 1 }, linkLabel: { fontSize: 20 }, linkSummary: { fontSize: 14, marginTop: 3 }, chevron: { fontSize: 30, marginLeft: 12 }, sheetActions: { gap: 10 }, sheetTitle: { fontSize: 28, lineHeight: 34, marginTop: 22 }, sheetCopy: { fontSize: 17, lineHeight: 25, marginTop: 14 }, waiting: { fontSize: 14, marginTop: 18, textAlign: 'center' } });
