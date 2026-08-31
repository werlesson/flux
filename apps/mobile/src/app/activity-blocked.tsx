import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { useTheme } from '@/hooks/use-theme';
import { LocationPermissions } from '@/location/permissions';
import { routes } from '@/navigation/routes';

export default function ActivityBlockedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ foreground?: string; background?: string }>();
  const [permissions, setPermissions] = useState({ foreground: params.foreground, background: params.background });
  const refreshPermissions = useCallback(async () => setPermissions(await new LocationPermissions().getCurrent()), []);
  useFocusEffect(useCallback(() => { void refreshPermissions(); }, [refreshPermissions]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refreshPermissions(); });
    return () => subscription.remove();
  }, [refreshPermissions]);
  const foregroundGranted = permissions.foreground === 'concedida';
  const backgroundGranted = permissions.background === 'concedida';
  const extra = foregroundGranted && !backgroundGranted ? ' Sem o acesso em segundo plano a gravação para quando a tela apaga.' : '';
  return <Screen scrollable testID="permission-blocked-screen">
    <View style={[styles.alert, { backgroundColor: theme.isDark ? '#3A1717' : '#FDECEA' }]}><Text style={[styles.alertMark, { color: theme.colors.destructive }]}>!</Text></View>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.bold }]}>Sem permissão de localização, não é possível gravar a corrida</Text>
    <Text style={[styles.copy, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>O Flux usa o GPS para medir distância, pace e percurso. A permissão precisa incluir o acesso em segundo plano para a atividade continuar com a tela bloqueada.{extra}</Text>
    <Card style={styles.statusCard}><PermissionRow label="Localização em uso" granted={foregroundGranted} /><PermissionRow label="Localização em segundo plano" granted={backgroundGranted} /></Card>
    <View style={styles.actions}><Button onPress={() => void new LocationPermissions().openAppSettings()}>Abrir configurações</Button><Button variant="secondary" onPress={() => router.replace(routes.home)}>Voltar ao início</Button></View>
  </Screen>;
}

function PermissionRow({ label, granted }: { label: string; granted: boolean }) {
  const theme = useTheme();
  return <View style={styles.row}><Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text><Text style={{ color: granted ? theme.colors.confirmation : theme.colors.destructive }}>{granted ? 'Concedida' : 'Negada'}</Text></View>;
}

const styles = StyleSheet.create({ alert: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, height: 64, justifyContent: 'center', marginTop: 40, width: 64 }, alertMark: { fontSize: 42, fontWeight: '700' }, title: { fontSize: 32, lineHeight: 38, marginTop: 28 }, copy: { fontSize: 17, lineHeight: 25, marginTop: 18 }, statusCard: { marginTop: 28, padding: 20 }, row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 }, rowLabel: { fontSize: 16 }, actions: { gap: 12, marginTop: 32 } });
