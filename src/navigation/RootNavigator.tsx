import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/tokens';
import CreditScreen from '../screens/CreditScreen';
import DepositScreen from '../screens/DepositScreen';
import AnimatedTabBar from './AnimatedTabBar';
import SettingsScreen from '../screens/SettingsScreen';
import FeedScreen from '../screens/FeedScreen';

export type RootTabParamList = {
  Loan: undefined;
  Deposit: undefined;
  Feed: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const RootNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Keep tab changes directional and avoid Android fade compositing
        // artifacts around fixed action surfaces.
        animation: 'shift',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Loan"
        component={CreditScreen}
        options={{
          title: 'Kredi',
          tabBarAccessibilityLabel: 'Kredi hesaplama',
          tabBarIcon: ({ color, size }) => (
            <Feather name="percent" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Deposit"
        component={DepositScreen}
        options={{
          title: 'Mevduat',
          tabBarAccessibilityLabel: 'Mevduat hesaplama',
          tabBarIcon: ({ color, size }) => (
            <Feather name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: 'Akış',
          tabBarAccessibilityLabel: 'Bankacı topluluğu',
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
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


export default RootNavigator;
