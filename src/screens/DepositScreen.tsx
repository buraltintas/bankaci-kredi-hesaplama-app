import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import CalculateActionBar from '../components/CalculateActionBar';
import NumericInput from '../components/NumericInput';
import ResultBannerAd from '../../components/AdBanner';
import { colors, radius, shadows, spacing, typography } from '../design/tokens';
import { useInterstitialAction } from '../ads/useInterstitialAction';
import { calculateDeposit } from '../domain/deposit/calculateDeposit';
import { buildDepositShareMessage } from '../domain/deposit/shareSummary';
import type { DepositCalculationResult } from '../domain/deposit/types';
import {
  describeWithholdingTaxBracket,
  suggestWithholdingTaxRate,
} from '../domain/deposit/withholdingTax';
import { startOfLocalDay } from '../utils/dateMath';
import { formatCurrency } from '../utils/formatCurrency';
import { parseNumericInput } from '../utils/sanitizeNumericInput';

const ACTION_BUTTON_HEIGHT = 54;
const ACTION_BAR_VERTICAL_PADDING = spacing.lg;

/** Terms Turkish banks quote most often, so the common case is one tap. */
const QUICK_TERM_DAYS = [32, 46, 92, 181, 365];

const formatRate = (value: number): string => {
  return `%${value.toString().replace('.', ',')}`;
};

