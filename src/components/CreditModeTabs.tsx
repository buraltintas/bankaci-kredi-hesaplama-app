import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, premium, spacing } from '../design/tokens';

const INDICATOR_WIDTH = 28;

export type CreditMode = 'individual' | 'commercial' | 'transfer' | 'deposit';

type Props = {
  value: CreditMode;
  onChange: (value: CreditMode) => void;
  progress?: Animated.Value;
  showTransferPremiumBadge?: boolean;
};

const MODE_INDEX: Record<CreditMode, number> = {
  individual: 0,
  commercial: 1,
  transfer: 2,
  deposit: 3,
};

const TABS = [
  ['individual', 'Bireysel'],
  ['commercial', 'Ticari'],
  ['transfer', 'Konut Devir'],
  ['deposit', 'Mevduat'],
] as const;

export default function CreditModeTabs({
  value,
  onChange,
  progress,
  showTransferPremiumBadge = false,
}: Props) {
  const localProgress = useRef(
    new Animated.Value(MODE_INDEX[value])
  ).current;
  const animatedProgress = progress ?? localProgress;
  const [width, setWidth] = useState(0);
  const tabWidth = Math.max(
    0,
    (width - spacing.lg * 2) / TABS.length
  );

  useEffect(() => {
    if (progress) return;
    Animated.timing(localProgress, {
      toValue: MODE_INDEX[value],
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [localProgress, progress, value]);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      accessibilityRole="tablist"
      style={styles.container}
      onLayout={onLayout}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              transform: [
                {
                  translateX: animatedProgress.interpolate({
                    inputRange: [0, 1, 2, 3],
                    outputRange: [
                      spacing.lg + (tabWidth - INDICATOR_WIDTH) / 2,
                      spacing.lg +
                        tabWidth +
                        (tabWidth - INDICATOR_WIDTH) / 2,
                      spacing.lg +
                        tabWidth * 2 +
                        (tabWidth - INDICATOR_WIDTH) / 2,
                      spacing.lg +
                        tabWidth * 3 +
                        (tabWidth - INDICATOR_WIDTH) / 2,
                    ],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {TABS.map(([key, label], index) => {
          const selected = value === key;
          const color = animatedProgress.interpolate({
            inputRange: [0, 1, 2, 3],
            outputRange: TABS.map((_, tabIndex) =>
              index === tabIndex ? colors.primary : colors.textMuted
            ),
          });
          return (
            <TouchableOpacity
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              activeOpacity={0.82}
              onPress={() => onChange(key)}
              style={styles.tab}
            >
              <View style={styles.labelRow}>
                {key === 'transfer' && showTransferPremiumBadge ? (
                  <MaterialCommunityIcons
                    name="crown"
                    size={13}
                    color={premium.accent}
                  />
                ) : null}
                <Animated.Text
                  numberOfLines={1}
                  style={[styles.text, { color }]}
                >
                  {label}
                </Animated.Text>
              </View>
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
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
  },
  text: { fontSize: 13, fontWeight: '800' },
});
