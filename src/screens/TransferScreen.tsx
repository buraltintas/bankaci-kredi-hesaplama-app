import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import CalculateActionBar from '../components/CalculateActionBar';
import NumericInput from '../components/NumericInput';
import { colors, radius, shadows, spacing, typography } from '../design/tokens';
import {
  compareFromEstimate,
  compareFromPayoff,
  suggestCompensationRate,
} from '../domain/transfer/calculateTransfer';
import type { TransferComparison } from '../domain/transfer/types';
import { buildTransferShareMessage } from '../domain/transfer/shareSummary';
import { formatCurrency } from '../utils/formatCurrency';
import { parseNumericInput } from '../utils/sanitizeNumericInput';
import { useCalculatorScroll } from '../hooks/useCalculatorScroll';
import { buildTransferAnalyticsEvent } from '../analytics/calculationEvents';
import { trackCalculation } from '../analytics/analyticsStorage';

const ACTION_BUTTON_HEIGHT = 54;
const ACTION_BAR_VERTICAL_PADDING = spacing.lg;

type TransferMode = 'payoff' | 'estimate';
type Props = {
  topContent?: React.ReactNode;
  contentOpacity?: Animated.Value;
};

const formatRate = (value: number): string =>
  `%${value.toString().replace('.', ',')}`;

