import { Text, View } from 'react-native';

import { getStepTypeColor, type StepTypeSlug } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepTypeAccentProps = {
  label: string;
  slug: StepTypeSlug;
};

/** Shared step marker so every surface resolves color from the database slug. */
export function StepTypeAccent({ label, slug }: StepTypeAccentProps) {
  const theme = useTheme();
  const stepColor = getStepTypeColor(slug);

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', minHeight: theme.sizes.minimumTouchTarget }}>
      <View
        accessibilityLabel={`Tipo de etapa: ${label}`}
        style={{
          backgroundColor: stepColor,
          borderRadius: theme.radii.pill,
          height: theme.spacing.lg,
          marginRight: theme.spacing.sm,
          width: theme.spacing.xs,
        }}
      />
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.title.medium }}>
        {label}
      </Text>
    </View>
  );
}
