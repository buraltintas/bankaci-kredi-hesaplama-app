import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/tokens';
import CreditScreen from '../screens/CreditScreen';
import AnimatedTabBar from './AnimatedTabBar';
import SettingsScreen from '../screens/SettingsScreen';
import FeedScreen from '../screens/FeedScreen';
import RequestsScreen from '../screens/RequestsScreen';

export type RootTabParamList = {
  Loan: undefined;
  Requests: undefined;
  Feed: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const RootNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} premiumRouteNames={['Requests']} />}
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
          title: 'Hesaplama',
          tabBarAccessibilityLabel: 'Hesaplama araçları',
          tabBarIcon: ({ color, size }) => (
            <Feather name="percent" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{
          title: 'Talepler',
          tabBarAccessibilityLabel: 'Premium talep yönetimi',
          tabBarIcon: ({ color, size }) => (
            <Feather name="inbox" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: 'Öğle Arası',
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
