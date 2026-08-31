import { EmptyState, Screen } from '@/components';

export default function TrainingEditorScreen() {
  return (
    <Screen canGoBack scrollable={false} title="Novo treino">
      <EmptyState
        message="Adicione etapas de corrida e caminhada para montar este treino."
        title="Adicione a primeira etapa"
      />
    </Screen>
  );
}
