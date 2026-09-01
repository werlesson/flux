import { useActivity } from '@/activity/activity-context';
import { PersistedActivitySplits } from '@/components/activity-splits';
import { Screen } from '@/components/screen';
export default function ActivityResultScreen() { const { activityId } = useActivity(); return <Screen canGoBack title="Atividade concluída"><PersistedActivitySplits activityId={activityId} /></Screen>; }
