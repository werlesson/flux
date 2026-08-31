import type { DatabaseAdapter } from '../adapter';
import type {
  ActivityStatus, ActivityStatusSlug, ActivityType, ActivityTypeSlug, GpsRejectionReason,
  GpsRejectionReasonSlug, StepExecutionStatus, StepExecutionStatusSlug, StepType, StepTypeSlug,
} from '../types';
import { dates } from './mappers';

export type LookupName = 'step_types' | 'activity_types' | 'activity_statuses' | 'step_execution_statuses' | 'gps_rejection_reasons';
type LookupRecord = StepType | ActivityType | ActivityStatus | StepExecutionStatus | GpsRejectionReason;
type SlugByTable = {
  step_types: StepTypeSlug; activity_types: ActivityTypeSlug; activity_statuses: ActivityStatusSlug;
  step_execution_statuses: StepExecutionStatusSlug; gps_rejection_reasons: GpsRejectionReasonSlug;
};

const tables: LookupName[] = ['step_types', 'activity_types', 'activity_statuses', 'step_execution_statuses', 'gps_rejection_reasons'];
interface LookupCache { bySlug: Map<LookupName, Map<string, LookupRecord>>; byId: Map<LookupName, Map<number, LookupRecord>>; loaded: boolean; loading?: Promise<void> }
const caches = new WeakMap<DatabaseAdapter, LookupCache>();

export class LookupRepository {
  private readonly cache: LookupCache;

  constructor(private readonly database: DatabaseAdapter) {
    const existing = caches.get(database);
    this.cache = existing ?? { bySlug: new Map(), byId: new Map(), loaded: false };
    if (!existing) caches.set(database, this.cache);
  }

  async carregar(): Promise<void> {
    if (this.cache.loaded) return;
    this.cache.loading ??= (async () => {
      for (const table of tables) {
        const rows = await this.database.all<Record<string, unknown>>(`SELECT * FROM ${table}`);
        const records = rows.map(row => dates(row) as unknown as LookupRecord);
        this.cache.bySlug.set(table, new Map(records.map(record => [record.slug, record])));
        this.cache.byId.set(table, new Map(records.map(record => [record.id, record])));
      }
      this.cache.loaded = true;
    })();
    try { await this.cache.loading; } catch (error) { this.cache.loading = undefined; throw error; }
  }

  async idPorSlug<T extends LookupName>(table: T, slug: SlugByTable[T]): Promise<number> {
    return (await this.porSlug(table, slug)).id;
  }

  async porSlug<T extends LookupName>(table: T, slug: SlugByTable[T]): Promise<LookupRecord> {
    await this.carregar();
    const record = this.cache.bySlug.get(table)?.get(slug);
    if (!record) throw new Error(`Lookup desconhecido: ${table}.${slug}`);
    return record;
  }

  async porId(table: LookupName, id: number): Promise<LookupRecord> {
    await this.carregar();
    const record = this.cache.byId.get(table)?.get(id);
    if (!record) throw new Error(`Lookup desconhecido: ${table}#${id}`);
    return record;
  }
}

export const LookupsRepository = LookupRepository;
