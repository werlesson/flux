import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flux</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#15100F',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FAF3E6',
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 48,
  },
});
