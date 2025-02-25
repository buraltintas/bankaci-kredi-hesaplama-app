import { SafeAreaView } from 'react-native';
import LoanCalculator from '../components/LoanCalculator';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <LoanCalculator />
    </SafeAreaView>
  );
}
