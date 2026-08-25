import React, { useEffect, useState } from 'react';
import { Image, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { PremiumProvider } from './src/subscription/PremiumProvider';
import { PaywallProvider } from './src/subscription/PaywallProvider';
import ForceUpdateGate from './src/update/ForceUpdateGate';
import { AuthProvider } from './src/auth/AuthProvider';
import { PushNotificationProvider } from './src/notifications/PushNotificationProvider';
import { navigationRef } from './src/navigation/navigationRef';
import { AnalyticsProvider } from './src/analytics/AnalyticsProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const APP_SPLASH_DURATION_MS = 1200;
const shouldShowAppSplash = Platform.OS === 'android';
const appSplashImage = require('./assets/splash.png');

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F3F6FA',
    card: '#FFFFFF',
    primary: '#0B5CAD',
    text: '#14213D',
    border: '#D8E1EA',
  },
};

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
      <AnalyticsProvider>
        <AuthProvider>
          <PushNotificationProvider>
            <PremiumProvider>
              <PaywallProvider>
                <SafeAreaProvider>
                  <ForceUpdateGate>
                    <View style={styles.root}>
                      {Platform.OS === 'android' ? (
                        <StatusBar
                          backgroundColor={
                            showAppSplash ? '#F4FAFF' : '#F3F6FA'
                          }
                          barStyle="dark-content"
                        />
                      ) : null}
                      <NavigationContainer
                        ref={navigationRef}
                        theme={navigationTheme}
                      >
                        <RootNavigator />
                      </NavigationContainer>
                      {showAppSplash ? (
                        <View style={styles.appSplash} pointerEvents="none">
                          <Image
                            source={appSplashImage}
                            style={styles.appSplashImage}
                            resizeMode="cover"
                          />
                        </View>
                      ) : null}
                    </View>
                  </ForceUpdateGate>
                </SafeAreaProvider>
              </PaywallProvider>
            </PremiumProvider>
          </PushNotificationProvider>
        </AuthProvider>
      </AnalyticsProvider>
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
