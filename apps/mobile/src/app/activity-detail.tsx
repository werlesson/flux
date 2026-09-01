import { useLocalSearchParams } from 'expo-router';

import { PersistedActivitySplits } from '@/components/activity-splits';
import { Screen } from '@/components/screen';
export default function ActivityDetailScreen() { const { activityId } = useLocalSearchParams<{ activityId?: string }>(); const parsedId = Number(activityId); return <Screen canGoBack title="Detalhe da atividade"><PersistedActivitySplits activityId={Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null} /></Screen>; }
