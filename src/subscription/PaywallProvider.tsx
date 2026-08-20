import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { colors, radius, spacing, typography } from '../design/tokens';
import { usePremium } from './PremiumProvider';
import {
  getPremiumOffering,
  purchasePremiumPackage,
  restorePremiumPurchases,
} from './purchases';
import {
  AUTO_RENEW_DISCLOSURE,
  PAYWALL_BENEFITS,
  PAYWALL_SUBTITLE,
  PAYWALL_TITLE,
  PLATFORM_SCOPE_NOTE,
  PRIVACY_URL,
  TERMS_URL,
} from './paywallContent';

type PaywallContextValue = {
  openPaywall: () => void;
};

const PaywallContext = createContext<PaywallContextValue>({
  openPaywall: () => undefined,
});

type PackagePresentation = {
  title: string;
  caption: string;
  highlighted: boolean;
};

const describePackage = (
  purchasePackage: PurchasesPackage
): PackagePresentation => {
  switch (purchasePackage.packageType) {
    case 'ANNUAL':
      return {
        title: 'Yıllık',
        caption: 'Aylık plana göre daha avantajlı',
        highlighted: true,
      };
    case 'LIFETIME':
      return {
        title: 'Ömür boyu',
        caption: 'Tek seferlik ödeme, yenilenmez',
        highlighted: false,
      };
    case 'MONTHLY':
      return {
        title: 'Aylık',
        caption: 'Her ay yenilenir, istediğiniz zaman iptal',
        highlighted: false,
      };
    default:
      return {
        title: purchasePackage.product.title,
        caption: purchasePackage.product.description,
        highlighted: false,
      };
  }
};

const PACKAGE_ORDER = ['ANNUAL', 'LIFETIME', 'MONTHLY'];

const sortPackages = (packages: PurchasesPackage[]): PurchasesPackage[] => {
  return [...packages].sort((first, second) => {
    const firstIndex = PACKAGE_ORDER.indexOf(first.packageType);
    const secondIndex = PACKAGE_ORDER.indexOf(second.packageType);

    return (
      (firstIndex === -1 ? PACKAGE_ORDER.length : firstIndex) -
      (secondIndex === -1 ? PACKAGE_ORDER.length : secondIndex)
    );
  });
};

const openExternalUrl = async (url: string): Promise<void> => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Bağlantı açılamadı', 'Sayfa şu anda açılamıyor.');
  }
};

export const PaywallProvider = ({ children }: PropsWithChildren) => {
  const { isPremium } = usePremium();
  const [isVisible, setIsVisible] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoadingOffering, setIsLoadingOffering] = useState(false);
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const openPaywall = useCallback(() => setIsVisible(true), []);
  const closePaywall = useCallback(() => setIsVisible(false), []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let isActive = true;
    setIsLoadingOffering(true);

    void getPremiumOffering()
      .then((offering) => {
        if (!isActive) return;
        setPackages(offering ? sortPackages(offering.availablePackages) : []);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingOffering(false);
      });

    return () => {
      isActive = false;
    };
  }, [isVisible]);

  // Nothing left to sell once the entitlement is active.
  useEffect(() => {
    if (isPremium) {
      setIsVisible(false);
    }
  }, [isPremium]);

  const handlePurchase = useCallback(async (selected: PurchasesPackage) => {
    setPendingPackageId(selected.identifier);

    const outcome = await purchasePremiumPackage(selected);

    setPendingPackageId(null);

    if (outcome === 'failed') {
      Alert.alert(
        'Satın alma tamamlanamadı',
        'İşlem sırasında bir sorun oluştu. Ücret alındıysa "Satın alımları geri yükle" ile hesabınızı geri getirebilirsiniz.'
      );
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    const restored = await restorePremiumPurchases();
    setIsRestoring(false);

    if (restored) {
      Alert.alert('Geri yüklendi', 'Reklamsız kullanım hesabınıza tanımlandı.');
      return;
    }

    Alert.alert(
      'Satın alma bulunamadı',
      Platform.OS === 'ios'
        ? 'Bu Apple ID ile yapılmış aktif bir abonelik bulunamadı.'
        : 'Bu Google hesabıyla yapılmış aktif bir abonelik bulunamadı.'
    );
  }, []);

  const value = useMemo(() => ({ openPaywall }), [openPaywall]);
  const isBusy = pendingPackageId !== null || isRestoring;

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePaywall}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>{PAYWALL_TITLE}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              style={styles.closeButton}
              onPress={closePaywall}
              disabled={isBusy}
            >
              <Feather name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>{PAYWALL_SUBTITLE}</Text>

            <View style={styles.benefits}>
              {PAYWALL_BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Feather name="check" size={18} color={colors.success} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {isLoadingOffering ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}

            {!isLoadingOffering && packages.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Paketler şu anda yüklenemedi. İnternet bağlantınızı kontrol
                  edip tekrar deneyin.
                </Text>
              </View>
            ) : null}

            {packages.map((purchasePackage) => {
              const presentation = describePackage(purchasePackage);
              const isPending = pendingPackageId === purchasePackage.identifier;

              return (
                <TouchableOpacity
                  key={purchasePackage.identifier}
                  accessibilityRole="button"
                  accessibilityLabel={`${presentation.title} ${purchasePackage.product.priceString}`}
                  style={[
                    styles.packageCard,
                    presentation.highlighted && styles.packageCardHighlighted,
                  ]}
                  onPress={() => void handlePurchase(purchasePackage)}
                  disabled={isBusy}
                >
                  <View style={styles.packageTextWrapper}>
                    <Text style={styles.packageTitle}>{presentation.title}</Text>
                    <Text style={styles.packageCaption}>
                      {presentation.caption}
                    </Text>
                  </View>
                  {isPending ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.packagePrice}>
                      {purchasePackage.product.priceString}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              accessibilityRole="button"
              style={styles.restoreButton}
              onPress={() => void handleRestore()}
              disabled={isBusy}
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.restoreText}>Satın alımları geri yükle</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclosure}>{AUTO_RENEW_DISCLOSURE}</Text>
            <Text style={styles.disclosure}>{PLATFORM_SCOPE_NOTE}</Text>

            <View style={styles.legalRow}>
              <TouchableOpacity
                accessibilityRole="link"
                style={styles.legalButton}
                onPress={() => void openExternalUrl(TERMS_URL)}
              >
                <Text style={styles.legalText}>Kullanım Koşulları</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>•</Text>
              <TouchableOpacity
                accessibilityRole="link"
                style={styles.legalButton}
                onPress={() => void openExternalUrl(PRIVACY_URL)}
              >
                <Text style={styles.legalText}>Gizlilik Politikası</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </PaywallContext.Provider>
  );
};

export const usePaywall = (): PaywallContextValue => useContext(PaywallContext);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sheetHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sectionTitle,
    fontWeight: '800',
  },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sheetContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  benefits: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  benefitText: {
    color: colors.text,
    fontSize: typography.body,
    flex: 1,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
  },
  emptyBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  packageCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    minHeight: 64,
    padding: spacing.lg,
  },
  packageCardHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  packageTextWrapper: {
    flex: 1,
    paddingRight: spacing.md,
  },
  packageTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  packageCaption: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  packagePrice: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '800',
  },
  restoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
  },
  restoreText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disclosure: {
    color: colors.placeholder,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  legalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  legalButton: {
    justifyContent: 'center',
    minHeight: 44,
  },
  legalText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '700',
  },
  legalSeparator: {
    color: colors.placeholder,
  },
});
