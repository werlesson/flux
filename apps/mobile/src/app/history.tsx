import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/components';
import { routes } from '@/navigation/routes';

export default function HistoryScreen() {
  const router = useRouter();

  return (
    <Screen canGoBack scrollable={false} title="Histórico">
      <EmptyState
        actionLabel="Iniciar corrida livre"
        message="Suas corridas aparecem aqui, da mais recente para a mais antiga, com distância, tempo e pace médio."
        onAction={() => router.push(routes.trainingPreview)}
        title="Nenhuma atividade registrada"
      />
    </Screen>
  );
}
