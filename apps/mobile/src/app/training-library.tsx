import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, Button, Card, Chip, ConfirmDialog, EmptyState, Screen } from '@/components';
import { initializeDatabase } from '@/database';
import { type TrainingLibraryItem,TrainingSessionsRepository } from '@/database/repositories/training';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/navigation/routes';
import { trainingActions, trainingCardPresentation } from '@/training/presentation';

export default function TrainingLibraryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [trainings, setTrainings] = useState<TrainingLibraryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<TrainingLibraryItem | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const database = await initializeDatabase();
    return new TrainingSessionsRepository(database).listarBiblioteca();
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load().then(items => { if (active) { setTrainings(items); setLoaded(true); } });
    return () => { active = false; };
  }, [load]));

  const openMenu = (event: GestureResponderEvent, training: TrainingLibraryItem) => { event.stopPropagation(); setSelected(training); };
  const edit = () => {
    if (!selected || !trainingActions(selected.is_in_progress).canEdit) return;
    const id = selected.id; setSelected(null);
    router.push({ pathname: routes.trainingEditor, params: { id: String(id) } });
  };
  const requestDelete = () => { if (selected && trainingActions(selected.is_in_progress).canDelete) setConfirming(true); };
  const deleteTraining = async () => {
    if (!selected) return;
    const database = await initializeDatabase();
    await new TrainingSessionsRepository(database).excluir(selected.id);
    setTrainings(items => items.filter(item => item.id !== selected.id));
    setConfirming(false); setSelected(null);
  };

  return <Screen canGoBack footer={<Button onPress={() => router.push(routes.trainingEditor)}>Novo treino</Button>} title="Biblioteca de treinos">
    {loaded && trainings.length === 0 ? <EmptyState message="Monte um treino com etapas de corrida e caminhada para o app conduzir a sessão no lugar de você cronometrar." title="Nenhum treino salvo" /> : <View style={styles.list}>{trainings.map(training => {
      const card = trainingCardPresentation(training);
      return <Card accessibilityLabel={`${card.name}, ${card.metadata}`} key={training.id} onPress={() => router.push({ pathname: routes.trainingPreview, params: { id: String(training.id) } })} style={styles.card}>
        <View style={styles.heading}>
          <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{card.name}</Text>
          <Pressable accessibilityLabel={`Opções de ${card.name}`} accessibilityRole="button" hitSlop={12} onPress={event => openMenu(event, training)} style={styles.menuButton}><Text style={[styles.menuIcon, { color: theme.colors.textSecondary }]}>⋮</Text></Pressable>
        </View>
        <View style={styles.metadataRow}><Text style={[styles.metadata, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.regular }]}>{card.metadata}</Text>{training.is_in_progress ? <Text style={[styles.running, { color: theme.colors.action }]}>Em execução</Text> : null}</View>
        <View style={styles.chips}>{card.chips.map((label, index) => <Chip key={`${training.id}-${index}`} label={label} />)}</View>
      </Card>;
    })}</View>}
    <BottomSheet visible={selected !== null && !confirming} onDismiss={() => setSelected(null)}>
      <Text style={[styles.sheetTitle, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{selected?.name}</Text>
      {selected?.is_in_progress ? <Text style={[styles.sheetMessage, { color: theme.colors.textSecondary }]}>Este treino está em execução e não pode ser alterado.</Text> : null}
      <View style={styles.actions}><Button disabled={selected?.is_in_progress} onPress={edit} variant="secondary">Editar</Button><Button disabled={selected?.is_in_progress} onPress={requestDelete} variant="destructive-outline">Excluir</Button></View>
    </BottomSheet>
    <ConfirmDialog cancelLabel="Cancelar" confirmLabel="Excluir" destructive message="As atividades já realizadas com ele continuam no histórico." onCancel={() => setConfirming(false)} onConfirm={() => void deleteTraining()} title="Excluir este treino?" visible={confirming} />
  </Screen>;
}

const styles = StyleSheet.create({ list: { gap: 12 }, card: { gap: 12, padding: 20 }, heading: { alignItems: 'flex-start', flexDirection: 'row' }, name: { flex: 1, fontSize: 21 }, menuButton: { alignItems: 'center', justifyContent: 'center', marginRight: -10, marginTop: -10, minHeight: 44, minWidth: 44, zIndex: 2 }, menuIcon: { fontSize: 28, lineHeight: 30 }, metadataRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metadata: { fontSize: 14 }, running: { fontSize: 13, fontWeight: '700' }, chips: { gap: 8 }, sheetTitle: { fontSize: 24 }, sheetMessage: { fontSize: 16, lineHeight: 23, marginTop: 8 }, actions: { gap: 10, marginTop: 24 } });
