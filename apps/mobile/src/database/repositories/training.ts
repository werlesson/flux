import type { DatabaseAdapter } from '../adapter';
import type { StepType, StepTypeSlug, TrainingBlock, TrainingSession, TrainingStep } from '../types';
import { withTransaction } from '../transaction';
import { LookupRepository } from './lookups';
import { dates, now, placeholders } from './mappers';

export interface TrainingStepInput { id?: number; step_type_id?: number; step_type_slug?: StepTypeSlug; duration_seconds: number; instructions?: string | null; distance_meters?: number | null; target_rpe?: number | null }
export interface TrainingBlockInput { id?: number; repeat_count: number; steps: TrainingStepInput[] }
export interface TrainingSessionInput { id?: number; user_id: number; name: string; blocks: TrainingBlockInput[] }
export interface TrainingStepTree extends TrainingStep { step_type: StepType }
export interface TrainingBlockTree extends TrainingBlock { steps: TrainingStepTree[] }
export interface TrainingSessionTree extends TrainingSession { blocks: TrainingBlockTree[] }

export class TrainingSessionsRepository {
  constructor(private readonly database: DatabaseAdapter, private readonly lookups = new LookupRepository(database)) {}

  async listar(): Promise<TrainingSession[]> {
    const rows = await this.database.all<Record<string, unknown>>('SELECT * FROM training_sessions WHERE deleted_at IS NULL ORDER BY updated_at DESC');
    return rows.map(row => dates(row) as unknown as TrainingSession);
  }

  async buscarPorId(id: number): Promise<TrainingSessionTree | null> {
    const [raw] = await this.database.all<Record<string, unknown>>('SELECT * FROM training_sessions WHERE id=?', [id]);
    if (!raw) return null;
    const blockRows = await this.database.all<Record<string, unknown>>('SELECT * FROM training_blocks WHERE training_session_id=? ORDER BY position', [id]);
    const blocks: TrainingBlockTree[] = [];
    for (const blockRow of blockRows) {
      const block = dates(blockRow) as unknown as TrainingBlock;
      const stepRows = await this.database.all<Record<string, unknown>>('SELECT * FROM training_steps WHERE training_block_id=? ORDER BY position', [block.id]);
      const steps: TrainingStepTree[] = [];
      for (const row of stepRows) {
        const step = dates(row) as unknown as TrainingStep;
        steps.push({ ...step, step_type: await this.lookups.porId('step_types', step.step_type_id) as StepType });
      }
      blocks.push({ ...block, steps });
    }
    return { ...(dates(raw) as unknown as TrainingSession), blocks };
  }