const DepositScreen = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollViewRef = useRef<ScrollView>(null);
  const resultAnchorY = useRef(0);
  const resultRef = useRef<ViewShot>(null);
  const { isInterstitialActionRunning, runActionWithOptionalInterstitial } =
    useInterstitialAction();
  const [principal, setPrincipal] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [termDays, setTermDays] = useState('32');
  // Tracks whether the user has taken control of the rate. Until they do, the
  // field follows the bracket for the chosen term.
  const [withholdingRate, setWithholdingRate] = useState(() =>
    suggestWithholdingTaxRate(32).toString().replace('.', ',')
  );
  const [hasEditedWithholdingRate, setHasEditedWithholdingRate] =
    useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<DepositCalculationResult | null>(null);

  useScrollToTop(scrollViewRef);
  useFocusEffect(
    useCallback(() => {
      setFormError('');

      const frame = requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      });

      return () => cancelAnimationFrame(frame);
    }, [])
  );

  const parsedTermDays = parseNumericInput(termDays, 'integer').value ?? 0;
  const bracketLabel = useMemo(
    () => describeWithholdingTaxBracket(parsedTermDays),
    [parsedTermDays]
  );

  const isReadyToCalculate = useMemo(() => {
    return (
      parseNumericInput(principal, 'money').isValid &&
      parseNumericInput(annualRate, 'decimal').isValid &&
      parseNumericInput(termDays, 'integer').isValid &&
      parseNumericInput(withholdingRate, 'decimal').isValid
    );
  }, [annualRate, principal, termDays, withholdingRate]);

  const applyTermDays = useCallback(
    (nextTermDays: string) => {
      setFormError('');
      setTermDays(nextTermDays);

      if (hasEditedWithholdingRate) {
        return;
      }

      const parsed = parseNumericInput(nextTermDays, 'integer').value;

      if (parsed) {
        setWithholdingRate(
          suggestWithholdingTaxRate(parsed).toString().replace('.', ',')
        );
      }
    },
    [hasEditedWithholdingRate]
  );

  const handleChangeWithholdingRate = useCallback((nextValue: string) => {
    setFormError('');
    setHasEditedWithholdingRate(true);
    setWithholdingRate(nextValue);
  }, []);

  const handleChangePrincipal = useCallback((nextValue: string) => {
    setFormError('');
    setPrincipal(nextValue);
  }, []);

  const handleChangeAnnualRate = useCallback((nextValue: string) => {
    setFormError('');
    setAnnualRate(nextValue);
  }, []);

  const scrollToResultSoon = useCallback(() => {
    globalThis.setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, resultAnchorY.current - 8),
        animated: true,
      });
    }, 120);
  }, []);

  const handleCalculate = useCallback(() => {
    const parsedPrincipal = parseNumericInput(principal, 'money');
    const parsedAnnualRate = parseNumericInput(annualRate, 'decimal');
    const parsedTerm = parseNumericInput(termDays, 'integer');
    const parsedWithholding = parseNumericInput(withholdingRate, 'decimal');

    if (!parsedPrincipal.isValid || !parsedPrincipal.value) {
      setFormError('Anapara tutarını girin.');
      setResult(null);
      return;
    }

    if (!parsedAnnualRate.isValid || parsedAnnualRate.value === null) {
      setFormError('Yıllık brüt faiz oranını girin.');
      setResult(null);
      return;
    }

    if (!parsedTerm.isValid || !parsedTerm.value) {
      setFormError('Vadeyi gün olarak girin.');
      setResult(null);
      return;
    }

    if (!parsedWithholding.isValid || parsedWithholding.value === null) {
      setFormError('Stopaj oranını girin.');
      setResult(null);
      return;
    }

    try {
      Keyboard.dismiss();
      setResult(
        calculateDeposit({
          principal: parsedPrincipal.value,
          annualInterestRatePercent: parsedAnnualRate.value,
          termDays: parsedTerm.value,
          withholdingTaxRatePercent: parsedWithholding.value,
          startDate: startOfLocalDay(new Date()),
        })
      );
      setFormError('');
      scrollToResultSoon();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Hesaplama yapılamadı.'
      );
      setResult(null);
    }
  }, [annualRate, principal, scrollToResultSoon, termDays, withholdingRate]);

  const handleShare = useCallback(async () => {
    if (!result) {
      return;
    }

    await runActionWithOptionalInterstitial('share', async () => {
      try {
        const uri = await resultRef.current?.capture?.();

        await Share.share({
          title: 'Mevduat Hesaplama Sonucu',
          message: buildDepositShareMessage(result),
          url: Platform.OS === 'ios' ? uri : uri ? `file://${uri}` : undefined,
        });
      } catch {
        Alert.alert('Paylaşım', 'Paylaşım sırasında bir hata oluştu.');
      }
    });
  }, [result, runActionWithOptionalInterstitial]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.mainContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop:
                spacing.lg + (Platform.OS === 'android' ? insets.top : 0),
              // Extra room below the banner: the action bar floats over this
              // content, and an ad sitting flush against a button invites the
              // accidental taps AdMob counts as invalid traffic.
              paddingBottom:
                ACTION_BUTTON_HEIGHT +
                ACTION_BAR_VERTICAL_PADDING * 3 +
                tabBarHeight +
                spacing.xl,
            },
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Bankacı</Text>
            <Text style={styles.title}>Mevduat Hesaplama</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mevduat Bilgileri</Text>

            <NumericInput
              label="Anapara (TL)"
              mode="money"
              value={principal}
              onChangeText={handleChangePrincipal}
              placeholder="Örn. 250.000"
            />

            <View style={styles.spacer} />

            <NumericInput
              label="Yıllık Brüt Faiz Oranı (%)"
              value={annualRate}
              onChangeText={handleChangeAnnualRate}
              placeholder="Örn. 42,50"
            />

            <View style={styles.spacer} />

            <NumericInput
              label="Vade (Gün)"
              mode="integer"
              value={termDays}
              onChangeText={applyTermDays}
              placeholder="Örn. 32"
            />

            <View style={styles.quickTerms}>
              {QUICK_TERM_DAYS.map((quickTerm) => {
                const isSelected = parsedTermDays === quickTerm;

                return (
                  <TouchableOpacity
                    key={quickTerm}
                    accessibilityRole="button"
                    accessibilityLabel={`${quickTerm} gün vade`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.quickTermChip,
                      isSelected && styles.quickTermChipSelected,
                    ]}
                    onPress={() => applyTermDays(String(quickTerm))}
                  >
                    <Text
                      style={[
                        styles.quickTermText,
                        isSelected && styles.quickTermTextSelected,
                      ]}
                    >
                      {quickTerm}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.spacer} />

            <NumericInput
              label="Stopaj Oranı (%)"
              value={withholdingRate}
              onChangeText={handleChangeWithholdingRate}
              placeholder="Örn. 17,5"
            />
            <Text style={styles.helperText}>
              {`${bracketLabel} vadeler için varsayılan oran girildi. Bankanızın güncel uygulaması farklıysa değiştirin.`}
            </Text>
          </View>

          {formError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          {result ? (
            <View
              onLayout={(event) => {
                resultAnchorY.current = event.nativeEvent.layout.y;
              }}
            >
              <ViewShot ref={resultRef} options={{ format: 'jpg', quality: 0.9 }}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Sonuç</Text>

                  <View style={styles.highlight}>
                <Text style={styles.highlightLabel}>Vade sonu toplam</Text>
                <Text style={styles.highlightValue}>
                  {formatCurrency(result.maturityAmount)}
                </Text>
              </View>

                  <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Anapara</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(result.principal)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Vade</Text>
                  <Text style={styles.summaryValue}>{result.termDays} gün</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>
                    Yıllık Brüt Faiz Oranı
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatRate(result.annualInterestRatePercent)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>
                    Stopaj ({formatRate(result.withholdingTaxRatePercent)})
                  </Text>
                  <Text style={[styles.summaryValue, styles.summaryNegative]}>
                    -{formatCurrency(result.withholdingTax)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Brüt Faiz</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(result.grossInterest)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Net Faiz</Text>
                  <Text style={[styles.summaryValue, styles.summaryPositive]}>
                    {formatCurrency(result.netInterest)}
                  </Text>
                </View>
              </View>

                </View>
              </ViewShot>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Sonucu paylaş"
                style={[
                  styles.shareButton,
                  isInterstitialActionRunning && styles.shareButtonDisabled,
                ]}
                onPress={() => void handleShare()}
                disabled={isInterstitialActionRunning}
              >
                <Feather name="share-2" size={18} color={colors.primary} />
                <Text style={styles.shareButtonText}>Paylaş</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {result ? <ResultBannerAd /> : null}
        </ScrollView>

        <CalculateActionBar
          onPress={handleCalculate}
          isReady={isReadyToCalculate}
          paddingBottom={ACTION_BAR_VERTICAL_PADDING}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mainContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
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
  spacer: {
    height: spacing.md,
  },
  quickTerms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickTermChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 60,
    paddingHorizontal: spacing.md,
  },
  quickTermChipSelected: {
    backgroundColor: '#E7F1FC',
    borderColor: colors.primary,
  },
  quickTermText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  quickTermTextSelected: {
    color: colors.primary,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: typography.body,
  },
  highlight: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  highlightLabel: {
    color: '#B9D3EE',
    fontSize: typography.small,
    fontWeight: '700',
  },
  highlightValue: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryCell: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  summaryValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  summaryPositive: {
    color: colors.success,
  },
  summaryNegative: {
    color: colors.danger,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    minHeight: 52,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '800',
  },
});

export default DepositScreen;
