import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import LoanCalculator from './components/LoanCalculator';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

type ErrorBoundaryState = {
  error: Error | null;
};

class RootErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[root] render failed', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#F3F6FA',
          }}
        >
          <Text style={{ color: '#14213D', fontSize: 20, fontWeight: '800' }}>
            Uygulama başlatılamadı
          </Text>
          <Text style={{ color: '#607083', marginTop: 12 }}>
            {this.state.error.message || 'Beklenmeyen bir hata oluştu.'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function RootApp() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#F3F6FA' }}>
          <LoanCalculator />
        </View>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
