import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '../design/tokens';

const BUTTON_HEIGHT = 54;
const BAR_VERTICAL_PADDING = spacing.lg;
const SWEEP_DURATION_MS = 2400;
const FADE_DURATION_MS = 520;
/** Drawn at twice the bar width so a full slide never exposes an edge. */
const SWEEP_WIDTH_MULTIPLIER = 2;

/**
 * Soft tints rather than full-strength brand colours: this sits behind a
 * primary button on a light bar, and anything stronger reads as an alert.
 *
 * Five evenly spaced stops make the gradient repeat every half of the layer.
 * Since the layer is twice the bar wide and slides exactly one bar width per
 * cycle, the end frame is identical to the start — no seam when the loop
 * restarts.
 */
const SWEEP_COLORS = [
  'rgba(8, 119, 232, 0.05)',
  'rgba(11, 163, 107, 0.30)',
  'rgba(8, 119, 232, 0.05)',
  'rgba(11, 163, 107, 0.30)',
  'rgba(8, 119, 232, 0.05)',
] as const;

type CalculateActionBarProps = {
  onPress: () => void;
  /**
   * True once the form holds the minimum needed to calculate. The sweep is the
   * only cue that the button is now worth pressing, so it shows only then.
   */
  isReady: boolean;
  paddingBottom: number;
  label?: string;
  /** Lets each calculator carry its own mark on the button. */
  iconName?: React.ComponentProps<typeof Feather>['name'];
};

const CalculateActionBar = ({
  onPress,
  isReady,
  paddingBottom,
  label = 'Hesapla',
  iconName = 'zap',
}: CalculateActionBarProps) => {
  const sweep = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    let isActive = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isActive) {
        setPrefersReducedMotion(isEnabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setPrefersReducedMotion
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  const canAnimate = !prefersReducedMotion && barWidth > 0;

  // The sweep runs continuously while the bar can animate, and only its
  // opacity follows readiness. Starting the loop on the readiness edge made
  // the gradient snap into view mid-stride; fading an already-moving layer
  // reads as it easing in.
  useEffect(() => {
    if (!canAnimate) {
      sweep.stopAnimation();
      sweep.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => loop.stop();
  }, [canAnimate, sweep]);

  useEffect(() => {
    const animation = Animated.timing(fade, {
      toValue: canAnimate && isReady ? 1 : 0,
      duration: FADE_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [canAnimate, fade, isReady]);

  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth, 0],
  });

  return (
    <View
      style={[styles.bar, { paddingBottom }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {canAnimate ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweepLayer,
            {
              width: barWidth * SWEEP_WIDTH_MULTIPLIER,
              opacity: fade,
              transform: [{ translateX }],
            },
          ]}
        >
          <LinearGradient
            colors={SWEEP_COLORS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.85}
        style={styles.button}
        onPress={onPress}
      >
        <View style={styles.iconBadge}>
          <Feather name={iconName} size={18} color="#FFDD57" />
        </View>
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: BAR_VERTICAL_PADDING,
    position: 'absolute',
    right: 0,
  },
  sweepLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0877E8',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: BUTTON_HEIGHT,
    shadowColor: '#0877E8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#0757B8',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  label: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '800',
  },
});

export default CalculateActionBar;
