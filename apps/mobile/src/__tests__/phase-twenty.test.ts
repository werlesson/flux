import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { Text, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';

import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { bucketLabel, formatMeters, formatShare, GpsInspectionReportView } from '@/components/gps-inspection-report';
import { GpsPurgePanel } from '@/components/gps-purge-panel';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository } from '@/database/repositories/activity-points';
import { bootstrapLocalUser, seedLookups } from '@/database/seeds';
import type { GpsRejectionReasonSlug } from '@/database/types';
import { haversineDistanceMeters } from '@/gps/distance';
import {
  accuracyBucketEdgesMeters,
  accuracyDistribution,
  buildGpsInspectionReport,
  gpsRejectionReasonOrder,
  type InspectedPoint,
  inspectionRouteCoordinates,
  percentile,
} from '@/gps/inspection';
import {
  calibracaoDeCampoConcluida,
  CONFIRMACAO_DE_EXPURGO,
  expurgoLiberado,
  ExpurgoRecusadoError,
  mensagensDeBloqueio,
} from '@/gps/purge-policy';
import { developmentRoutes, routes } from '@/navigation/routes';
import { isDevelopmentBuild } from '@/utils/environment';

const developmentFlag = globalThis as { __DEV__?: boolean };

async function setup() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database);
  const userId = await bootstrapLocalUser(database);
  const activities = new ActivitiesRepository(database);
  const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date('2026-08-30T10:00:00Z') });
  return { database, activities, activity, points: new ActivityPointsRepository(database) };
}

const accepted = (seconds: number, accuracy: number | null, segment = 0): InspectedPoint =>
  ({ latitude: -3.7, longitude: -38.5, accuracy, recorded_at: new Date(seconds * 1000), is_valid: true, rejection_reason_slug: null, segment_index: segment });
const rejectedAt = (seconds: number, reason: GpsRejectionReasonSlug | null): InspectedPoint =>
  ({ latitude: 40, longitude: 40, accuracy: 90, recorded_at: new Date(seconds * 1000), is_valid: false, rejection_reason_slug: reason, segment_index: 0 });

const labels: Record<GpsRejectionReasonSlug, string> = {
  low_accuracy: 'Precisão acima do limiar',
  implausible_speed: 'Velocidade fisicamente implausível',
  position_jump: 'Salto abrupto de posição',
  stale_sample: 'Intervalo entre medições fora do aceitável',
};

