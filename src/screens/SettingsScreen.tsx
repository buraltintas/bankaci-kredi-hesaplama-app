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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  colors,
  premium,
  radius,
  shadows,
  spacing,
  typography,
} from '../design/tokens';
import { usePremium } from '../subscription/PremiumProvider';
import { usePaywall } from '../subscription/PaywallProvider';
import {
  getSubscriptionManagementUrl,
  identifyRevenueCatUser,
  refreshPremiumStatus,
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
import { ProfileCard } from '../auth/ProfileCard';
import { useAuth } from '../auth/AuthProvider';
import { PushNotificationCard } from '../notifications/PushNotificationCard';
import { AnalyticsPrivacyCard } from '../analytics/AnalyticsPrivacyCard';

const getAppVersion = (): string => {
  return Constants.expoConfig?.version ?? '—';
};

const SettingsScreen = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const { isPremium } = usePremium();
  const { user, deleteAccount } = useAuth();
  const { openPaywall } = usePaywall();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRefreshingPremium, setIsRefreshingPremium] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    const restored = await restorePremiumPurchases();
    setIsRestoring(false);

    Alert.alert(
      restored ? 'Geri yüklendi' : 'Satın alma bulunamadı',
      restored
        ? 'Bankacı Premium hesabınıza tanımlandı.'
        : 'Mağaza hesabınızda aktif bir abonelik bulunamadı.'
    );
  }, []);

  const handleRefreshPremium = useCallback(async () => {
    setIsRefreshingPremium(true);
    if (user) {
      await identifyRevenueCatUser(user.revenueCatUserId, user.email);
    }
    const refreshed = await refreshPremiumStatus(true);
    setIsRefreshingPremium(false);

    if (refreshed === null) {
      Alert.alert(
        'Premium kontrol edilemedi',
        'İnternet bağlantınızı kontrol edip tekrar deneyin.'
      );
      return;
    }

    Alert.alert(
      refreshed ? 'Premium aktif' : 'Aktif Premium bulunamadı',
      refreshed
        ? 'Bankacı Premium erişiminiz yenilendi.'
        : 'Hesabınızda aktif bir Bankacı Premium erişimi bulunamadı.'
    );
  }, [user]);

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

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Bankacı hesabınızı silmek istiyor musunuz?',
      'Profiliniz, paylaşımlarınız, yorumlarınız, oturumlarınız ve bildirim cihazlarınız kalıcı olarak silinir. Bu işlem mağaza aboneliğinizi otomatik olarak iptal etmez.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam et',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Bu işlem geri alınamaz',
              'Hesabınızı ve hesabınıza bağlı kişisel verileri kalıcı olarak silmek için onaylayın.',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Hesabımı kalıcı olarak sil',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      await deleteAccount();
                      Alert.alert('Hesap silindi', 'Bankacı hesabınız ve ilişkili kişisel verileriniz silindi.');
                    } catch {
                      Alert.alert('Hesap silinemedi', 'Bağlantınızı kontrol edip tekrar deneyin.');
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

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
          <ProfileCard />
        </View>

        <View style={styles.card}>
          <PushNotificationCard />
        </View>

        <View style={styles.card}>
          <View style={styles.premiumTitleRow}>
            <MaterialCommunityIcons
              name="crown"
              size={20}
              color={premium.accent}
            />
            <Text style={[styles.sectionTitle, styles.premiumTitle]}>
              Bankacı Premium
            </Text>
          </View>
          <Text style={styles.paragraph}>
            {isPremium
              ? 'Premium üyeliğiniz aktif. Tüm gelişmiş hesaplama araçları açık ve reklamlar kapalı.'
              : 'Konut kredisi devir hesaplama, gelişmiş ödeme planları, PDF paylaşımı ve reklamsız kullanım.'}
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
              accessibilityLabel="Premium seçeneklerini gör"
              style={styles.primaryButton}
              onPress={openPaywall}
            >
              <Text style={styles.primaryButtonText}>Seçenekleri gör</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Premium erişimini kontrol et"
            style={styles.secondaryButton}
            onPress={() => void handleRefreshPremium()}
            disabled={isRefreshingPremium || isRestoring}
          >
            <Text style={styles.secondaryButtonText}>
              {isRefreshingPremium
                ? 'Premium kontrol ediliyor…'
                : 'Premium erişimini kontrol et'}
            </Text>
            <Feather name="refresh-cw" size={17} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.actionHint}>
            Hesabınıza sonradan tanımlanan Premium erişimini kontrol eder.
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Satın alımları geri yükle"
            style={styles.secondaryButton}
            onPress={() => void handleRestore()}
            disabled={isRestoring || isRefreshingPremium}
          >
            <Text style={styles.secondaryButtonText}>
              {isRestoring ? 'Geri yükleniyor…' : 'Satın alımları geri yükle'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.actionHint}>
            App Store veya Google Play üzerinden daha önce yapılan satın
            alımları geri getirir.
          </Text>
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Gizlilik ve veriler"
            accessibilityState={{ expanded: isPrivacyExpanded }}
            onPress={() => setIsPrivacyExpanded((current) => !current)}
            style={styles.accordionHeader}
          >
            <View style={styles.accordionTitleRow}>
              <Feather name="shield" size={19} color={colors.primary} />
              <Text style={styles.accordionTitle}>Gizlilik ve veriler</Text>
            </View>
            <Feather
              name={isPrivacyExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {isPrivacyExpanded ? (
            <View style={styles.accordionContent}>
              <AnalyticsPrivacyCard />
            </View>
          ) : null}
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

        {user ? (
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.sectionTitle}>Hesap işlemleri</Text>
            <Text style={styles.paragraph}>
              Hesabınızı ve hesabınıza bağlı kişisel verileri kalıcı olarak silebilirsiniz.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Hesabı kalıcı olarak sil"
              disabled={isDeletingAccount}
              onPress={handleDeleteAccount}
              style={styles.deleteAccountButton}
            >
              <Feather name="trash-2" size={18} color={colors.danger} />
              <Text style={styles.deleteAccountText}>
                {isDeletingAccount ? 'Hesap siliniyor…' : 'Hesabı sil'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    paddingTop: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
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
  premiumTitle: {
    marginBottom: 0,
  },
  premiumTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accordionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  accordionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accordionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '700',
  },
  accordionContent: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.lg,
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
  actionHint: {
    color: colors.placeholder,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
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
  dangerCard: {
    borderColor: 'rgba(198, 40, 40, 0.28)',
  },
  deleteAccountButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
  },
  deleteAccountText: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
});

export default SettingsScreen;