const TransferScreen = ({ topContent, contentOpacity }: Props) => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollViewRef = useRef<ScrollView>(null);
  const resultRef = useRef<ViewShot>(null);

  const [mode, setMode] = useState<TransferMode>('payoff');

  // Shared inputs
  const [currentRate, setCurrentRate] = useState('');
  const [newRate, setNewRate] = useState('');

  // Payoff mode
  const [payoffAmount, setPayoffAmount] = useState('');
  const [commissionIncluded, setCommissionIncluded] = useState(false);
  const [remainingTerm, setRemainingTerm] = useState('');

  // Estimate mode
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originalTerm, setOriginalTerm] = useState('');
  const [remainingInstallments, setRemainingInstallments] = useState('');

  // Compensation rate follows the remaining term until the user edits it.
  const [compensationRate, setCompensationRate] = useState('');
  const [hasEditedCompensation, setHasEditedCompensation] = useState(false);

  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<TransferComparison | null>(null);
  const { onResultLayout, scrollToResult } = useCalculatorScroll({
    scrollViewRef,
    result,
    keyboardExtraOffset: spacing.xxl * 2,
    dismissKeyboardOnIos: true,
  });

  useScrollToTop(scrollViewRef);
  useFocusEffect(
    useCallback(() => {
      setFormError('');
    }, [])
  );

  const activeTermForSuggestion =
    mode === 'payoff'
      ? parseNumericInput(remainingTerm, 'integer').value
      : parseNumericInput(remainingInstallments, 'integer').value;

  const suggestedCompensationLabel = useMemo(() => {
    if (!activeTermForSuggestion) {
      return null;
    }

    return suggestCompensationRate(activeTermForSuggestion) === 2
      ? '36 aydan uzun kalan vade için varsayılan %2 girildi.'
      : '36 ay ve altı kalan vade için varsayılan %1 girildi.';
  }, [activeTermForSuggestion]);

  const applyTermSideEffects = useCallback(
    (nextTerm: string) => {
      if (hasEditedCompensation) {
        return;
      }

      const parsed = parseNumericInput(nextTerm, 'integer').value;

      if (parsed) {
        setCompensationRate(
          suggestCompensationRate(parsed).toString().replace('.', ',')
        );
      }
    },
    [hasEditedCompensation]
  );

  const handleChangeRemainingTerm = useCallback(
    (value: string) => {
      setRemainingTerm(value);
      applyTermSideEffects(value);
    },
    [applyTermSideEffects]
  );

  const handleChangeRemainingInstallments = useCallback(
    (value: string) => {
      setRemainingInstallments(value);
      applyTermSideEffects(value);
    },
    [applyTermSideEffects]
  );

  const handleChangeCompensationRate = useCallback((value: string) => {
    setHasEditedCompensation(true);
    setCompensationRate(value);
  }, []);

  const handleCalculate = useCallback(() => {
    const parsedCurrentRate = parseNumericInput(currentRate, 'decimal');
    const parsedNewRate = parseNumericInput(newRate, 'decimal');
    const parsedCompensation = parseNumericInput(compensationRate, 'decimal');

    if (!parsedCurrentRate.isValid || parsedCurrentRate.value === null) {
      setFormError('Mevcut kredi faiz oranını girin.');
      setResult(null);
      return;
    }

    if (!parsedNewRate.isValid || parsedNewRate.value === null) {
      setFormError('Teklif edilen yeni faiz oranını girin.');
      setResult(null);
      return;
    }

    if (!parsedCompensation.isValid || parsedCompensation.value === null) {
      setFormError('Erken ödeme tazminatı oranını girin.');
      setResult(null);
      return;
    }

    try {
      let comparison: TransferComparison;

      if (mode === 'payoff') {
        const parsedPayoff = parseNumericInput(payoffAmount, 'money');
        const parsedTerm = parseNumericInput(remainingTerm, 'integer');

        if (!parsedPayoff.isValid || !parsedPayoff.value) {
          setFormError('Kapama tutarını girin.');
          setResult(null);
          return;
        }

        if (!parsedTerm.isValid || !parsedTerm.value) {
          setFormError('Kalan vadeyi ay olarak girin.');
          setResult(null);
          return;
        }

        comparison = compareFromPayoff({
          payoffAmount: parsedPayoff.value,
          commissionIncluded,
          compensationRatePercent: parsedCompensation.value,
          currentMonthlyRatePercent: parsedCurrentRate.value,
          newMonthlyRatePercent: parsedNewRate.value,
          remainingTerm: parsedTerm.value,
        });
      } else {
        const parsedPrincipal = parseNumericInput(originalPrincipal, 'money');
        const parsedOriginalTerm = parseNumericInput(originalTerm, 'integer');
        const parsedRemaining = parseNumericInput(
          remainingInstallments,
          'integer'
        );

        if (!parsedPrincipal.isValid || !parsedPrincipal.value) {
          setFormError('Çektiğiniz kredi tutarını girin.');
          setResult(null);
          return;
        }

        if (!parsedOriginalTerm.isValid || !parsedOriginalTerm.value) {
          setFormError('Kredinin toplam vadesini girin.');
          setResult(null);
          return;
        }

        if (!parsedRemaining.isValid || !parsedRemaining.value) {
          setFormError('Kalan taksit sayısını girin.');
          setResult(null);
          return;
        }

        comparison = compareFromEstimate({
          originalPrincipal: parsedPrincipal.value,
          originalTerm: parsedOriginalTerm.value,
          remainingInstallments: parsedRemaining.value,
          compensationRatePercent: parsedCompensation.value,
          currentMonthlyRatePercent: parsedCurrentRate.value,
          newMonthlyRatePercent: parsedNewRate.value,
        });
      }

      setResult(comparison);
      setFormError('');
      void trackCalculation(
        buildTransferAnalyticsEvent({
          mode,
          currentRate: parsedCurrentRate.value,
          newRate: parsedNewRate.value,
          commissionIncluded,
          result: comparison,
        })
      ).catch(() => undefined);
      scrollToResult();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Hesaplama yapılamadı.'
      );
      setResult(null);
    }
  }, [
    commissionIncluded,
    compensationRate,
    currentRate,
    mode,
    newRate,
    originalPrincipal,
    originalTerm,
    payoffAmount,
    remainingInstallments,
    remainingTerm,
    scrollToResult,
  ]);

  const handleShare = useCallback(async () => {
    if (!result) {
      return;
    }

    try {
      const uri = await resultRef.current?.capture?.();

      await Share.share({
        title: 'Konut Kredisi Devir Hesaplama Sonucu',
        message: buildTransferShareMessage(result),
        url: Platform.OS === 'ios' ? uri : uri ? `file://${uri}` : undefined,
      });
    } catch {
      Alert.alert('Paylaşım', 'Paylaşım sırasında bir hata oluştu.');
    }
  }, [result]);

  const isReadyToCalculate = useMemo(() => {
    const ratesReady =
      parseNumericInput(currentRate, 'decimal').isValid &&
      parseNumericInput(newRate, 'decimal').isValid &&
      parseNumericInput(compensationRate, 'decimal').isValid;

    if (!ratesReady) {
      return false;
    }

    if (mode === 'payoff') {
      return (
        parseNumericInput(payoffAmount, 'money').isValid &&
        parseNumericInput(remainingTerm, 'integer').isValid
      );
    }

    return (
      parseNumericInput(originalPrincipal, 'money').isValid &&
      parseNumericInput(originalTerm, 'integer').isValid &&
      parseNumericInput(remainingInstallments, 'integer').isValid
    );
  }, [
    compensationRate,
    currentRate,
    mode,
    newRate,
    originalPrincipal,
    originalTerm,
    payoffAmount,
    remainingInstallments,
    remainingTerm,
  ]);

  const isSaving = result !== null && result.savings >= 0;

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
          stickyHeaderIndices={topContent ? [1] : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Bankacı</Text>
            <Text style={styles.title}>Konut Kredisi Devir</Text>
          </View>

          {topContent}

          <Animated.View
            style={[
              styles.animatedContent,
              contentOpacity ? { opacity: contentOpacity } : null,
            ]}
          >
          <View style={styles.card}>
            <Text style={styles.helperText}>
              Konut kredinizi başka bankaya taşımanın kâr mı zarar mı
              getireceğini hesaplar. Kapama tutarını biliyorsanız doğrudan
              girin; bilmiyorsanız tahmini hesaplayın.
            </Text>

            <View style={styles.modeGroup}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'payoff' }}
                style={[
                  styles.modeOption,
                  mode === 'payoff' && styles.modeOptionSelected,
                ]}
                onPress={() => {
                  setMode('payoff');
                  setResult(null);
                  setFormError('');
                }}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === 'payoff' && styles.modeTextSelected,
                  ]}
                >
                  Kapama tutarını biliyorum
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'estimate' }}
                style={[
                  styles.modeOption,
                  mode === 'estimate' && styles.modeOptionSelected,
                ]}
                onPress={() => {
                  setMode('estimate');
                  setResult(null);
                  setFormError('');
                }}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === 'estimate' && styles.modeTextSelected,
                  ]}
                >
                  Tahmini hesapla
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'payoff' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mevcut Kredi</Text>

              <NumericInput
                label="Kapama Tutarı (TL)"
                mode="money"
                value={payoffAmount}
                onChangeText={setPayoffAmount}
                placeholder="Örn. 1.250.000"
              />

              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: commissionIncluded }}
                style={styles.checkboxRow}
                onPress={() => setCommissionIncluded((value) => !value)}
              >
                <View
                  style={[
                    styles.checkbox,
                    commissionIncluded && styles.checkboxChecked,
                  ]}
                >
                  {commissionIncluded ? (
                    <Feather name="check" size={14} color={colors.surface} />
                  ) : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  Bu tutara erken ödeme tazminatı dahil
                </Text>
              </TouchableOpacity>

              <View style={styles.spacer} />

              <NumericInput
                label="Kalan Vade (Ay)"
                mode="integer"
                value={remainingTerm}
                onChangeText={handleChangeRemainingTerm}
                placeholder="Örn. 84"
              />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mevcut Kredi</Text>

              <NumericInput
                label="Çekilen Kredi Tutarı (TL)"
                mode="money"
                value={originalPrincipal}
                onChangeText={setOriginalPrincipal}
                placeholder="Örn. 1.500.000"
              />

              <View style={styles.spacer} />

              <NumericInput
                label="Toplam Vade (Ay)"
                mode="integer"
                value={originalTerm}
                onChangeText={setOriginalTerm}
                placeholder="Örn. 120"
              />

              <View style={styles.spacer} />

              <NumericInput
                label="Kalan Taksit Sayısı"
                mode="integer"
                value={remainingInstallments}
                onChangeText={handleChangeRemainingInstallments}
                placeholder="Örn. 90"
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Faiz ve Tazminat</Text>

            <NumericInput
              label="Mevcut Kredi Aylık Faiz Oranı (%)"
              value={currentRate}
              onChangeText={setCurrentRate}
              placeholder="Örn. 3,29"
            />

            <View style={styles.spacer} />

            <NumericInput
              label="Teklif Edilen Aylık Faiz Oranı (%)"
              value={newRate}
              onChangeText={setNewRate}
              placeholder="Örn. 2,79"
            />

            <View style={styles.spacer} />

            <NumericInput
              label="Erken Ödeme Tazminatı Oranı (%)"
              value={compensationRate}
              onChangeText={handleChangeCompensationRate}
              placeholder="Örn. 2"
            />
            {suggestedCompensationLabel ? (
              <Text style={styles.helperText}>{suggestedCompensationLabel}</Text>
            ) : null}
          </View>

          {formError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          {result ? (
            <View onLayout={onResultLayout}>
              <ViewShot ref={resultRef} options={{ format: 'jpg', quality: 0.9 }}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Sonuç</Text>

              <View
                style={[
                  styles.highlight,
                  isSaving ? styles.highlightSaving : styles.highlightLoss,
                ]}
              >
                <Text style={styles.highlightLabel}>
                  {isSaving ? 'Tahmini kazanç' : 'Tahmini ek maliyet'}
                </Text>
                <Text style={styles.highlightValue}>
                  {formatCurrency(Math.abs(result.savings))}
                </Text>
                <Text style={styles.highlightNote}>
                  {isSaving
                    ? 'Krediyi taşımak toplam ödemenizi bu kadar azaltır.'
                    : 'Krediyi taşımak toplam ödemenizi bu kadar artırır.'}
                </Text>
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Kalan anapara (yakl.)</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(result.remainingPrincipal)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>
                    Erken ödeme tazminatı ({formatRate(
                      result.compensationRatePercent
                    )})
                  </Text>
                  <Text style={[styles.summaryValue, styles.summaryNegative]}>
                    {formatCurrency(result.compensation)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Yeni kredi tutarı</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(result.refinancePrincipal)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Kalan vade</Text>
                  <Text style={styles.summaryValue}>
                    {result.remainingTerm} ay
                  </Text>
                </View>
              </View>

              <View style={styles.compareBlock}>
                <View style={styles.compareRow}>
                  <Text style={styles.compareLabel}>Mevcut taksit</Text>
                  <Text style={styles.compareValue}>
                    {formatCurrency(result.currentInstallment)}
                  </Text>
                </View>
                <View style={styles.compareRow}>
                  <Text style={styles.compareLabel}>Yeni taksit</Text>
                  <Text style={styles.compareValue}>
                    {formatCurrency(result.newInstallment)}
                  </Text>
                </View>
                <View style={[styles.compareRow, styles.compareDivider]}>
                  <Text style={styles.compareLabel}>Mevcutta kalan ödeme</Text>
                  <Text style={styles.compareValue}>
                    {formatCurrency(result.currentTotal)}
                  </Text>
                </View>
                <View style={styles.compareRow}>
                  <Text style={styles.compareLabel}>Yeni krediyle ödeme</Text>
                  <Text style={styles.compareValue}>
                    {formatCurrency(result.newTotal)}
                  </Text>
                </View>
              </View>

                  <Text style={styles.disclaimer}>
                    Sonuçlar yaklaşıktır. Bankanızın vereceği kesin kapama tutarı
                    ve masraflar (ekspertiz, ipotek, sigorta) farklılık
                    gösterebilir.
                  </Text>
                </View>
              </ViewShot>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Sonucu paylaş"
                style={styles.shareButton}
                onPress={() => void handleShare()}
              >
                <Feather name="share-2" size={18} color={colors.primary} />
                <Text style={styles.shareButtonText}>Paylaş</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          </Animated.View>
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
  animatedContent: {
    gap: spacing.lg,
    // Breathing room below the sticky tabs, matching the individual and
    // commercial calculators.
    marginTop: spacing.lg,
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
    borderRadius: radius.lg,
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
  helperText: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  modeGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modeOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  modeOptionSelected: {
    backgroundColor: '#E7F1FC',
    borderColor: colors.primary,
  },
  modeText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeTextSelected: {
    color: colors.primary,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 44,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
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
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  highlightSaving: {
    backgroundColor: colors.success,
  },
  highlightLoss: {
    backgroundColor: colors.danger,
  },
  highlightLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: typography.small,
    fontWeight: '700',
  },
  highlightValue: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  highlightNote: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: typography.small,
    lineHeight: 18,
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
    flexBasis: '45%',
    flexGrow: 1,
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
  summaryNegative: {
    color: colors.danger,
  },
  compareBlock: {
    marginTop: spacing.lg,
  },
  compareRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  compareDivider: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  compareLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  compareValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disclaimer: {
    color: colors.placeholder,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.lg,
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
  shareButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '800',
  },
});

export default TransferScreen;
