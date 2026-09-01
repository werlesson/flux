import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { ActivitiesRepository } from '@/database/repositories/activities';
import type { Activity } from '@/database/types';
import { historyCard } from '@/history/presentation';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    // Histórico é deliberadamente local: esta tela só consulta o repositório SQLite.
    void initializeDatabase().then(database => new ActivitiesRepository(database).listarFinalizadas()).then(rows => {
      if (active) { setActivities(rows); setLoaded(true); }
    });
    return () => { active = false; };
  }, []));

  return (
    <Screen canGoBack footer={loaded && activities.length === 0 ? <View style={styles.footer}><Button onPress={() => router.push({ pathname: routes.home, params: { startFreeRun: '1' } })}>Iniciar corrida livre</Button></View> : undefined} scrollable={false} title="Histórico">
      {loaded && activities.length === 0 ? <EmptyState
        message="Suas corridas aparecem aqui, da mais recente para a mais antiga, com distância, tempo e pace médio."
        title="Nenhuma atividade registrada"
      /> : <FlatList
        contentContainerStyle={styles.list}
        data={activities}
        keyExtractor={activity => String(activity.id)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        renderItem={({ item }) => {
          const card = historyCard(item);
          return <Card accessibilityLabel={`${card.date}, ${card.origin}`} onPress={() => router.push({ pathname: routes.activityDetail, params: { activityId: item.id } })} style={styles.card}>
            <View style={styles.top}><Text style={[styles.date, { color: theme.colors.textSecondary }]}>{card.date}</Text><View style={[styles.badge, { backgroundColor: card.pending ? '#FDF3E0' : theme.colors.background }]}><Text style={{ color: card.pending ? '#9A6B00' : theme.colors.textSecondary, fontWeight: '700' }}>{card.evaluation}</Text></View></View>
            <Text style={[styles.origin, { color: theme.colors.text }]}>{card.origin}</Text>
            <View style={styles.metrics}><Text style={[styles.metric, { color: theme.colors.text }]}>{card.distance}</Text><Text style={[styles.metric, { color: theme.colors.text }]}>{card.duration}</Text></View>
            <Text style={{ color: theme.colors.textSecondary }}>{card.pace}</Text>
          </Card>;
        }}
      />}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: 12, paddingBottom: 24 }, footer: { paddingBottom: 12 }, card: { padding: 18 }, top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, date: { fontSize: 14 }, badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, origin: { fontSize: 20, fontWeight: '700', marginTop: 12 }, metrics: { flexDirection: 'row', gap: 24, marginBottom: 5, marginTop: 16 }, metric: { fontSize: 24, fontVariant: ['tabular-nums'] } });
