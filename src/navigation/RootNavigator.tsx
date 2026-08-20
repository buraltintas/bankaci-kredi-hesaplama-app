import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '../design/tokens';
import LoanCalculator from '../../components/LoanCalculator';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Loan: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_BAR_MIN_HEIGHT = 60;

const RootNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Loan"
        component={LoanCalculator}
        options={{
          title: 'Kredi',
          tabBarAccessibilityLabel: 'Kredi hesaplama',
          tabBarIcon: ({ color, size }) => (
            <Feather name="percent" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Ayarlar',
          tabBarAccessibilityLabel: 'Ayarlar',
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    minHeight: TAB_BAR_MIN_HEIGHT,
    paddingTop: spacing.xs,
  },
  tabBarItem: {
    minHeight: 44,
    paddingVertical: Platform.OS === 'android' ? spacing.xs : 0,
  },
  tabBarLabel: {
    fontSize: typography.small,
    fontWeight: '700',
  },
});

export default RootNavigator;
