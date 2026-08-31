import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        flex: 1,
        justifyContent: 'center',
      }}>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.title.semibold,
          fontSize: theme.fontSizes.metric,
        }}>
        Flux
      </Text>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
    </View>
  );
}
