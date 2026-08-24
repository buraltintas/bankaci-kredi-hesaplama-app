import { useCallback, useEffect, useRef } from 'react';
import {
  AppState,
  Keyboard,
  Platform,
  TextInput,
  type LayoutChangeEvent,
  type ScrollView,
} from 'react-native';
import type { MutableRefObject, RefObject } from 'react';

type UseCalculatorScrollOptions = {
  scrollViewRef: RefObject<ScrollView | null>;
  result: unknown;
  keyboardExtraOffset: number;
  dismissKeyboardOnIos?: boolean;
};

type CalculatorScrollController = {
  onResultLayout: (event: LayoutChangeEvent) => void;
  scrollToResult: () => void;
};

const scheduleAfterLayout = (callback: () => void): (() => void) => {
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(callback);
  });

  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
  };
};

/**
 * Keeps the focused field above Android's keyboard/action bar and waits for a
 * real result layout coordinate before scrolling. This avoids the race where
 * a newly mounted result still has the default y=0.
 */
export const useCalculatorScroll = ({
  scrollViewRef,
  result,
  keyboardExtraOffset,
  dismissKeyboardOnIos = false,
}: UseCalculatorScrollOptions): CalculatorScrollController => {
  const resultAnchorY: MutableRefObject<number> = useRef(0);
  const isKeyboardVisible = useRef(false);
  const isResultScrollPending = useRef(false);
  const focusedInputRetry = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null
  );

  const performResultScroll = useCallback(() => {
    if (
      !isResultScrollPending.current ||
      isKeyboardVisible.current ||
      Keyboard.isVisible() ||
      resultAnchorY.current <= 0
    ) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, resultAnchorY.current - 8),
      animated: true,
    });
    isResultScrollPending.current = false;
  }, [scrollViewRef]);

  const scrollToResult = useCallback(() => {
    if (Platform.OS !== 'android') {
      if (dismissKeyboardOnIos) {
        Keyboard.dismiss();
      }

      globalThis.setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, resultAnchorY.current - 8),
          animated: true,
        });
      }, 120);
      return;
    }

    isResultScrollPending.current = true;
    const wasKeyboardVisible =
      isKeyboardVisible.current || Keyboard.isVisible();
    Keyboard.dismiss();

    if (!wasKeyboardVisible) {
      scheduleAfterLayout(performResultScroll);
    }
  }, [dismissKeyboardOnIos, performResultScroll, scrollViewRef]);

  const onResultLayout = useCallback(
    (event: LayoutChangeEvent) => {
      resultAnchorY.current = event.nativeEvent.layout.y;

      if (
        Platform.OS === 'android' &&
        !isKeyboardVisible.current &&
        !Keyboard.isVisible()
      ) {
        scheduleAfterLayout(performResultScroll);
      }
    },
    [performResultScroll]
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    if (!result) {
      resultAnchorY.current = 0;
      return undefined;
    }

    if (!isKeyboardVisible.current && !Keyboard.isVisible()) {
      return scheduleAfterLayout(performResultScroll);
    }

    return undefined;
  }, [performResultScroll, result]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardVisible.current = true;

      const focusedInput = TextInput.State.currentlyFocusedInput();

      if (!focusedInput) {
        return;
      }

      const revealFocusedInput = () => {
        scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
          focusedInput,
          keyboardExtraOffset,
          true
        );
      };

      // The Android-only action and tab bars disappear in response to this
      // same keyboard event. Reveal once immediately, then again after that
      // layout change settles so the focused field cannot slide back under
      // the keyboard.
      scheduleAfterLayout(revealFocusedInput);
      focusedInputRetry.current = globalThis.setTimeout(
        revealFocusedInput,
        180
      );
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardVisible.current = false;
      scheduleAfterLayout(performResultScroll);
    });
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        isKeyboardVisible.current =
          nextAppState === 'active' && Keyboard.isVisible();

        if (!isKeyboardVisible.current) {
          scheduleAfterLayout(performResultScroll);
        }
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      appStateSubscription.remove();
      if (focusedInputRetry.current) {
        globalThis.clearTimeout(focusedInputRetry.current);
      }
    };
  }, [keyboardExtraOffset, performResultScroll, scrollViewRef]);

  return { onResultLayout, scrollToResult };
};
