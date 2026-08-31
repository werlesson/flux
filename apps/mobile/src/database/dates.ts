export function toDatabaseTimestamp(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new RangeError('Invalid timestamp');
  return value.toISOString();
}

export function fromDatabaseTimestamp(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid database timestamp: ${value}`);
  return date;
}

export function differenceInSeconds(start: Date, end: Date): number {
  return Math.trunc((end.getTime() - start.getTime()) / 1000);
}
