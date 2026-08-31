import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { formatTrainingCount, type HomeSummary,loadHomeSummary } from '@/home/home-summary';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';

const EMPTY_SUMMARY: HomeSummary = { latestActivity: null, trainingCount: 0 };

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  useFocusEffect(useCallback(() => {
    let active = true;
    void initializeDatabase().then(loadHomeSummary).then(value => { if (active) setSummary(value); });
    return () => { active = false; };
  }, []));

  return (
    <Screen scrollable testID="home-screen">
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Text accessibilityRole="header" style={[styles.wordmark, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>Flux</Text>
      <Card style={styles.freeRunCard}>
        <Text style={[styles.eyebrow, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.medium }]}>CORRIDA LIVRE</Text>
        <Text style={[styles.description, { color: theme.colors.text, fontFamily: theme.fonts.title.regular }]}>Grava tempo, distância, pace e percurso sem seguir um treino.</Text>
        <Button onPress={() => router.push(routes.trainingPreview)}>Iniciar corrida livre</Button>
      </Card>
      <View style={styles.links}>
        <HomeLink label="Biblioteca de treinos" onPress={() => router.push(routes.trainingLibrary)} summary={formatTrainingCount(summary.trainingCount)} />
        <HomeLink label="Histórico" onPress={() => router.push(routes.history)} summary={summary.latestActivity ?? 'Nenhuma atividade'} />
      </View>
    </Screen>
  );
}

function HomeLink({ label, summary, onPress }: { label: string; summary: string; onPress: () => void }) {
  const theme = useTheme();
  return <Card onPress={onPress} style={styles.linkCard}><View style={styles.linkCopy}><Text style={[styles.linkLabel, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{label}</Text><Text style={[styles.linkSummary, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.regular }]}>{summary}</Text></View><Text aria-hidden style={[styles.chevron, { color: theme.colors.textSecondary }]}>›</Text></Card>;
}

const styles = StyleSheet.create({ wordmark: { fontSize: 40, marginBottom: 32, marginTop: 32 }, freeRunCard: { padding: 24 }, eyebrow: { fontSize: 13, letterSpacing: 2.2 }, description: { fontSize: 18, lineHeight: 26, marginBottom: 20, marginTop: 14 }, links: { gap: 12, marginTop: 20 }, linkCard: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 18 }, linkCopy: { flex: 1 }, linkLabel: { fontSize: 20 }, linkSummary: { fontSize: 14, marginTop: 3 }, chevron: { fontSize: 30, marginLeft: 12 } });
