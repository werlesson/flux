import { View } from 'react-native';

import { StepTypeAccent } from '@/components/step-type-accent';
import type { StepTypeSlug } from '@/constants/theme';

type StepSummary = { label: string; slug: StepTypeSlug };

function StepSurface({ steps }: { steps: readonly StepSummary[] }) {
  return (
    <View>
      {steps.map((step, index) => (
        <StepTypeAccent key={`${step.slug}-${index}`} {...step} />
      ))}
    </View>
  );
}

/** Step colors in the training editor. */
export function TrainingEditorSteps({ steps }: { steps: readonly StepSummary[] }) {
  return <StepSurface steps={steps} />;
}

/** Step colors in compact library summaries. */
export function TrainingLibrarySteps({ steps }: { steps: readonly StepSummary[] }) {
  return <StepSurface steps={steps} />;
}

/** Current and next step colors during an activity. */
export function ActivitySteps({ steps }: { steps: readonly StepSummary[] }) {
  return <StepSurface steps={steps} />;
}

/** Executed step colors in the activity result. */
export function ActivityResultSteps({ steps }: { steps: readonly StepSummary[] }) {
  return <StepSurface steps={steps} />;
}
