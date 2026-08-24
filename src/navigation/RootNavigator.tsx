import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/tokens';
import LoanCalculator from '../../components/LoanCalculator';
import DepositScreen from '../screens/DepositScreen';
import TransferScreen from '../screens/TransferScreen';
import AnimatedTabBar from './AnimatedTabBar';
import SettingsScreen from '../screens/SettingsScreen';
import { usePremium } from '../subscription/PremiumProvider';
import { usePaywall } from '../subscription/PaywallProvider';
import { canUseTransfer } from '../subscription/premiumFeatures';

export type RootTabParamList = {
  Loan: undefined;
  Transfer: undefined;
  Deposit: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const RootNavigator = () => {
  const { isPremium } = usePremium();
  const { openPaywall } = usePaywall();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <AnimatedTabBar
          {...props}
          premiumRouteNames={['Transfer']}
          showPremiumBadges={!isPremium}
        />
      )}
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
        name="Transfer"
        component={TransferScreen}
        listeners={{
          tabPress: (event) => {
            if (!canUseTransfer(isPremium)) {
              event.preventDefault();
              openPaywall();
            }
          },
        }}
        options={{
          title: 'Transfer',
          tabBarAccessibilityLabel: 'Kredi transferi, premium',
          tabBarIcon: ({ color, size }) => (
            <Feather name="repeat" size={size} color={color} />
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