describe('fase 20 — ferramenta de inspeção do GPS', () => {
  afterEach(() => { developmentFlag.__DEV__ = true; });

  it('agrupa os rejeitados por gps_rejection_reasons a partir do que está persistido', async () => {
    const { database, activity, points } = await setup();
    await points.inserir([
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, accuracy: 8, recorded_at: new Date(1000), is_valid: true },
      { activity_id: activity.id, latitude: 40, longitude: 40, accuracy: 90, recorded_at: new Date(2000), is_valid: false, rejection_reason_slug: 'position_jump' },
      { activity_id: activity.id, latitude: 41, longitude: 41, accuracy: 95, recorded_at: new Date(3000), is_valid: false, rejection_reason_slug: 'position_jump' },
      { activity_id: activity.id, latitude: 42, longitude: 42, accuracy: 99, recorded_at: new Date(4000), is_valid: false, rejection_reason_slug: 'low_accuracy' },
      { activity_id: activity.id, latitude: -3.71, longitude: -38.51, accuracy: 12, recorded_at: new Date(5000), is_valid: true, segment_index: 1 },
    ]);
    const inspected = await points.listarParaInspecao(activity.id);
    expect(inspected).toHaveLength(5);
    const report = buildGpsInspectionReport(inspected);
    expect({ total: report.totalPoints, accepted: report.acceptedPoints, rejected: report.rejectedPoints, segments: report.segments })
      .toEqual({ total: 5, accepted: 2, rejected: 3, segments: 2 });
    expect(report.rejections.map(item => [item.reason, item.count]))
      .toEqual([['position_jump', 2], ['low_accuracy', 1], ['implausible_speed', 0], ['stale_sample', 0]]);
    expect(report.rejections[0]!.share).toBeCloseTo(0.4, 10);
    expect(report.rejectedWithoutReason).toBe(0);
    database.close();
  });

  it('a contagem por motivo confere com a agregação feita no próprio SQLite', async () => {
    const { database, activity, points } = await setup();
    await points.inserir([
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, accuracy: 8, recorded_at: new Date(1000), is_valid: true },
      { activity_id: activity.id, latitude: 40, longitude: 40, accuracy: 90, recorded_at: new Date(2000), is_valid: false, rejection_reason_slug: 'stale_sample' },
      { activity_id: activity.id, latitude: 41, longitude: 41, accuracy: 90, recorded_at: new Date(3000), is_valid: false, rejection_reason_slug: 'implausible_speed' },
    ]);
    const report = buildGpsInspectionReport(await points.listarParaInspecao(activity.id));
    const aggregated = await points.contarPorMotivo(activity.id);
    expect(aggregated).toHaveLength(2);
    for (const row of aggregated) expect(report.rejections.find(item => item.reason === row.reason)!.count).toBe(row.count);
    database.close();
  });

  it('descreve a distribuição de accuracy apenas dos pontos aceitos', async () => {
    const { database, activity, points } = await setup();
    await points.inserir([
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, accuracy: 4, recorded_at: new Date(1000), is_valid: true },
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, accuracy: 8, recorded_at: new Date(2000), is_valid: true },
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, accuracy: 12, recorded_at: new Date(3000), is_valid: true },
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, accuracy: 60, recorded_at: new Date(4000), is_valid: true },
      { activity_id: activity.id, latitude: 40, longitude: 40, accuracy: 400, recorded_at: new Date(5000), is_valid: false, rejection_reason_slug: 'low_accuracy' },
    ]);
    const report = buildGpsInspectionReport(await points.listarParaInspecao(activity.id));
    expect(report.accuracy).not.toBeNull();
    expect(report.accuracy!.count).toBe(4);
    expect(report.accuracy!.min).toBe(4);
    expect(report.accuracy!.median).toBe(10);
    expect(report.accuracy!.max).toBe(60);
    expect(await points.accuracyDosAceitos(activity.id)).toEqual([4, 8, 12, 60]);
    expect(report.accuracy!.buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(4);
    expect(report.accuracy!.buckets.map(bucket => bucket.upperBound)).toEqual([...accuracyBucketEdgesMeters, null]);
    database.close();
  });

  it('percentil interpola e a distribuição é nula sem accuracy aproveitável', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10], 0.95)).toBe(10);
    expect(() => percentile([], 0.5)).toThrow(RangeError);
    expect(accuracyDistribution([])).toBeNull();
    expect(accuracyDistribution([Number.NaN])).toBeNull();
    const report = buildGpsInspectionReport([accepted(1, null), accepted(2, 6)]);
    expect(report.acceptedWithoutAccuracy).toBe(1);
    expect(report.accuracy!.count).toBe(1);
  });

  it('o percurso pode ser lido com e sem os pontos rejeitados', () => {
    const points = [accepted(1, 6), rejectedAt(2, 'position_jump'), accepted(3, 7)];
    expect(inspectionRouteCoordinates(points, false).map(item => item.latitude)).toEqual([-3.7, -3.7]);
    expect(inspectionRouteCoordinates(points, true).map(item => item.latitude)).toEqual([-3.7, 40, -3.7]);
    expect(inspectionRouteCoordinates(points, true)[1]).toMatchObject({ recordedAt: new Date(2000), segmentIndex: 0 });
  });

  it('sinaliza rejeitado sem motivo gravado em vez de silenciá-lo', () => {
    const report = buildGpsInspectionReport([accepted(1, 6), rejectedAt(2, null)]);
    expect(report.rejectedWithoutReason).toBe(1);
    expect(report.rejections.every(item => item.count === 0)).toBe(true);
  });

  it('renderiza contagem por motivo, distribuição de accuracy e alternância do percurso', () => {
    const report = buildGpsInspectionReport([accepted(1, 4), accepted(2, 8), accepted(3, 60), rejectedAt(4, 'low_accuracy'), rejectedAt(5, 'position_jump')]);
    const onToggleRejected = jest.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(React.createElement(GpsInspectionReportView, {
        coordinates: inspectionRouteCoordinates([accepted(1, 4)], false),
        includeRejected: false,
        labels,
        onToggleRejected,
        report,
      }));
    });
    const texts = renderer.root.findAllByType(Text).map(node => String(node.props.children));
    for (const expected of ['REJEITADOS POR MOTIVO', 'ACCURACY DOS ACEITOS', 'PERCURSO', 'Precisão acima do limiar', 'Salto abrupto de posição']) {
      expect(texts.some(text => text.includes(expected))).toBe(true);
    }
    expect(texts).toContain(formatMeters(report.accuracy!.p95));
    act(() => { renderer.root.findByProps({ accessibilityLabel: 'Com rejeitados' }).props.onPress(); });
    expect(onToggleRejected).toHaveBeenCalledWith(true);
    act(() => { renderer.root.findByProps({ accessibilityLabel: 'Só aceitos' }).props.onPress(); });
    expect(onToggleRejected).toHaveBeenLastCalledWith(false);
    act(() => renderer.unmount());
  });

  it('formata metros, participação e faixas do histograma em pt-BR', () => {
    expect(formatMeters(12.34)).toBe('12,3 m');
    expect(formatShare(0.125)).toBe('12,5%');
    const buckets = accuracyDistribution([1, 7, 100])!.buckets;
    const edges = [...accuracyBucketEdgesMeters];
    expect(bucketLabel(buckets[0]!, 0, edges)).toBe(`0–${edges[0]} m`);
    expect(bucketLabel(buckets[buckets.length - 1]!, buckets.length - 1, edges)).toBe(`> ${edges[edges.length - 1]} m`);
  });

  it('a ferramenta é acessível apenas em build de desenvolvimento', () => {
    developmentFlag.__DEV__ = true;
    expect(isDevelopmentBuild()).toBe(true);
    developmentFlag.__DEV__ = false;
    expect(isDevelopmentBuild()).toBe(false);

    const root = join(__dirname, '..');
    const inspector = readFileSync(join(root, 'app/gps-inspector.tsx'), 'utf8');
    const home = readFileSync(join(root, 'app/index.tsx'), 'utf8');
    expect(inspector).toContain("import { isDevelopmentBuild } from '@/utils/environment';");
    expect(inspector).toContain('const available = isDevelopmentBuild();');
    expect(inspector).toContain('A inspeção do GPS existe apenas no development build');
    expect(home).toContain('{isDevelopmentBuild() ? <HomeLink label="Inspeção do GPS"');
    expect(developmentRoutes.gpsInspector).toBe('/gps-inspector');
    expect(Object.values(routes)).not.toContain(developmentRoutes.gpsInspector);
  });

  it('a ordem canônica dos motivos cobre exatamente os slugs semeados', async () => {
    const { database } = await setup();
    const seeded = await database.all<{ slug: GpsRejectionReasonSlug }>('SELECT slug FROM gps_rejection_reasons ORDER BY slug');
    expect([...gpsRejectionReasonOrder].sort()).toEqual(seeded.map(row => row.slug));
    database.close();
  });
});

