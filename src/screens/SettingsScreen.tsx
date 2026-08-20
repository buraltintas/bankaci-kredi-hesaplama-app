import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../design/tokens';
import { usePremium } from '../subscription/PremiumProvider';
import { usePaywall } from '../subscription/PaywallProvider';
import {
  getSubscriptionManagementUrl,
  restorePremiumPurchases,
} from '../subscription/purchases';
import {
  ABOUT_CREDIT_NAME,
  ABOUT_CREDIT_PREFIX,
  ABOUT_CREDIT_SUFFIX,
  ABOUT_PARAGRAPHS,
  ABOUT_WEBSITE_LABEL,
  ABOUT_WEBSITE_URL,
} from '../content/about';

const getAppVersion = (): string => {
  return Constants.expoConfig?.version ?? '—';
};

const SettingsScreen = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const { isPremium } = usePremium();
  const { openPaywall } = usePaywall();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    const restored = await restorePremiumPurchases();
    setIsRestoring(false);

    Alert.alert(
      restored ? 'Geri yüklendi' : 'Satın alma bulunamadı',
      restored
        ? 'Reklamsız kullanım hesabınıza tanımlandı.'
        : 'Mağaza hesabınızda aktif bir abonelik bulunamadı.'
    );
  }, []);

  const handleManageSubscription = useCallback(async () => {
    const managementUrl = await getSubscriptionManagementUrl();

    if (!managementUrl) {
      Alert.alert(
        'Abonelik yönetimi açılamadı',
        'Aboneliğinizi cihazınızın App Store veya Google Play hesap ayarlarından yönetebilirsiniz.'
      );
      return;
    }

    try {
      await Linking.openURL(managementUrl);
    } catch {
      Alert.alert('Bağlantı açılamadı', 'Abonelik sayfası şu anda açılamıyor.');
    }
  }, []);

  const handleOpenWebsite = useCallback(async () => {
    try {
      await Linking.openURL(ABOUT_WEBSITE_URL);
    } catch {
      Alert.alert('Bağlantı açılamadı', 'Web sitesi şu anda açılamıyor.');
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Bankacı</Text>
          <Text style={styles.title}>Ayarlar</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {isPremium ? 'Reklamsız kullanım' : 'Reklamları kaldır'}
          </Text>
          <Text style={styles.paragraph}>
            {isPremium
              ? 'Reklamsız kullanım aktif. Uygulamada banner ve geçiş reklamı gösterilmiyor.'
              : 'Banner ve geçiş reklamlarını tamamen kapatın, tüm hesaplama özellikleri açık kalsın.'}
          </Text>

          {isPremium ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Aboneliği yönet"
              style={styles.secondaryButton}
              onPress={() => void handleManageSubscription()}
            >
              <Text style={styles.secondaryButtonText}>Aboneliği yönet</Text>
              <Feather name="external-link" size={17} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Reklamsız seçenekleri gör"
              style={styles.primaryButton}
              onPress={openPaywall}
            >
              <Text style={styles.primaryButtonText}>Seçenekleri gör</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Satın alımları geri yükle"
            style={styles.secondaryButton}
            onPress={() => void handleRestore()}
            disabled={isRestoring}
          >
            <Text style={styles.secondaryButtonText}>
              {isRestoring ? 'Geri yükleniyor…' : 'Satın alımları geri yükle'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hakkında</Text>
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          <Text style={styles.paragraph}>
            {ABOUT_CREDIT_PREFIX}
            <Text style={styles.paragraphStrong}>{ABOUT_CREDIT_NAME}</Text>
            {ABOUT_CREDIT_SUFFIX}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>İletişim</Text>
          <Text style={styles.paragraph}>
            Geri bildirim ve iletişim için web sitesini ziyaret edebilirsiniz.
          </Text>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={`${ABOUT_WEBSITE_LABEL} adresini aç`}
            style={styles.linkButton}
            onPress={handleOpenWebsite}
          >
            <Text style={styles.linkText}>{ABOUT_WEBSITE_LABEL}</Text>
            <Feather name="external-link" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Uygulama</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Sürüm</Text>
            <Text style={styles.rowValue}>{getAppVersion()}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  paragraphStrong: {
    color: colors.text,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  rowValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
});

export default SettingsScreen;
