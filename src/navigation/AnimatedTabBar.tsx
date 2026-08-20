import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '../design/tokens';

const BAR_CONTENT_HEIGHT = 56;
const INDICATOR_WIDTH = 28;
const INDICATOR_HEIGHT = 3;

type TabItemProps = {
  isFocused: boolean;
  animatesFocus: boolean;
  children: React.ReactNode;
};

/**
 * Keeps the plain bar the app already had and only softens the moment of
 * change: the selected tab settles in rather than snapping.
 */
const TabItemContent = ({
  isFocused,
  animatesFocus,
  children,
}: TabItemProps) => {
  const focus = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    if (!animatesFocus) {
      focus.setValue(isFocused ? 1 : 0);
      return;
    }

    const animation = Animated.spring(focus, {
      toValue: isFocused ? 1 : 0,
      damping: 16,
      stiffness: 200,
      mass: 0.7,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [animatesFocus, focus, isFocused]);

  return (
    <Animated.View
      style={[
        styles.tabContent,
        {
          opacity: focus.interpolate({
            inputRange: [0, 1],
            outputRange: [0.75, 1],
          }),
          transform: [
            {
              scale: focus.interpolate({
                inputRange: [0, 1],
                outputRange: [0.94, 1],
              }),
            },
            {
              translateY: focus.interpolate({
                inputRange: [0, 1],
                outputRange: [1.5, -1.5],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const AnimatedTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  const tabWidth = state.routes.length > 0 ? barWidth / state.routes.length : 0;

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

  useEffect(() => {
    if (tabWidth === 0) {
      return;
    }

    const target = tabWidth * state.index + (tabWidth - INDICATOR_WIDTH) / 2;

    if (prefersReducedMotion) {
      indicatorX.setValue(target);
      return;
    }

    const animation = Animated.spring(indicatorX, {
      toValue: target,
      damping: 18,
      stiffness: 190,
      mass: 0.8,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [indicatorX, prefersReducedMotion, state.index, tabWidth]);

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { transform: [{ translateX: indicatorX }] },
          ]}
        />
      ) : null}
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = options.title ?? route.name;
          const color = isFocused ? colors.primary : colors.textMuted;

          const handlePress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.tab}
              onPress={handlePress}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            >
              <TabItemContent
                isFocused={isFocused}
                animatesFocus={!prefersReducedMotion}
              >
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color,
                  size: 22,
                })}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {label}
                </Text>
              </TabItemContent>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: 'row',
    height: BAR_CONTENT_HEIGHT,
    paddingTop: spacing.xs,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  indicator: {
    backgroundColor: colors.primary,
    borderRadius: INDICATOR_HEIGHT,
    height: INDICATOR_HEIGHT,
    left: 0,
    position: 'absolute',
    top: BAR_CONTENT_HEIGHT - INDICATOR_HEIGHT,
    width: INDICATOR_WIDTH,
  },
  tabContent: {
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.small,
    fontWeight: '700',
  },
});

export default AnimatedTabBar;
