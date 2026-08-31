import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { createActionGuard, formatActivityDistance, formatActivityPace, formatActivityTime, signalQualityToGpsStatus } from '@/activity/presentation';
import { GpsStatusPill, gpsStatusLabels, type GpsStatus } from '@/components/gps-status-pill';

describe('fase 8 — apresentação da corrida livre', () => {
  it('formata métricas estáveis para leitura durante a corrida', () => {
    expect(formatActivityTime(1122)).toBe('00:18:42');
    expect(formatActivityDistance(2310)).toBe('2,31 km');
    expect(formatActivityPace(486)).toBe('8:06 /km');
    expect(formatActivityPace(null)).toBe('—');
  });

  it.each([
    ['boa_precisao', 'good', 'GPS: boa precisão'],
    ['precisao_degradada', 'degraded', 'GPS: precisão degradada'],
    ['sem_sinal', 'no-signal', 'GPS: sem sinal'],
  ] as const)('renderiza o estado calculado %s sem recalcular accuracy', (quality, status, label) => {
    const received = signalQualityToGpsStatus(quality);
    expect(received).toBe(status);
    expect(gpsStatusLabels[received]).toBe(label);
  });

  it.each(['good', 'degraded', 'no-signal'] as const)('renderiza visualmente o GpsStatusPill no estado %s', status => {
    const label = gpsStatusLabels[status];
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(GpsStatusPill, { status: status as GpsStatus })); });
    const root = renderer.root;
    expect(root.findByProps({ accessibilityLabel: label })).toBeTruthy();
    expect(root.findAllByType(Text).some(node => node.props.children === label)).toBe(true);
    if (status === 'no-signal') expect(root.findAllByType(Text).some(node => String(node.props.children).startsWith('O tempo continua contando.'))).toBe(true);
    act(() => renderer.unmount());
  });

  it('debounce impede duas transições simultâneas', async () => {
    const guard = createActionGuard();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const action = jest.fn(() => gate);
    const first = guard(action);
    const second = guard(action);
    expect(action).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();
    release(); await first;
    await guard(async () => undefined);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('mantém os textos e caminhos bloqueantes exigidos pelo design', () => {
    const blocked = readFileSync(join(__dirname, '../app/activity-blocked.tsx'), 'utf8');
    expect(blocked).toContain('Sem permissão de localização, não é possível gravar a corrida');
    expect(blocked).toContain('Sem o acesso em segundo plano a gravação para quando a tela apaga.');
    expect(blocked).toContain('Abrir configurações');
    expect(blocked).not.toContain('startFreeRun');
  });

  it('tela ativa contém os quatro estados e bloqueia o voltar do sistema', () => {
    const screen = readFileSync(join(__dirname, '../app/activity.tsx'), 'utf8');
    for (const text of ['CORRIDA LIVRE', 'TEMPO · PARADO', 'DISTÂNCIA · SEM AVANÇAR', 'PAUSAR', 'RETOMAR', 'FINALIZAR']) expect(screen).toContain(text);
    expect(screen).toContain("BackHandler.addEventListener('hardwareBackPress', () => true)");
    expect(screen).toContain('tabularMetric');
  });

  it('sheet oferece espera monitorada, início degradado e saída sem criar', () => {
    const home = readFileSync(join(__dirname, '../app/index.tsx'), 'utf8');
    for (const text of ['GPS: sem precisão aceitável', 'Iniciar agora pode registrar os primeiros metros com erro', 'Iniciar assim mesmo', 'Aguardar sinal']) {
      if (text.startsWith('GPS:')) expect(gpsStatusLabels.unacceptable).toBe(text); else expect(home).toContain(text);
    }
    const fix = readFileSync(join(__dirname, '../location/initial-fix.ts'), 'utf8');
    expect(fix).toContain('continueMonitoringAfterTimeout');
    expect(home).toContain('onDismiss={dismissSheet}');
  });
});