  async salvar(input: TrainingSessionInput, at = new Date()): Promise<TrainingSessionTree> {
    if (!input.name.trim()) throw new Error('Nome do treino é obrigatório');
    if (!input.blocks.length || input.blocks.some(block => !block.steps.length)) throw new Error('O treino deve possuir etapas');
    for (const block of input.blocks) {
      if (!Number.isInteger(block.repeat_count) || block.repeat_count < 1) throw new Error('repeat_count deve ser no mínimo 1');
      for (const step of block.steps) if (step.duration_seconds <= 0) throw new Error('duration_seconds deve ser maior que zero');
    }
    const estimated = input.blocks.reduce((total, block) => total + block.repeat_count * block.steps.reduce((sum, step) => sum + step.duration_seconds, 0), 0);
    const id = await withTransaction(this.database, async tx => {
      const timestamp = now(at);
      let sessionId = input.id;
      if (sessionId) {
        const result = await tx.run('UPDATE training_sessions SET user_id=?,name=?,estimated_duration_seconds=?,updated_at=? WHERE id=?', [input.user_id, input.name.trim(), estimated, timestamp, sessionId]);
        if (!result.changes) throw new Error(`Treino não encontrado: ${sessionId}`);
        await tx.run('DELETE FROM training_blocks WHERE training_session_id=?', [sessionId]);
      } else {
        sessionId = (await tx.run('INSERT INTO training_sessions(user_id,name,estimated_duration_seconds,created_at,updated_at) VALUES(?,?,?,?,?)', [input.user_id, input.name.trim(), estimated, timestamp, timestamp])).lastInsertRowId;
      }
      for (let blockPosition = 0; blockPosition < input.blocks.length; blockPosition++) {
        const block = input.blocks[blockPosition]!;
        const blockId = (await tx.run('INSERT INTO training_blocks(training_session_id,position,repeat_count,created_at,updated_at) VALUES(?,?,?,?,?)', [sessionId, blockPosition, block.repeat_count, timestamp, timestamp])).lastInsertRowId;
        for (let stepPosition = 0; stepPosition < block.steps.length; stepPosition++) {
          const step = block.steps[stepPosition]!;
          const typeId = step.step_type_id ?? await this.lookups.idPorSlug('step_types', step.step_type_slug!);
          await tx.run('INSERT INTO training_steps(training_block_id,step_type_id,position,duration_seconds,distance_meters,target_rpe,instructions,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [blockId, typeId, stepPosition, step.duration_seconds, step.distance_meters ?? null, step.target_rpe ?? null, step.instructions ?? null, timestamp, timestamp]);
        }
      }
      return sessionId;
    });
    return (await this.buscarPorId(id))!;
  }

  async excluir(id: number, at = new Date()): Promise<void> {
    await this.database.run('UPDATE training_sessions SET deleted_at=?,updated_at=? WHERE id=?', [now(at), now(at), id]);
  }
}

async function reorder(database: DatabaseAdapter, table: 'training_blocks' | 'training_steps', parent: string, parentId: number, ids: number[], at: Date): Promise<void> {
  const existing = await database.all<{ id: number }>(`SELECT id FROM ${table} WHERE ${parent}=? ORDER BY position`, [parentId]);
  if (existing.length !== ids.length || new Set(ids).size !== ids.length || ids.some(id => !existing.some(row => row.id === id))) throw new Error('A ordem deve conter todos os registros do grupo exatamente uma vez');
  const offset = ids.length + 1;
  await withTransaction(database, async tx => {
    await tx.run(`UPDATE ${table} SET position=position+?,updated_at=? WHERE ${parent}=?`, [offset, now(at), parentId]);
    for (let position = 0; position < ids.length; position++) await tx.run(`UPDATE ${table} SET position=?,updated_at=? WHERE id=? AND ${parent}=?`, [position, now(at), ids[position]!, parentId]);
  });
}

export class TrainingBlocksRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  async criar(trainingSessionId: number, repeatCount = 1, at = new Date()): Promise<number> {
    if (!Number.isInteger(repeatCount) || repeatCount < 1) throw new Error('repeat_count deve ser no mínimo 1');
    const [{ position }] = await this.database.all<{ position: number }>('SELECT COALESCE(MAX(position)+1,0) position FROM training_blocks WHERE training_session_id=?', [trainingSessionId]);
    return (await this.database.run('INSERT INTO training_blocks(training_session_id,position,repeat_count,created_at,updated_at) VALUES(?,?,?,?,?)', [trainingSessionId, position, repeatCount, now(at), now(at)])).lastInsertRowId;
  }
  async atualizarRepeatCount(id: number, repeatCount: number, at = new Date()): Promise<void> {
    if (!Number.isInteger(repeatCount) || repeatCount < 1) throw new Error('repeat_count deve ser no mínimo 1');
    await this.database.run('UPDATE training_blocks SET repeat_count=?,updated_at=? WHERE id=?', [repeatCount, now(at), id]);
  }
  reordenar(trainingSessionId: number, ids: number[], at = new Date()): Promise<void> { return reorder(this.database, 'training_blocks', 'training_session_id', trainingSessionId, ids, at); }
  async remover(id: number): Promise<void> { await this.database.run('DELETE FROM training_blocks WHERE id=?', [id]); }
}

export class TrainingStepsRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  private validar(blockId: number | null | undefined, duration: number): asserts blockId is number {
    if (blockId == null) throw new Error('training_block_id é obrigatório');
    if (duration <= 0) throw new Error('duration_seconds deve ser maior que zero');
  }
  async criar(input: TrainingStepInput & { training_block_id?: number }, at = new Date()): Promise<number> {
    this.validar(input.training_block_id, input.duration_seconds);
    if (input.step_type_id == null) throw new Error('step_type_id é obrigatório');
    const [{ position }] = await this.database.all<{ position: number }>('SELECT COALESCE(MAX(position)+1,0) position FROM training_steps WHERE training_block_id=?', [input.training_block_id]);
    return (await this.database.run('INSERT INTO training_steps(training_block_id,step_type_id,position,duration_seconds,distance_meters,target_rpe,instructions,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [input.training_block_id, input.step_type_id, position, input.duration_seconds, input.distance_meters ?? null, input.target_rpe ?? null, input.instructions ?? null, now(at), now(at)])).lastInsertRowId;
  }
  async atualizar(id: number, input: Pick<TrainingStepInput, 'step_type_id' | 'duration_seconds' | 'instructions'>, at = new Date()): Promise<void> {
    if (input.duration_seconds <= 0) throw new Error('duration_seconds deve ser maior que zero');
    if (input.step_type_id == null) throw new Error('step_type_id é obrigatório');
    await this.database.run('UPDATE training_steps SET step_type_id=?,duration_seconds=?,instructions=?,updated_at=? WHERE id=?', [input.step_type_id, input.duration_seconds, input.instructions ?? null, now(at), id]);
  }
  reordenar(trainingBlockId: number, ids: number[], at = new Date()): Promise<void> { return reorder(this.database, 'training_steps', 'training_block_id', trainingBlockId, ids, at); }
  async remover(id: number): Promise<void> { await this.database.run('DELETE FROM training_steps WHERE id=?', [id]); }
}
