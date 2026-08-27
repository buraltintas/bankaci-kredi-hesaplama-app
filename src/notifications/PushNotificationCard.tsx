import React from 'react';
import {
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../design/tokens';
import type { NotificationCategory } from '../api/types';
import { usePushNotifications } from './PushNotificationProvider';

const CATEGORY_LABELS: {
  key: NotificationCategory;
  title: string;
  description: string;
}[] = [
  {
    key: 'requests',
    title: 'Talepler',
    description: 'Talep linkiniz açıldığında ve yeni başvuru geldiğinde',
  },
  {
    key: 'feed',
    title: 'Öğle Arası',
    description: 'Yeni gönderiler ve gönderilerinize gelen etkileşimler',
  },
  {
    key: 'announcements',
    title: 'Duyurular',
    description: 'Bankacı ekibinden önemli duyurular',
  },
];

export const PushNotificationCard = () => {
  const { status, enableNotifications, preferences, setPreference } =
    usePushNotifications();
  const enabled = status === 'enabled';
  const denied = status === 'denied';

  return (
    <View>
      <View style={styles.titleRow}>
        <Feather
          name={enabled ? 'bell' : 'bell-off'}
          size={19}
          color={colors.primary}
        />
        <Text style={styles.title}>Bildirimler</Text>
      </View>
      <Text style={styles.paragraph}>
        {enabled
          ? 'Hangi bildirimleri almak istediğinizi seçin. İzni cihaz ayarlarından yönetebilirsiniz.'
          : 'Talep linkleri, müşteri başvuruları, topluluk etkileşimleri ve önemli duyuruları kaçırmayın.'}
      </Text>

      {enabled ? (
        <View style={styles.toggleGroup}>
          {CATEGORY_LABELS.map((category) => (
            <View key={category.key} style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>{category.title}</Text>
                <Text style={styles.toggleDescription}>
                  {category.description}
                </Text>
              </View>
              <Switch
                value={preferences[category.key]}
                onValueChange={(value) =>
                  void setPreference(category.key, value)
                }
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          ))}
        </View>
      ) : null}

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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '700',
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  toggleGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  toggleRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  toggleDescription: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 2,
  },
  button: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
