import * as stepTypeSurfaces from '@/components/step-type-surfaces';
import { colors, fontSizes, getStepTypeColor, sizes, tabularMetric } from '@/constants/theme';
import { resolveTheme } from '@/hooks/use-theme';

describe('Solar theme tokens', () => {
  it('resolve as paletas do esquema corrente', () => {
    expect(resolveTheme('dark').colors).toBe(colors.dark);
    expect(resolveTheme('light').colors).toBe(colors.light);
    expect(resolveTheme(null).colors).toBe(colors.dark);
  });

  it('resolve cor de etapa por slug', () => {
    expect(getStepTypeColor('warmup')).toBe(colors.step.warmup);
    expect(getStepTypeColor('run')).toBe(colors.step.run);
    expect(getStepTypeColor('walk')).toBe(colors.step.walk);
    expect(getStepTypeColor('recovery')).toBe(colors.step.recovery);
    expect(getStepTypeColor('cooldown')).toBe(colors.step.cooldown);
  });

  it('mantém os principais tamanhos dos mocks em dp', () => {
    expect(fontSizes.activityTime).toBe(104);
    expect(fontSizes.activityDistance).toBe(96);
    expect(fontSizes.activityStepRemaining).toBe(92);
    expect(sizes.minimumTouchTarget).toBeGreaterThanOrEqual(44);
    expect(sizes.activityPrimaryButtonHeight).toBe(132);
  });

  it('usa números tabulares nas métricas', () => {
    expect(tabularMetric.fontVariant).toContain('tabular-nums');
  });
});

describe('step color consumers', () => {
  it('mantém as quatro superfícies ligadas ao resolvedor compartilhado', () => {
    expect(stepTypeSurfaces).toEqual(
      expect.objectContaining({
        ActivityResultSteps: expect.any(Function),
        ActivitySteps: expect.any(Function),
        TrainingEditorSteps: expect.any(Function),
        TrainingLibrarySteps: expect.any(Function),
      }),
    );
  });
});
