import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../design/tokens';
import { usePushNotifications } from './PushNotificationProvider';

export const PushNotificationCard = () => {
  const { status, enableNotifications } = usePushNotifications();
  const enabled = status === 'enabled';
  const denied = status === 'denied';

  return (
    <View>
      <View style={styles.titleRow}>
        <Feather name={enabled ? 'bell' : 'bell-off'} size={19} color={colors.primary} />
        <Text style={styles.title}>Bildirimler</Text>
      </View>
      <Text style={styles.paragraph}>
        {enabled
          ? 'Müşteri talepleri, topluluk etkileşimleri ve önemli hesap gelişmeleri için bildirimler bu cihazda açık.'
          : 'Talep linkleri, müşteri başvuruları, topluluk etkileşimleri ve önemli hesap gelişmelerini kaçırmayın.'}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (enabled || denied) void Linking.openSettings();
          else void enableNotifications();
        }}
      >
        <Text style={styles.buttonText}>
          {enabled || denied ? 'Cihaz ayarlarını aç' : 'Bildirimleri aç'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: typography.sectionTitle, fontWeight: '700' },
  paragraph: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22, marginBottom: spacing.md },
  button: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 46 },
  buttonText: { color: colors.primary, fontSize: typography.body, fontWeight: '800' },
});
