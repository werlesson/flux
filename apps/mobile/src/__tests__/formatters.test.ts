import {
  calculatePace,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatPace,
  formatRpe,
  getRpeAnchor,
} from '@/utils/formatters';

describe('formatDistance', () => {
  it.each([
    [3180, '3,18 km'],
    [0, '0,00 km'],
    [999, '1,00 km'],
  ])('%i m vira %s', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });

  it('usa vírgula e não ponto decimal', () => {
    expect(formatDistance(3180)).not.toContain('.');
  });
});

describe('formatDuration', () => {
  it.each([
    [1782, '29:42'],
    [3600, '01:00:00'],
    [0, '00:00'],
  ])('%i s vira %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('rejeita duração negativa', () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
  });
});

describe('pace', () => {
  it('formata segundos por quilômetro', () => {
    expect(formatPace(560)).toBe('9:20/km');
  });

  it('distância zero devolve nulo e é exibida como traço', () => {
    expect(calculatePace(100, 0)).toBeNull();
    expect(formatPace(calculatePace(100, 0))).toBe('—');
  });

  it('deriva o pace da duração em movimento fornecida', () => {
    expect(formatPace(calculatePace(1780, 3180))).toBe('9:20/km');
  });

  it('formata paces lentos sem limitar os minutos', () => {
    expect(formatPace(6200)).toBe('103:20/km');
  });
});

describe('formatDateTime', () => {
  const now = new Date(2026, 7, 31, 12);

  it('omite o ano corrente na lista e usa ponto médio', () => {
    expect(formatDateTime(new Date(2026, 7, 30, 7, 42), 'list', now)).toBe(
      '30 ago · 07:42',
    );
  });

  it('inclui outro ano no cabeçalho de detalhe', () => {
    expect(formatDateTime(new Date(2025, 7, 30, 7, 42), 'detail', now)).toBe(
      '30 ago 2025, 07:42',
    );
  });

  it('abrevia os meses em pt-BR e em minúsculas', () => {
    expect(formatDateTime(new Date(2026, 11, 2, 9, 5), 'detail', now)).toBe(
      '2 dez, 09:05',
    );
  });
});

describe('getRpeAnchor', () => {
  it.each([
    [3, 'Fácil'],
    [4, 'Controlado'],
    [6, 'Controlado'],
    [7, 'Difícil'],
  ])('resolve a borda %i', (rpe, expected) => {
    expect(getRpeAnchor(rpe)).toBe(expected);
  });

  it('devolve nulo para RPE não informado', () => {
    expect(getRpeAnchor(null)).toBeNull();
  });

  it.each([0, 11])('rejeita %i', (rpe) => {
    expect(() => getRpeAnchor(rpe)).toThrow(RangeError);
  });
});

describe('formatRpe', () => {
  it('exibe RPE nulo como —/10', () => {
    expect(formatRpe(null)).toBe('—/10');
  });

  it('exibe e valida um RPE preenchido', () => {
    expect(formatRpe(6)).toBe('6/10');
    expect(() => formatRpe(11)).toThrow(RangeError);
  });
});
