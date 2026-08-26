import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '../design/tokens';

export const AnalyticsPrivacyCard = () => {
  return (
    <View>
      <View style={styles.titleRow}>
        <Feather name="bar-chart-2" size={19} color={colors.primary} />
        <Text style={styles.title}>Hesaplama kullanım verileri</Text>
      </View>
      <Text style={styles.paragraph}>
        Hesaplayıcıları geliştirmek için kredi türü, tutar, vade ve oran gibi
        hesaplama özetleri hesabınızla ilişkilendirilmeden gönderilir. Ad,
        e-posta, telefon, profil ve abonelik destek kimliği gönderilmez.
        İnternet yoksa hesaplama kesintisiz devam eder.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sectionTitle,
    fontWeight: '700',
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