/** Espelha o cálculo do motor (`activity/engine.ts`): só pontos válidos, sem cruzar segmento. */
function distanciaDosValidos(points: readonly { latitude: number; longitude: number; segment_index: number }[]): number {
  return points.slice(1).reduce(
    (total, point, index) => total + (point.segment_index === points[index]!.segment_index ? haversineDistanceMeters(points[index]!, point) : 0),
    0,
  );
}

async function atividadeComRejeitados() {
  const context = await setup();
  await context.points.inserir([
    { activity_id: context.activity.id, latitude: -3.7000, longitude: -38.5000, accuracy: 6, recorded_at: new Date(1000), is_valid: true },
    { activity_id: context.activity.id, latitude: 40, longitude: 40, accuracy: 90, recorded_at: new Date(2000), is_valid: false, rejection_reason_slug: 'position_jump' },
    { activity_id: context.activity.id, latitude: -3.7010, longitude: -38.5000, accuracy: 7, recorded_at: new Date(3000), is_valid: true },
    { activity_id: context.activity.id, latitude: 41, longitude: 41, accuracy: 99, recorded_at: new Date(4000), is_valid: false, rejection_reason_slug: 'low_accuracy' },
    { activity_id: context.activity.id, latitude: -3.7020, longitude: -38.5000, accuracy: 5, recorded_at: new Date(5000), is_valid: true },
  ]);
  const validos = await context.points.listarValidos(context.activity.id);
  await context.activities.atualizarMetricas(context.activity.id, {
    finished_at: new Date('2026-08-30T10:30:00Z'),
    activity_status_slug: 'finished',
    elapsed_duration_seconds: 1800,
    moving_duration_seconds: 1700,
    distance_meters: distanciaDosValidos(validos),
  });
  return context;
}

