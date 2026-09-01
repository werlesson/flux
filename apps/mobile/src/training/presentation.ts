import type { TrainingBlockTree, TrainingSessionTree } from '@/database/repositories/training';

export function formatTrainingMinutes(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) throw new RangeError('A duração deve ser um número finito não negativo');
  if (durationSeconds % 60 === 0) return `${durationSeconds / 60} min`;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

export function formatTrainingBlock(block: TrainingBlockTree): string {
  const steps = block.steps.slice().sort((left, right) => left.position - right.position)
    .map(step => `${formatTrainingMinutes(step.duration_seconds)} ${step.step_type.name.toLocaleLowerCase('pt-BR')}`).join(' + ');
  return block.repeat_count > 1 ? `${block.repeat_count}× ${steps}` : steps;
}

export function trainingCardPresentation(training: TrainingSessionTree) {
  const stepCount = training.blocks.reduce((total, block) => total + block.steps.length, 0);
  return {
    name: training.name,
    metadata: `${stepCount} ${stepCount === 1 ? 'etapa' : 'etapas'} · ${formatTrainingMinutes(training.estimated_duration_seconds)} estimados`,
    chips: training.blocks.slice().sort((left, right) => left.position - right.position).map(formatTrainingBlock),
  };
}

export function trainingActions(isInProgress: boolean) {
  return { canEdit: !isInProgress, canDelete: !isInProgress };
}
