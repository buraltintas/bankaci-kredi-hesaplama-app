import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../design/tokens';

const INDICATOR_WIDTH = 28;

export type SlidingTabOption<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SlidingTabOption<T>[];
};

export default function SlidingTabs<T extends string>({ value, onChange, options }: Props<T>) {
  const selectedIndex = Math.max(0, options.findIndex((item) => item.key === value));
  const progress = useRef(new Animated.Value(selectedIndex)).current;
  const [width, setWidth] = useState(0);
  const tabWidth = Math.max(0, (width - spacing.lg * 2) / options.length);
  const inputRange = options.map((_, index) => index);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selectedIndex,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, selectedIndex]);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View accessibilityRole="tablist" style={styles.container} onLayout={onLayout}>
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              transform: [{
                translateX: progress.interpolate({
                  inputRange,
                  outputRange: options.map(
                    (_, index) => spacing.lg + tabWidth * index + (tabWidth - INDICATOR_WIDTH) / 2
                  ),
                }),
              }],
            },
          ]}
        />
      ) : null}
      {options.map((item, index) => {
        const selected = value === item.key;
        const color = progress.interpolate({
          inputRange,
          outputRange: options.map((_, tabIndex) =>
            index === tabIndex ? colors.primary : colors.textMuted
          ),
        });
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            activeOpacity={0.82}
            onPress={() => onChange(item.key)}
            style={styles.tab}
          >
            <Animated.Text numberOfLines={1} style={[styles.text, { color }]}>
              {item.label}
            </Animated.Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderBottomColor: 'rgba(216, 225, 234, 0.78)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    position: 'relative',
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  indicator: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    bottom: 0,
    height: 3,
    left: 0,
    position: 'absolute',
    width: INDICATOR_WIDTH,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingBottom: 13,
    paddingTop: 11,
    zIndex: 1,
  },
  text: { fontSize: 13, fontWeight: '800' },
});