describe('fase 20 — política de expurgo dos pontos rejeitados', () => {
  it('a decisão registrada é manter, com remoção só manual e travada até a calibração', () => {
    expect(calibracaoDeCampoConcluida).toBe(false);
    expect(expurgoLiberado(CONFIRMACAO_DE_EXPURGO)).toEqual({ permitido: false, motivo: 'calibracao_pendente' });
    expect(expurgoLiberado('', true)).toEqual({ permitido: false, motivo: 'confirmacao_ausente' });
    expect(expurgoLiberado('expurgar', true)).toEqual({ permitido: true });
    expect(expurgoLiberado('  EXPURGAR  ', true)).toEqual({ permitido: true });
    expect(expurgoLiberado('apagar', true)).toEqual({ permitido: false, motivo: 'confirmacao_ausente' });
    expect(new ExpurgoRecusadoError('calibracao_pendente').message).toBe(mensagensDeBloqueio.calibracao_pendente);

    const schema = readFileSync(join(__dirname, '../../../../.spec/init/database-schema.md'), 'utf8');
    const openQuestions = schema.slice(schema.indexOf('## Open Questions'));
    expect(openQuestions).toContain('Resolvida na fase 20');
    expect(openQuestions).toContain('mantidos por prazo indeterminado');
    expect(openQuestions).toContain('Não há expurgo automático');
  });

  it('o expurgo remove apenas pontos com is_valid = 0', async () => {
    const { database, activity, points } = await atividadeComRejeitados();
    const antes = await points.listarParaInspecao(activity.id);
    expect(antes).toHaveLength(5);
    expect(await points.contarRejeitados(activity.id)).toBe(2);
    const validosAntes = await points.listarValidos(activity.id);

    expect(await points.expurgarRejeitados(activity.id)).toBe(2);

    const depois = await points.listarParaInspecao(activity.id);
    expect(depois).toHaveLength(3);
    expect(depois.every(point => point.is_valid)).toBe(true);
    expect(await points.contarRejeitados(activity.id)).toBe(0);
    expect(await points.contarPorMotivo(activity.id)).toEqual([]);
    const validosDepois = await points.listarValidos(activity.id);
    expect(validosDepois.map(point => point.id)).toEqual(validosAntes.map(point => point.id));
    expect(validosDepois.map(point => point.latitude)).toEqual(validosAntes.map(point => point.latitude));
    expect(await points.expurgarRejeitados(activity.id)).toBe(0);
    database.close();
  });

  it('o expurgo não altera a distância da atividade', async () => {
    const { database, activities, activity, points } = await atividadeComRejeitados();
    const antes = (await activities.buscarPorId(activity.id))!.distance_meters;
    const calculadaAntes = distanciaDosValidos(await points.listarValidos(activity.id));
    expect(antes).toBeGreaterThan(0);
    expect(calculadaAntes).toBeCloseTo(antes!, 9);

    await points.expurgarRejeitados(activity.id);

    expect((await activities.buscarPorId(activity.id))!.distance_meters).toBe(antes);
    expect(distanciaDosValidos(await points.listarValidos(activity.id))).toBeCloseTo(calculadaAntes, 9);
    database.close();
  });

  it('o expurgo de uma atividade não toca nos pontos de outra', async () => {
    const { database, activities, activity, points } = await atividadeComRejeitados();
    const [user] = await database.all<{ id: number }>('SELECT id FROM users LIMIT 1');
    const outra = await activities.criar({ user_id: user!.id, activity_type_slug: 'free_run', started_at: new Date('2026-08-31T10:00:00Z') });
    await points.inserir([
      { activity_id: outra.id, latitude: -3.7, longitude: -38.5, accuracy: 6, recorded_at: new Date(1000), is_valid: true },
      { activity_id: outra.id, latitude: 40, longitude: 40, accuracy: 90, recorded_at: new Date(2000), is_valid: false, rejection_reason_slug: 'position_jump' },
    ]);

    expect(await points.expurgarRejeitados(activity.id)).toBe(2);
    expect(await points.listarParaInspecao(outra.id)).toHaveLength(2);
    expect(await points.contarRejeitados(outra.id)).toBe(1);
    database.close();
  });

  it('o painel fica travado enquanto a calibração da fase 21 não fechar', () => {
    const onPurge = jest.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(GpsPurgePanel, { onPurge, rejectedPoints: 3 })); });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Expurgo bloqueado' })).toBeTruthy();
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(onPurge).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('destravado, o expurgo ainda exige a confirmação digitada e o diálogo', () => {
    const onPurge = jest.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(GpsPurgePanel, { calibrationCompleted: true, onPurge, rejectedPoints: 3 })); });
    const botao = () => renderer.root.findAll(node => node.type === Button && node.props.children === 'Expurgar pontos rejeitados')[0]!;
    const campo = () => renderer.root.findByProps({ accessibilityLabel: 'Confirmação do expurgo' });
    expect(botao().props.disabled).toBe(true);

    act(() => { campo().props.onChangeText('EXPURG'); });
    expect(botao().props.disabled).toBe(true);

    act(() => { campo().props.onChangeText(CONFIRMACAO_DE_EXPURGO); });
    expect(botao().props.disabled).toBe(false);
    expect(onPurge).not.toHaveBeenCalled();

    act(() => { botao().props.onPress(); });
    expect(onPurge).not.toHaveBeenCalled();

    act(() => { renderer.root.findAll(node => node.type === ConfirmDialog)[0]!.props.onConfirm(); });
    expect(onPurge).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('sem rejeitados não há o que expurgar, mesmo com a confirmação certa', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(GpsPurgePanel, { calibrationCompleted: true, onPurge: jest.fn(), rejectedPoints: 0 })); });
    act(() => { renderer.root.findByProps({ accessibilityLabel: 'Confirmação do expurgo' }).props.onChangeText(CONFIRMACAO_DE_EXPURGO); });
    expect(renderer.root.findAll(node => node.type === Button && node.props.children === 'Expurgar pontos rejeitados')[0]!.props.disabled).toBe(true);
    act(() => renderer.unmount());
  });

  it('nenhum caminho de produção dispara expurgo por conta própria', () => {
    const root = join(__dirname, '..');
    const sources = ['activity/engine.ts', 'gps/orchestrator.ts', 'database/migrations.ts', 'app/activity.tsx', 'app/activity-result.tsx', 'app/history.tsx', 'app/activity-detail.tsx'];
    for (const source of sources) expect(readFileSync(join(root, source), 'utf8')).not.toContain('expurgarRejeitados');
    expect(readFileSync(join(root, 'app/gps-inspector.tsx'), 'utf8')).toContain('expurgarRejeitados');
  });
});
