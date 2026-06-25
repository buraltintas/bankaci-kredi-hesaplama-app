import React, { useEffect, useState } from 'react';
import { Image, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import LoanCalculator from './components/LoanCalculator';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const APP_SPLASH_DURATION_MS = 1200;
const shouldShowAppSplash = Platform.OS === 'android';
const appSplashImage = require('./assets/splash.png');

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
  const [showAppSplash, setShowAppSplash] = useState(shouldShowAppSplash);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);

    if (!shouldShowAppSplash) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setShowAppSplash(false);
    }, APP_SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <View style={styles.root}>
          {Platform.OS === 'android' ? (
            <StatusBar
              backgroundColor={showAppSplash ? '#F4FAFF' : '#F3F6FA'}
              barStyle="dark-content"
            />
          ) : null}
          <LoanCalculator />
          {showAppSplash ? (
            <View style={styles.appSplash} pointerEvents="none">
              <Image source={appSplashImage} style={styles.appSplashImage} resizeMode="cover" />
            </View>
          ) : null}
        </View>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F6FA',
  },
  appSplash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F4FAFF',
    zIndex: 1000,
  },
  appSplashImage: {
    width: '100%',
    height: '100%',
  },
});
