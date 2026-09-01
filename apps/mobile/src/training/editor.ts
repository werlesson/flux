import type { StepType, StepTypeSlug } from '@/database/types';

export interface EditorStep {
  key: string;
  id?: number;
  stepType: StepType;
  durationSeconds: number;
  instructions: string | null;
  selected?: boolean;
}

export interface EditorBlock {
  key: string;
  id?: number;
  repeatCount: number;
  steps: EditorStep[];
}

export const STEP_TYPE_ORDER: StepTypeSlug[] = ['warmup', 'run', 'walk', 'recovery', 'cooldown'];

export function calculateEstimatedDuration(blocks: Pick<EditorBlock, 'repeatCount' | 'steps'>[]): number {
  return blocks.reduce((total, block) => total + block.repeatCount * block.steps.reduce((sum, step) => sum + step.durationSeconds, 0), 0);
}

export function formatEditorDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function selectedStepKeysAreConsecutive(blocks: EditorBlock[], keys: string[]): boolean {
  if (keys.length < 2 || new Set(keys).size !== keys.length) return false;
  const locations = keys.map(key => {
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const stepIndex = blocks[blockIndex]!.steps.findIndex(step => step.key === key);
      if (stepIndex >= 0) return { blockIndex, stepIndex };
    }
    return null;
  });
  if (locations.some(location => location === null)) return false;
  const ordered = locations as { blockIndex: number; stepIndex: number }[];
  if (ordered.some(location => blocks[location.blockIndex]!.repeatCount !== 1 || blocks[location.blockIndex]!.steps.length !== 1)) return false;
  const indexes = ordered.map(location => location.blockIndex).sort((a, b) => a - b);
  return indexes.every((value, index) => index === 0 || value === indexes[index - 1]! + 1);
}

export function groupConsecutiveSteps(blocks: EditorBlock[], keys: string[], repeatCount: number, key = `block-${Date.now()}`): EditorBlock[] {
  if (!Number.isInteger(repeatCount) || repeatCount < 2) throw new Error('O bloco precisa repetir ao menos 2 vezes');
  if (!selectedStepKeysAreConsecutive(blocks, keys)) throw new Error('Selecione etapas consecutivas para agrupar');
  const selected = new Set(keys);
  const firstIndex = blocks.findIndex(block => selected.has(block.steps[0]!.key));
  const steps = blocks.filter(block => selected.has(block.steps[0]!.key)).flatMap(block => block.steps).map(step => ({ ...step, selected: false }));
  return [...blocks.slice(0, firstIndex), { key, repeatCount, steps }, ...blocks.slice(firstIndex + steps.length)];
}

export function ungroupBlock(blocks: EditorBlock[], blockKey: string): EditorBlock[] {
  const index = blocks.findIndex(block => block.key === blockKey);
  if (index < 0) return blocks;
  const block = blocks[index]!;
  const singles = block.steps.map((step, stepIndex) => ({ key: `${block.key}-single-${stepIndex}`, repeatCount: 1, steps: [{ ...step, selected: false }] }));
  return [...blocks.slice(0, index), ...singles, ...blocks.slice(index + 1)];
}

export function reorderWithinBlock(blocks: EditorBlock[], blockKey: string, from: number, to: number): EditorBlock[] {
  const blockIndex = blocks.findIndex(block => block.key === blockKey);
  const block = blocks[blockIndex];
  if (!block || from < 0 || to < 0 || from >= block.steps.length || to >= block.steps.length || from === to) return blocks;
  const steps = [...block.steps];
  const [moved] = steps.splice(from, 1);
  steps.splice(to, 0, moved!);
  const next = [...blocks]; next[blockIndex] = { ...block, steps };
  return next;
}

export function reorderBlocks(blocks: EditorBlock[], from: number, to: number): EditorBlock[] {
  if (from < 0 || to < 0 || from >= blocks.length || to >= blocks.length || from === to) return blocks;
  const next = [...blocks]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved!); return next;
}

export function removeEditorStep(blocks: EditorBlock[], blockKey: string, stepKey: string): EditorBlock[] {
  return blocks.flatMap(block => block.key !== blockKey
    ? [block]
    : block.steps.length === 1
      ? []
      : [{ ...block, steps: block.steps.filter(step => step.key !== stepKey) }]);
}

export function updateEditorStep(blocks: EditorBlock[], stepKey: string, update: Pick<EditorStep, 'stepType' | 'durationSeconds' | 'instructions'>): EditorBlock[] {
  return blocks.map(block => ({ ...block, steps: block.steps.map(step => step.key === stepKey ? { ...step, ...update } : step) }));
}

export function updateBlockRepeatCount(blocks: EditorBlock[], blockKey: string, repeatCount: number): EditorBlock[] {
  if (!Number.isInteger(repeatCount) || repeatCount < 2) throw new Error('O bloco precisa repetir ao menos 2 vezes');
  return blocks.map(block => block.key === blockKey ? { ...block, repeatCount } : block);
}
