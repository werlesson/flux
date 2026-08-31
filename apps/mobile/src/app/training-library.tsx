import { useRouter } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components';
import { routes } from '@/navigation/routes';

export default function TrainingLibraryScreen() {
  const router = useRouter();
  const openEditor = () => router.push(routes.trainingEditor);

  return (
    <Screen canGoBack footer={<Button onPress={openEditor}>Novo treino</Button>} scrollable={false} title="Biblioteca de treinos">
      <EmptyState
        message="Monte um treino com etapas de corrida e caminhada para o app conduzir a sessão no lugar de você cronometrar."
        title="Nenhum treino salvo"
      />
    </Screen>
  );
}
