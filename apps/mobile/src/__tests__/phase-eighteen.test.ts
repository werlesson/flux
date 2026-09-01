import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ActivityEngine } from '@/activity/engine';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository, ActivityPointsRepository, ActivityStepsRepository, LookupRepository, TrainingSessionsRepository } from '@/database/repositories';
import { bootstrapLocalUser, seedLookups } from '@/database/seeds';

async function setup(repeatCount = 6) {
  const database = new NodeSQLiteAdapter(); await runMigrations(database); await seedLookups(database); const userId = await bootstrapLocalUser(database); const lookups = new LookupRepository(database); await lookups.carregar();
  const training = await new TrainingSessionsRepository(database, lookups).salvar({ user_id: userId, name: 'Treino de exemplo', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 300, instructions: 'Aqueça' }] }, { repeat_count: repeatCount, steps: [{ step_type_slug: 'run', duration_seconds: 120, instructions: 'Corra firme' }, { step_type_slug: 'walk', duration_seconds: 120, instructions: 'Caminhe' }] }, { repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 300, instructions: 'Desaqueça' }] }] });
  return { database, userId, training };
}

describe('fase 18 — execução estruturada', () => {
  it('atividade estruturada grava training_session_id e o snapshot do nome', async () => {
    const { database, userId, training } = await setup(); const engine = new ActivityEngine(database, { clock: { now: () => 1_000 } }); const created = await engine.startStructuredRun(userId, training.id, training.name, new Date(1_000));
    expect(await new ActivitiesRepository(database).buscarPorId(created.id)).toMatchObject({ training_session_id: training.id, training_session_name: 'Treino de exemplo', started_at: new Date(1_000) }); database.close();
  });

  it('os activity_steps existem antes do primeiro ponto', async () => {
    const { database, userId, training } = await setup(); const engine = new ActivityEngine(database, { clock: { now: () => 0 } }); const created = await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    expect(await new ActivityStepsRepository(database).listar(created.id)).toHaveLength(14); expect(await new ActivityPointsRepository(database).listarValidos(created.id)).toHaveLength(0); database.close();
  });

  it('a atividade abre na primeira etapa', async () => {
    const { database, userId, training } = await setup(); const engine = new ActivityEngine(database, { clock: { now: () => 0 } }); await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    expect(engine.currentStep).toMatchObject({ name: 'Caminhada', position: 1, total: 14, remainingSeconds: 300, instructions: 'Aqueça' }); database.close();
  });

  it('repetição corrente reflete repetition_index', async () => {
    const { database, userId, training } = await setup(); let now = 0; const first = new ActivityEngine(database, { clock: { now: () => now } }); await first.startStructuredRun(userId, training.id, training.name, new Date(0)); now = 780_000; await first.advanceTraining(new Date(now));
    expect(first.currentStep).toMatchObject({ name: 'Corrida', repetitionIndex: 3, repeatCount: 6 });
    const restored = new ActivityEngine(database, { clock: { now: () => now } }); await restored.restoreLastActivity(); expect((await restored.recoverySnapshot())!.currentStep).toMatchObject({ repetitionIndex: 3, repeatCount: 6 }); database.close();
  });

  it('o indicador é omitido em bloco de repeat_count 1', async () => {
    const { database, userId, training } = await setup(1); const engine = new ActivityEngine(database, { clock: { now: () => 0 } }); await engine.startStructuredRun(userId, training.id, training.name, new Date(0)); expect(engine.currentStep?.repeatCount).toBe(1);
    const screen = readFileSync(join(__dirname, '../app/structured-activity.tsx'), 'utf8'); expect(screen).toContain('step.repeatCount > 1'); database.close();
  });

  it('a repetição avança corretamente ao longo das 6 voltas', async () => {
    const { database, userId, training } = await setup(); const engine = new ActivityEngine(database, { clock: { now: () => 0 } }); await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    for (let repetition = 1; repetition <= 6; repetition += 1) { await engine.advanceTraining(new Date((300 + (repetition - 1) * 240) * 1_000)); expect(engine.currentStep).toMatchObject({ repetitionIndex: repetition, repeatCount: 6, name: 'Corrida' }); }
    database.close();
  });

  it('mantém o layout, estados e ações definidos para as telas 04 e 06', () => {
    const preview = readFileSync(join(__dirname, '../app/training-preview.tsx'), 'utf8'); for (const text of ['DURAÇÃO ESTIMADA', 'ETAPAS', '× repetições', 'Iniciar treino', 'Iniciar assim mesmo', 'Aguardar sinal']) expect(preview).toContain(text);
    const active = readFileSync(join(__dirname, '../app/structured-activity.tsx'), 'utf8'); for (const text of ['ETAPA ATUAL', 'ETAPA CONGELADA', 'restam nesta etapa', 'o motor de treino não avança em pausa', 'PRÓXIMA', 'Última etapa do treino', 'TEMPO TOTAL', 'DISTÂNCIA', 'PACE MÉDIO', 'PULAR ETAPA', 'PAUSAR', 'RETOMAR', 'FINALIZAR TREINO']) expect(active).toContain(text);
  });
});
