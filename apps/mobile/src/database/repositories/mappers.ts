import { fromDatabaseTimestamp } from '../dates';

export type RawRow = Record<string, unknown>;

export function dates<T extends RawRow>(row: T): T {
  const result: RawRow = { ...row };
  for (const key of ['created_at', 'updated_at', 'started_at', 'finished_at', 'deleted_at', 'recorded_at']) {
    if (typeof result[key] === 'string') result[key] = fromDatabaseTimestamp(result[key] as string);
  }
  if ('is_active' in result) result.is_active = Boolean(result.is_active);
  if ('is_valid' in result) result.is_valid = Boolean(result.is_valid);
  return result as T;
}

export function now(value?: Date): string {
  return (value ?? new Date()).toISOString();
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}
