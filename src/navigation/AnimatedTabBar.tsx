import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, premium, spacing, typography } from '../design/tokens';
import { useKeyboardVisibility } from '../hooks/useKeyboardVisibility';

const BAR_CONTENT_HEIGHT = 56;
const INDICATOR_WIDTH = 28;
const INDICATOR_HEIGHT = 3;

type TabItemProps = {
  isFocused: boolean;
  animatesFocus: boolean;
  children: React.ReactNode;
};

const PremiumCrown = () => (
  <MaterialCommunityIcons
    name="crown"
    size={14}
    color={premium.accent}
    style={styles.premiumBadge}
  />
);

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
  premiumRouteNames = [],
  showPremiumBadges = true,
}: BottomTabBarProps & {
  premiumRouteNames?: readonly string[];
  showPremiumBadges?: boolean;
}) => {
  const isKeyboardVisible = useKeyboardVisibility();
  const insets = useSafeAreaInsets();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const wasKeyboardVisible = useRef(isKeyboardVisible);

  const tabWidth = state.routes.length > 0 ? barWidth / state.routes.length : 0;
  const bottomPadding =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, spacing.lg)
      : insets.bottom;
  const selectedRouteIsPremium = premiumRouteNames.includes(
    state.routes[state.index]?.name
  );

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
    const didRevealAfterKeyboard =
      wasKeyboardVisible.current && !isKeyboardVisible;
    wasKeyboardVisible.current = isKeyboardVisible;

    if (isKeyboardVisible || tabWidth === 0) {
      return;
    }

    const target = tabWidth * state.index + (tabWidth - INDICATOR_WIDTH) / 2;

    if (prefersReducedMotion || didRevealAfterKeyboard) {
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
  }, [indicatorX, isKeyboardVisible, prefersReducedMotion, state.index, tabWidth]);

  if (Platform.OS === 'android' && isKeyboardVisible) {
    return null;
  }

  return (
    <View
      style={styles.bar}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              backgroundColor: selectedRouteIsPremium
                ? premium.accent
                : colors.primary,
            },
            { transform: [{ translateX: indicatorX }] },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.row,
          {
            minHeight: BAR_CONTENT_HEIGHT + bottomPadding,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isPremiumRoute = premiumRouteNames.includes(route.name);
          const label = options.title ?? route.name;
          const defaultColor = isFocused ? colors.primary : colors.textMuted;
          const itemColor = isPremiumRoute ? premium.accent : defaultColor;

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
                {isPremiumRoute && showPremiumBadges ? (
                  <PremiumCrown />
                ) : null}
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color: itemColor,
                  size: 22,
                })}
                <Text
                  style={[styles.label, { color: itemColor }]}
                  numberOfLines={1}
                >
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
    minHeight: BAR_CONTENT_HEIGHT,
    paddingTop: spacing.xs,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  indicator: {
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
  premiumBadge: {
    left: 0,
    position: 'absolute',
    top: -2,
    zIndex: 1,
  },
  label: {
    fontSize: typography.small,
    fontWeight: '700',
  },
});

export default AnimatedTabBar;
