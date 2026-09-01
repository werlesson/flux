import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { TrainingSessionsRepository } from '@/database/repositories/training';
import type { TrainingSession } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';
import { formatDuration } from '@/utils/formatters';

export default function TrainingLibraryScreen() {
  const router = useRouter(); const theme = useTheme(); const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  useFocusEffect(useCallback(() => { let active = true; void initializeDatabase().then(db => new TrainingSessionsRepository(db).listar()).then(items => { if (active) setTrainings(items); }); return () => { active = false; }; }, []));
  return <Screen canGoBack footer={<Button onPress={() => router.push(routes.trainingEditor)}>Novo treino</Button>} title="Biblioteca de treinos">
    {!trainings.length ? <EmptyState message="Monte um treino com etapas de corrida e caminhada para o app conduzir a sessão no lugar de você cronometrar." title="Nenhum treino salvo" /> : <View style={styles.list}>{trainings.map(training => <Card key={training.id} onPress={() => router.push({ pathname: routes.trainingPreview, params: { id: String(training.id) } })} style={styles.card}><Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{training.name}</Text><Text style={{ color: theme.colors.textSecondary }}>Duração estimada · {formatDuration(training.estimated_duration_seconds)}</Text></Card>)}</View>}
  </Screen>;
}
const styles = StyleSheet.create({ list: { gap: 12 }, card: { gap: 6, padding: 20 }, name: { fontSize: 21 } });
