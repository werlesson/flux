import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { EmptyState, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { TrainingSessionsRepository, type TrainingSessionTree } from '@/database/repositories/training';
import { useTheme } from '@/hooks/use-theme';

export default function TrainingEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const [training, setTraining] = useState<TrainingSessionTree | null>(null);
  useEffect(() => {
    let active = true;
    if (id) void initializeDatabase().then(database => new TrainingSessionsRepository(database).buscarPorId(Number(id))).then(value => { if (active) setTraining(value); });
    return () => { active = false; };
  }, [id]);
  return (
    <Screen canGoBack scrollable={false} title={id ? 'Editar treino' : 'Novo treino'}>
      {training ? <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700', marginBottom: 20 }}>{training.name}</Text> : null}
      <EmptyState
        message="Adicione etapas de corrida e caminhada para montar este treino."
        title="Adicione a primeira etapa"
      />
    </Screen>
  );
}
