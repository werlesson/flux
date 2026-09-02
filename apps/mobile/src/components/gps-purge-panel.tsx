import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CONFIRMACAO_DE_EXPURGO, expurgoLiberado, mensagensDeBloqueio } from '@/gps/purge-policy';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';

export interface GpsPurgePanelProps {
  rejectedPoints: number;
  /** Injetável para teste e para a fase 21 destravar a política sem mexer na tela. */
  calibrationCompleted?: boolean;
  onPurge: () => void | Promise<void>;
}

/**
 * Expurgo manual dos pontos rejeitados de uma atividade. Nada aqui roda sozinho:
 * é preciso digitar a confirmação por extenso e ainda passar pelo diálogo. Com a
 * calibração pendente o painel fica travado — os rejeitados são o insumo da
 * fase 21.
 */
export function GpsPurgePanel({ rejectedPoints, calibrationCompleted, onPurge }: GpsPurgePanelProps) {
  const theme = useTheme();
  const [confirmation, setConfirmation] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const evaluation = expurgoLiberado(confirmation, calibrationCompleted);
  const locked = !evaluation.permitido && evaluation.motivo === 'calibracao_pendente';

  return <View>
    <Text style={[styles.section, { color: theme.colors.textSecondary }]}>EXPURGO DOS REJEITADOS</Text>
    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
      Política do projeto: pontos rejeitados são mantidos. Não há expurgo automático — esta remoção é manual, vale só para esta atividade e é irreversível. Pontos válidos não são tocados, e a distância registrada não muda.
    </Text>

    {locked
      ? <Text accessibilityLabel="Expurgo bloqueado" style={[styles.locked, { backgroundColor: theme.colors.surface, color: theme.colors.highlight }]}>{mensagensDeBloqueio.calibracao_pendente}</Text>
      : <View>
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>{rejectedPoints} ponto(s) rejeitado(s) seriam removidos. Digite {CONFIRMACAO_DE_EXPURGO} para liberar.</Text>
        <TextInput
          accessibilityLabel="Confirmação do expurgo"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setConfirmation}
          placeholder={CONFIRMACAO_DE_EXPURGO}
          placeholderTextColor={theme.colors.textSecondary}
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
          value={confirmation}
        />
        <Button
          disabled={!evaluation.permitido || rejectedPoints === 0}
          onPress={() => setDialogVisible(true)}
          variant="destructive-outline"
        >Expurgar pontos rejeitados</Button>
      </View>}

    <ConfirmDialog
      confirmLabel="Expurgar"
      destructive
      message={`Remove definitivamente ${rejectedPoints} ponto(s) com is_valid = 0 desta atividade. Os pontos válidos e a distância permanecem intactos.`}
      onCancel={() => setDialogVisible(false)}
      onConfirm={() => { setDialogVisible(false); setConfirmation(''); void onPurge(); }}
      title="Expurgar rejeitados?"
      visible={dialogVisible}
    />
  </View>;
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 28 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  locked: { borderRadius: 12, fontSize: 14, lineHeight: 20, padding: 14 },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 12, minHeight: 48, paddingHorizontal: 14 },
});
