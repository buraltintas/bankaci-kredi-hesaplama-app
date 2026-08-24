import { useEffect, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';

export const useKeyboardVisibility = (): boolean => {
  const [isVisible, setIsVisible] = useState(() =>
    Platform.OS === 'android' ? Keyboard.isVisible() : false
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsVisible(false);
    });
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        setIsVisible(
          nextAppState === 'active' ? Keyboard.isVisible() : false
        );
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return isVisible;
};
