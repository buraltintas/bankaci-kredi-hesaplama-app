import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LOAN_TYPES } from '../utils/constants';
import LoanResult from './LoanResult';
import NumericInput from '../src/components/NumericInput';
import { colors, radius, shadows, spacing, typography } from '../src/design/tokens';
import { calculateLoan } from '../src/domain/loan/calculateLoan';
import {
  buildCustomPaymentsFromRows,
} from '../src/domain/loan/customPaymentForm';
import {
  parseInstallmentIncreaseFrequencyMonths,
  parseInstallmentIncreaseRatePercent,
} from '../src/domain/loan/increasingInstallmentForm';
import { INCREASING_INSTALLMENT_PLAN_LABEL } from '../src/domain/loan/increasingInstallmentSummary';
import { parseInterestOnlyInstallmentCount } from '../src/domain/loan/interestOnlyForm';
import { INTEREST_ONLY_PLAN_LABEL } from '../src/domain/loan/interestOnlySummary';
import { buildLoanShareMessage } from '../src/domain/loan/shareSummary';
import { exportLoanPdf } from '../src/pdf/exportLoanPdf';
import { useInterstitialAction } from '../src/ads/useInterstitialAction';
import {
  addRecentCalculation,
  loadPdfContactPreferences,
  loadRecentCalculations,
  removeRecentCalculation,
  savePdfContactPreferences,
} from '../src/storage/calculatorStorage';
import { addMonths, formatDate, startOfLocalDay } from '../src/utils/dateMath';
import { formatCurrency } from '../src/utils/formatCurrency';
import {
  parseNumericInput,
  sanitizeNumericInput,
} from '../src/utils/sanitizeNumericInput';

const today = startOfLocalDay(new Date());
const ACTION_BUTTON_HEIGHT = 54;
const ACTION_BAR_VERTICAL_PADDING = spacing.lg;
const ABOUT_WEBSITE_URL = 'https://burak-altintas.com';
const PLAN_TYPE_LABELS = {
  standard: 'Standart Sabit Taksitli',
  prepaidInterest: 'Peşin Faiz Ödemeli',
  equalPrincipal: 'Eşit Anapara Ödemeli',
  customPayment: 'Özel / Balon Ödeme Planı',
  interestOnly: INTEREST_ONLY_PLAN_LABEL,
  increasingInstallment: INCREASING_INSTALLMENT_PLAN_LABEL,
};

const createCustomPaymentRow = () => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  installmentNo: '',
  amount: '',
});

const LoanCalculator = () => {
  const insets = useSafeAreaInsets();
  const appStateRef = useRef(AppState.currentState);
  const scrollViewRef = useRef(null);
  const resultRef = useRef(null);
  const resultAnchorY = useRef(0);
  const [loanType, setLoanType] = useState('Bireysel İhtiyaç/Taşıt Kredisi');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [bsmv, setBsmv] = useState('15');
  const [kkdf, setKkdf] = useState('15');
  const [term, setTerm] = useState('');
  const [planType, setPlanType] = useState('standard');
  const [prepaidInterestAmount, setPrepaidInterestAmount] = useState('');
  const [interestOnlyInstallmentCount, setInterestOnlyInstallmentCount] =
    useState('');
  const [installmentIncreaseRatePercent, setInstallmentIncreaseRatePercent] =
    useState('');
  const [
    installmentIncreaseFrequencyMonths,
    setInstallmentIncreaseFrequencyMonths,
  ] = useState('12');
  const [customPaymentRows, setCustomPaymentRows] = useState([
    createCustomPaymentRow(),
  ]);
  const [creditUsageDate, setCreditUsageDate] = useState(today);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(addMonths(today, 1));
  const [activeDatePicker, setActiveDatePicker] = useState(null);
  const [includeContactInfo, setIncludeContactInfo] = useState(false);
  const [contactFullName, setContactFullName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [foregroundPaintTick, setForegroundPaintTick] = useState(0);
  const [recentCalculations, setRecentCalculations] = useState([]);
  const [isRecentCalculationsOpen, setIsRecentCalculationsOpen] = useState(false);
  const [isAboutModalVisible, setIsAboutModalVisible] = useState(false);
  const [hasLoadedStoredState, setHasLoadedStoredState] = useState(false);
  const {
    isInterstitialActionRunning,
    runActionWithOptionalInterstitial,
  } = useInterstitialAction();


  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackgrounded = /inactive|background/.test(appStateRef.current);

      if (wasBackgrounded && nextAppState === 'active') {
        setActiveDatePicker(null);
        setForegroundPaintTick((value) => value + 1);
      }

      if (nextAppState !== 'active') {
        setActiveDatePicker(null);
      }

      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStoredState = async () => {
      const [storedRecentCalculations, storedContactPreferences] =
        await Promise.all([
          loadRecentCalculations(),
          loadPdfContactPreferences(),
        ]);

      if (!isMounted) {
        return;
      }

      setRecentCalculations(storedRecentCalculations);

      if (storedContactPreferences) {
        setIncludeContactInfo(storedContactPreferences.includeContactInfo);
        setContactFullName(storedContactPreferences.fullName);
        setContactPhone(storedContactPreferences.phone);
      }

      setHasLoadedStoredState(true);
    };

    loadStoredState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredState) {
      return;
    }

    savePdfContactPreferences({
      includeContactInfo,
      fullName: contactFullName,
      phone: contactPhone,
    }).catch(() => undefined);
  }, [contactFullName, contactPhone, hasLoadedStoredState, includeContactInfo]);

  const clearResult = () => {
    setResult(null);
    setFormError('');
  };

  const scrollToResultSoon = () => {
    globalThis.setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, resultAnchorY.current - 8),
        animated: true,
      });
    }, 120);
  };

  const handleOpenAboutWebsite = async () => {
    try {
      await Linking.openURL(ABOUT_WEBSITE_URL);
    } catch {
      Alert.alert('Bağlantı açılamadı', 'burak-altintas.com adresi açılamadı.');
    }
  };

  const buildFormSnapshot = () => ({
    loanType,
    amount,
    interestRate,
    bsmv,
    kkdf,
    term,
    planType,
    prepaidInterestAmount,
    interestOnlyInstallmentCount,
    installmentIncreaseRatePercent,
    installmentIncreaseFrequencyMonths,
    customPayments: customPaymentRows.map(({ installmentNo, amount }) => ({
      installmentNo,
      amount,
    })),
    creditUsageDate,
    firstInstallmentDate,
  });

  const applyFormSnapshot = (formSnapshot) => {
    setLoanType(formSnapshot.loanType);
    setAmount(formSnapshot.amount);
    setInterestRate(formSnapshot.interestRate);
    setBsmv(formSnapshot.bsmv);
    setKkdf(formSnapshot.kkdf);
    setTerm(formSnapshot.term);
    setPlanType(formSnapshot.planType ?? 'standard');
    setPrepaidInterestAmount(formSnapshot.prepaidInterestAmount ?? '');
    setInterestOnlyInstallmentCount(
      formSnapshot.interestOnlyInstallmentCount ?? ''
    );
    setInstallmentIncreaseRatePercent(
      formSnapshot.installmentIncreaseRatePercent ?? ''
    );
    setInstallmentIncreaseFrequencyMonths(
      formSnapshot.installmentIncreaseFrequencyMonths ?? '12'
    );
    setCustomPaymentRows(
      formSnapshot.customPayments?.length
        ? formSnapshot.customPayments.map((payment) => ({
            id: createCustomPaymentRow().id,
            installmentNo: payment.installmentNo,
            amount: payment.amount,
          }))
        : [createCustomPaymentRow()]
    );
    setCreditUsageDate(formSnapshot.creditUsageDate);
    setFirstInstallmentDate(formSnapshot.firstInstallmentDate);
    setActiveDatePicker(null);
    setFormError('');
  };

  const getPdfContactInfo = () => {
    if (!includeContactInfo) {
      return undefined;
    }

    const contactInfo = {
      fullName: contactFullName.trim(),
      phone: contactPhone.trim(),
    };

    if (!contactInfo.fullName || !contactInfo.phone) {
      Alert.alert(
        'İletişim bilgisi',
        'PDF için isim soyisim ve telefon numarası girin.'
      );
      return null;
    }

    return contactInfo;
  };

  const shareResultPdf = async (targetResult) => {
    const contactInfo = getPdfContactInfo();

    if (contactInfo === null) {
      return;
    }

    await exportLoanPdf(targetResult, contactInfo);
  };

  const handleLoanTypeChange = (type) => {
    setLoanType(type);
    setBsmv(LOAN_TYPES[type].bsmv.toString());
    setKkdf(LOAN_TYPES[type].kkdf.toString());
    clearResult();
  };

  const buildLoanInput = () => {
    const principal = parseNumericInput(amount, 'money');
    const monthlyRate = parseNumericInput(interestRate, 'decimal');
    const kkdfRate = parseNumericInput(kkdf, 'decimal');
    const bsmvRate = parseNumericInput(bsmv, 'decimal');
    const termCount = parseNumericInput(term, 'integer');
    const prepaidInterest = parseNumericInput(prepaidInterestAmount, 'money');
    if (!principal.isValid || !principal.value || principal.value <= 0) {
      throw new Error('Lütfen geçerli bir kredi tutarı girin.');
    }

    if (!termCount.isValid || !termCount.value) {
      throw new Error('Vade pozitif tam sayı olmalıdır.');
    }

    if (!monthlyRate.isValid || monthlyRate.value === null) {
      throw new Error('Lütfen geçerli bir faiz oranı girin.');
    }

    if (!kkdfRate.isValid || kkdfRate.value === null || !bsmvRate.isValid || bsmvRate.value === null) {
      throw new Error('KKDF ve BSMV oranları geçerli olmalıdır.');
    }

    if (planType === 'prepaidInterest') {
      if (!prepaidInterest.isValid || !prepaidInterest.value || prepaidInterest.value <= 0) {
        throw new Error('Lütfen geçerli bir peşin faiz tutarı girin.');
      }

      if (prepaidInterest.value >= principal.value) {
        throw new Error('Peşin faiz tutarı kredi tutarından küçük olmalıdır.');
      }
    }
    const parsedInterestOnlyInstallmentCount =
      planType === 'interestOnly'
        ? parseInterestOnlyInstallmentCount(
            interestOnlyInstallmentCount,
            termCount.value
          )
        : undefined;
    const parsedInstallmentIncreaseRatePercent =
      planType === 'increasingInstallment'
        ? parseInstallmentIncreaseRatePercent(installmentIncreaseRatePercent)
        : undefined;
    const parsedInstallmentIncreaseFrequencyMonths =
      planType === 'increasingInstallment'
        ? parseInstallmentIncreaseFrequencyMonths(
            installmentIncreaseFrequencyMonths,
            termCount.value
          )
        : undefined;
    const customPayments =
      planType === 'customPayment'
        ? buildCustomPaymentsFromRows(
            customPaymentRows.map(({ installmentNo, amount }) => ({
              installmentNo,
              amount,
            })),
            termCount.value
          )
        : undefined;

    return {
      principal: principal.value,
      term: termCount.value,
      monthlyInterestRatePercent: monthlyRate.value,
      kkdfRatePercent: kkdfRate.value,
      bsmvRatePercent: bsmvRate.value,
      creditUsageDate,
      firstInstallmentDate,
      planType,
      prepaidInterestAmount:
        planType === 'prepaidInterest' ? prepaidInterest.value : undefined,
      interestOnlyInstallmentCount: parsedInterestOnlyInstallmentCount,
      installmentIncreaseRatePercent: parsedInstallmentIncreaseRatePercent,
      installmentIncreaseFrequencyMonths:
        parsedInstallmentIncreaseFrequencyMonths,
      customPayments,
    };
  };

  const buildLoanInputFromRecentCalculation = (recentCalculation) => {
    const recentPlanType = recentCalculation.form.planType ?? 'standard';
    const prepaidInterest = parseNumericInput(
      recentCalculation.form.prepaidInterestAmount ?? '',
      'money'
    );

    const customPayments =
      recentPlanType === 'customPayment'
        ? buildCustomPaymentsFromRows(
            recentCalculation.form.customPayments ?? [],
            recentCalculation.summary.term
          )
        : undefined;
    const interestOnlyInstallmentCount =
      recentPlanType === 'interestOnly'
        ? parseInterestOnlyInstallmentCount(
            recentCalculation.form.interestOnlyInstallmentCount ?? '',
            recentCalculation.summary.term
          )
        : undefined;
    const installmentIncreaseRatePercent =
      recentPlanType === 'increasingInstallment'
        ? parseInstallmentIncreaseRatePercent(
            recentCalculation.form.installmentIncreaseRatePercent ?? ''
          )
        : undefined;
    const installmentIncreaseFrequencyMonths =
      recentPlanType === 'increasingInstallment'
        ? parseInstallmentIncreaseFrequencyMonths(
            recentCalculation.form.installmentIncreaseFrequencyMonths ?? '12',
            recentCalculation.summary.term
          )
        : undefined;

    return {
      principal: recentCalculation.summary.principal,
      term: recentCalculation.summary.term,
      monthlyInterestRatePercent: Number(
        recentCalculation.form.interestRate.replace(',', '.')
      ),
      kkdfRatePercent: Number(recentCalculation.form.kkdf.replace(',', '.')),
      bsmvRatePercent: Number(recentCalculation.form.bsmv.replace(',', '.')),
      creditUsageDate: recentCalculation.form.creditUsageDate,
      firstInstallmentDate: recentCalculation.form.firstInstallmentDate,
      planType: recentPlanType,
      prepaidInterestAmount:
        recentPlanType === 'prepaidInterest' && prepaidInterest.isValid
          ? prepaidInterest.value
          : undefined,
      interestOnlyInstallmentCount,
      installmentIncreaseRatePercent,
      installmentIncreaseFrequencyMonths,
      customPayments,
    };
  };

  const handleInterestOnlyInstallmentCountChange = (value) => {
    setInterestOnlyInstallmentCount(
      value.replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
    );
    clearResult();
  };

  const handleInstallmentIncreaseRateChange = (value) => {
    setInstallmentIncreaseRatePercent(
      value.replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
    );
    clearResult();
  };

  const handleInstallmentIncreaseFrequencyChange = (value) => {
    setInstallmentIncreaseFrequencyMonths(
      sanitizeNumericInput(value, 'integer')
    );
    clearResult();
  };

  const handleCustomPaymentRowChange = (id, field, value) => {
    setCustomPaymentRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    clearResult();
  };

  const handleAddCustomPaymentRow = () => {
    setCustomPaymentRows((rows) => [...rows, createCustomPaymentRow()]);
    clearResult();
  };

  const handleRemoveCustomPaymentRow = (id) => {
    setCustomPaymentRows((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== id) : rows
    );
    clearResult();
  };

  const handleCreditUsageDateChange = (selectedDate) => {
    const nextCreditUsageDate = startOfLocalDay(selectedDate);

    setCreditUsageDate(nextCreditUsageDate);

    if (firstInstallmentDate < nextCreditUsageDate) {
      setFirstInstallmentDate(addMonths(nextCreditUsageDate, 1));
    }

    clearResult();
  };

  const handleFirstInstallmentDateChange = (selectedDate) => {
    const nextFirstInstallmentDate = startOfLocalDay(selectedDate);

    if (nextFirstInstallmentDate < creditUsageDate) {
      Alert.alert(
        'Tarih seçimi',
        'İlk taksit tarihi kredi kullanım tarihinden önce olamaz.'
      );
      return;
    }

    setFirstInstallmentDate(nextFirstInstallmentDate);
    clearResult();
  };

  const handleDatePickerChange = (_event, selectedDate) => {
    if (!selectedDate) {
      setActiveDatePicker(null);
      return;
    }

    if (activeDatePicker === 'credit') {
      handleCreditUsageDateChange(selectedDate);
    }

    if (activeDatePicker === 'firstInstallment') {
      handleFirstInstallmentDateChange(selectedDate);
    }

    if (Platform.OS !== 'ios') {
      setActiveDatePicker(null);
    }
  };

  const handleCalculate = async () => {
    try {
      const formSnapshot = buildFormSnapshot();
      const loanInput = buildLoanInput();
      const nextResult = calculateLoan(loanInput);

      setResult(nextResult);
      setFormError('');

      addRecentCalculation(formSnapshot, nextResult, recentCalculations)
        .then(setRecentCalculations)
        .catch(() => undefined);

      scrollToResultSoon();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Hesaplama sırasında bir hata oluştu.';
      setResult(null);
      setFormError(message);
      Alert.alert('Kontrol edin', message);
    }
  };

  const handleDeleteRecentCalculation = (recentCalculation) => {
    Alert.alert(
      'Kaydı sil',
      'Bu hesaplama kaydını silmek istediğinden emin misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const next = await removeRecentCalculation(
                recentCalculation.id,
                recentCalculations
              );
              setRecentCalculations(next);
            } catch {
              Alert.alert('Hata', 'Kayıt silinemedi, tekrar dene.');
            }
          },
        },
      ]
    );
  };

  const handleOpenRecentCalculation = (recentCalculation) => {
    try {
      applyFormSnapshot(recentCalculation.form);
      const nextResult = calculateLoan(
        buildLoanInputFromRecentCalculation(recentCalculation)
      );

      setResult(nextResult);
      scrollToResultSoon();
    } catch {
      Alert.alert(
        'Son hesaplama',
        'Bu hesaplama tekrar açılamadı. Lütfen yeniden hesaplayın.'
      );
    }
  };

  const handleShareRecentCalculationPdf = async (recentCalculation) => {
    await runActionWithOptionalInterstitial('pdf', async () => {
      try {
        await shareResultPdf(
          calculateLoan(buildLoanInputFromRecentCalculation(recentCalculation))
        );
      } catch {
        Alert.alert(
          'PDF paylaşımı',
          'Bu hesaplama için PDF oluşturulurken bir hata oluştu.'
        );
      }
    });
  };

  const handleShare = async () => {
    if (!result) {
      return;
    }

    await runActionWithOptionalInterstitial('share', async () => {
      try {
        const uri = await resultRef.current?.capture?.();

        await Share.share({
          title: 'Kredi Hesaplama Sonucu',
          message: buildLoanShareMessage(result),
          url: Platform.OS === 'ios' ? uri : uri ? `file://${uri}` : undefined,
        });
      } catch {
        Alert.alert('Paylaşım', 'Paylaşım sırasında bir hata oluştu.');
      }
    });
  };

  const handleSharePdf = async () => {
    if (!result) {
      return;
    }

    await runActionWithOptionalInterstitial('pdf', async () => {
      try {
        await shareResultPdf(result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'PDF oluşturulurken bir hata oluştu.';
        Alert.alert('PDF paylaşımı', message);
      }
    });
  };

  const getRecentInstallmentSummary = (recentCalculation) => {
    const recentPlanType = recentCalculation.form.planType ?? 'standard';

    if (recentPlanType === 'customPayment') {
      return `Otomatik ${formatCurrency(
        recentCalculation.summary.automaticInstallmentAmount ?? 0
      )}`;
    }

    if (recentPlanType === 'equalPrincipal') {
      return `İlk / Son ${formatCurrency(
        recentCalculation.summary.firstInstallmentAmount ??
          recentCalculation.summary.firstInstallment
      )} / ${formatCurrency(
        recentCalculation.summary.lastInstallmentAmount ??
          recentCalculation.summary.firstInstallment
      )}`;
    }

    if (recentPlanType === 'interestOnly') {
      return `Sonraki dönem ${formatCurrency(
        recentCalculation.summary.postInterestOnlyInstallmentAmount ?? 0
      )}`;
    }

    if (recentPlanType === 'increasingInstallment') {
      return `İlk / Son ${formatCurrency(
        recentCalculation.summary.firstInstallmentAmount ??
          recentCalculation.summary.firstInstallment
      )} / ${formatCurrency(
        recentCalculation.summary.lastInstallmentAmount ??
          recentCalculation.summary.firstInstallment
      )}`;
    }

    return `Aylık ${formatCurrency(recentCalculation.summary.standardInstallment)}`;
  };

  const getRecentPlanDetail = (recentCalculation) => {
    const recentPlanType = recentCalculation.form.planType ?? 'standard';

    if (recentPlanType === 'prepaidInterest') {
      return ` · Peşin ${formatCurrency(
        recentCalculation.summary.realizedPrepaidInterest ?? 0
      )}`;
    }

    if (recentPlanType === 'customPayment') {
      return ` · ${recentCalculation.form.customPayments?.length ?? 0} özel`;
    }

    if (recentPlanType === 'interestOnly') {
      return ` · ${
        recentCalculation.form.interestOnlyInstallmentCount ??
        recentCalculation.summary.interestOnlyInstallmentCount ??
        0
      } anapara ödemesiz`;
    }

    if (recentPlanType === 'increasingInstallment') {
      return ` · %${
        recentCalculation.form.installmentIncreaseRatePercent ??
        recentCalculation.summary.installmentIncreaseRatePercent ??
        0
      } artış · ${
        recentCalculation.form.installmentIncreaseFrequencyMonths ??
        recentCalculation.summary.installmentIncreaseFrequencyMonths ??
        12
      } ayda bir`;
    }

    return '';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={[
          styles.mainContainer,
          foregroundPaintTick % 2 === 0 && styles.nativeRepaintGuard,
        ]}
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
                ACTION_BUTTON_HEIGHT + ACTION_BAR_VERTICAL_PADDING * 3 + insets.bottom,
            },
          ]}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Bankacı</Text>
              <Text style={styles.title}>Kredi Hesaplama</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Bankacı: Kredi Hesaplama hakkında"
              style={styles.infoButton}
              onPress={() => setIsAboutModalVisible(true)}
            >
              <Feather name="info" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Kredi Bilgileri</Text>
            <Text style={styles.label}>Kredi Tipi</Text>
            <View style={styles.loanTypeGroup}>
              {Object.keys(LOAN_TYPES).map((type) => {
                const isSelected = loanType === type;

                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.loanTypeOption,
                      isSelected && styles.loanTypeOptionSelected,
                    ]}
                    onPress={() => handleLoanTypeChange(type)}
                  >
                    <Text
                      style={[
                        styles.loanTypeText,
                        isSelected && styles.loanTypeTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <NumericInput
              label="Kredi Tutarı (TL)"
              mode="money"
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                clearResult();
              }}
              placeholder="Örn. 125.000"
            />
            <NumericInput
              label="Vade (Ay)"
              mode="integer"
              value={term}
              onChangeText={(value) => {
                setTerm(value);
                clearResult();
              }}
              placeholder="Örn. 12"
            />
            <NumericInput
              label="Aylık Faiz Oranı (%)"
              value={interestRate}
              onChangeText={(value) => {
                setInterestRate(value);
                clearResult();
              }}
              placeholder="Örn. 3,49"
            />
            <View style={styles.rateRow}>
              <NumericInput
                label="KKDF (%)"
                value={kkdf}
                onChangeText={(value) => {
                  setKkdf(value);
                  clearResult();
                }}
                editable={loanType === 'Özel'}
              />
              <NumericInput
                label="BSMV (%)"
                value={bsmv}
                onChangeText={(value) => {
                  setBsmv(value);
                  clearResult();
                }}
                editable={loanType === 'Özel'}
              />
            </View>

            <Text style={styles.label}>Ödeme Planı Tipi</Text>
            <View style={styles.planTypeGroup}>
              {Object.entries(PLAN_TYPE_LABELS).map(([type, label]) => {
                const isSelected = planType === type;

                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.planTypeOption,
                      isSelected && styles.planTypeOptionSelected,
                    ]}
                    onPress={() => {
                      setPlanType(type);
                      if (type === 'customPayment' && customPaymentRows.length === 0) {
                        setCustomPaymentRows([createCustomPaymentRow()]);
                      }
                      clearResult();
                    }}
                  >
                    <Text
                      style={[
                        styles.planTypeText,
                        isSelected && styles.planTypeTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {planType === 'prepaidInterest' ? (
              <NumericInput
                label="Peşin Faiz Tutarı (TL)"
                mode="money"
                value={prepaidInterestAmount}
                onChangeText={(value) => {
                  setPrepaidInterestAmount(value);
                  clearResult();
                }}
                placeholder="Örn. 50.000"
              />
            ) : null}

            {planType === 'interestOnly' ? (
              <>
                <Text style={styles.label}>Anapara ödemesiz taksit sayısı</Text>
                <TextInput
                  style={styles.textInput}
                  value={interestOnlyInstallmentCount}
                  onChangeText={handleInterestOnlyInstallmentCountChange}
                  placeholder="Örn. 6"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </>
            ) : null}

            {planType === 'increasingInstallment' ? (
              <>
                <Text style={styles.label}>Taksit Artış Oranı (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={installmentIncreaseRatePercent}
                  onChangeText={handleInstallmentIncreaseRateChange}
                  placeholder="Örn. 5 veya 2,5"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
                <Text style={styles.label}>Artış Sıklığı (Ay)</Text>
                <TextInput
                  style={styles.textInput}
                  value={installmentIncreaseFrequencyMonths}
                  onChangeText={handleInstallmentIncreaseFrequencyChange}
                  placeholder="Örn. 12"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </>
            ) : null}

            {planType === 'customPayment' ? (
              <View style={styles.customPaymentGroup}>
                <View style={styles.customPaymentHeader}>
                  <Text style={styles.label}>Özel Ödemeler</Text>
                  <TouchableOpacity
                    style={styles.addCustomPaymentButton}
                    onPress={handleAddCustomPaymentRow}
                  >
                    <Feather name="plus" size={17} color={colors.primary} />
                    <Text style={styles.addCustomPaymentText}>Satır ekle</Text>
                  </TouchableOpacity>
                </View>
                {customPaymentRows.map((row, index) => (
                  <View key={row.id} style={styles.customPaymentRow}>
                    <View style={styles.customPaymentInstallmentInput}>
                      <NumericInput
                        label="Taksit No"
                        mode="integer"
                        value={row.installmentNo}
                        onChangeText={(value) =>
                          handleCustomPaymentRowChange(row.id, 'installmentNo', value)
                        }
                        placeholder="Örn. 6"
                      />
                    </View>
                    <View style={styles.customPaymentAmountInput}>
                      <NumericInput
                        label="Tutar"
                        mode="money"
                        value={row.amount}
                        onChangeText={(value) =>
                          handleCustomPaymentRowChange(row.id, 'amount', value)
                        }
                        placeholder="Örn. 50.000"
                      />
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.removeCustomPaymentButton,
                        customPaymentRows.length === 1 &&
                          styles.removeCustomPaymentButtonDisabled,
                      ]}
                      onPress={() => handleRemoveCustomPaymentRow(row.id)}
                      disabled={customPaymentRows.length === 1}
                      accessibilityLabel={`${index + 1}. özel ödeme satırını sil`}
                    >
                      <Feather
                        name="trash-2"
                        size={18}
                        color={
                          customPaymentRows.length === 1
                            ? colors.textMuted
                            : colors.danger
                        }
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tarih Bilgileri</Text>
            <Text style={styles.label}>Kredi Kullanım Tarihi</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setActiveDatePicker('credit')}
            >
              <Text style={styles.dateInputText}>{formatDate(creditUsageDate)}</Text>
              <Feather name="calendar" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.label}>İlk Taksit Tarihi</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setActiveDatePicker('firstInstallment')}
            >
              <Text style={styles.dateInputText}>
                {formatDate(firstInstallmentDate)}
              </Text>
              <Feather name="calendar" size={20} color={colors.primary} />
            </TouchableOpacity>
            {activeDatePicker && Platform.OS === 'android' ? (
              <DateTimePicker
                value={
                  activeDatePicker === 'credit'
                    ? creditUsageDate
                    : firstInstallmentDate
                }
                mode="date"
                display="default"
                locale="tr-TR"
                minimumDate={
                  activeDatePicker === 'firstInstallment'
                    ? creditUsageDate
                    : undefined
                }
                onChange={handleDatePickerChange}
              />
            ) : null}
          </View>

          {activeDatePicker && Platform.OS === 'ios' ? (
            <Modal
              transparent
              animationType="fade"
              visible
              onRequestClose={() => setActiveDatePicker(null)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={styles.datePickerOverlay}
                onPress={() => setActiveDatePicker(null)}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.datePickerSheet}
                  onPress={() => undefined}
                >
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>
                      {activeDatePicker === 'credit'
                        ? 'Kredi Kullanım Tarihi'
                        : 'İlk Taksit Tarihi'}
                    </Text>
                    <TouchableOpacity
                      style={styles.datePickerClose}
                      onPress={() => setActiveDatePicker(null)}
                    >
                      <Feather name="x" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={
                      activeDatePicker === 'credit'
                        ? creditUsageDate
                        : firstInstallmentDate
                    }
                    mode="date"
                    display="spinner"
                    locale="tr-TR"
                    minimumDate={
                      activeDatePicker === 'firstInstallment'
                        ? creditUsageDate
                        : undefined
                    }
                    accentColor={colors.primary}
                    textColor={colors.text}
                    themeVariant="light"
                    style={styles.datePickerSpinner}
                    onChange={handleDatePickerChange}
                  />
                  <TouchableOpacity
                    style={styles.datePickerDone}
                    onPress={() => setActiveDatePicker(null)}
                  >
                    <Text style={styles.datePickerDoneText}>Tamam</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          ) : null}

          <Modal
            transparent
            animationType="fade"
            visible={isAboutModalVisible}
            onRequestClose={() => setIsAboutModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.aboutOverlay}
              onPress={() => setIsAboutModalVisible(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={styles.aboutSheet}
                onPress={() => undefined}
              >
                <Text style={styles.aboutTitle}>
                  Bankacı: Kredi Hesaplama hakkında
                </Text>
                <ScrollView
                  style={styles.aboutContent}
                  contentContainerStyle={styles.aboutContentInner}
                  showsVerticalScrollIndicator
                >
                  <Text style={styles.aboutText}>
                    Bu uygulama, kredi hesaplamalarını sahada ve müşteri
                    görüşmelerinde daha hızlı, pratik ve anlaşılır şekilde
                    yapabilmek için geliştirildi.
                  </Text>
                  <Text style={styles.aboutText}>
                    Standart taksitli kredi hesaplamasının yanında; peşin faiz
                    ödemeli, eşit anapara, özel/balon ödeme, anapara ödemesiz
                    dönem ve artan taksitli ödeme planları gibi gelişmiş
                    senaryoları da destekler.
                  </Text>
                  <Text style={styles.aboutText}>
                    Uygulamanın gelişmiş ödeme planı özelliklerinin
                    şekillenmesinde, aktif bankacılık tecrübesiyle değerli geri
                    bildirimler sağlayan{' '}
                    <Text style={styles.aboutStrong}>Yasin Aslantürk</Text>’e
                    teşekkür ederim.
                  </Text>
                  <Text style={styles.aboutText}>
                    Geri bildirim ve iletişim için:
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="link"
                    style={styles.aboutLinkButton}
                    onPress={handleOpenAboutWebsite}
                  >
                    <Text style={styles.aboutLink}>burak-altintas.com</Text>
                    <Feather name="external-link" size={17} color={colors.primary} />
                  </TouchableOpacity>
                </ScrollView>
                <TouchableOpacity
                  style={styles.aboutCloseButton}
                  onPress={() => setIsAboutModalVisible(false)}
                >
                  <Text style={styles.aboutCloseText}>Kapat</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.contactToggle}
              onPress={() => setIncludeContactInfo((value) => !value)}
            >
              <View style={styles.contactToggleTextWrapper}>
                <Text style={styles.sectionTitle}>PDF İletişim Bilgisi</Text>
                <Text style={styles.helperText}>
                  İstenirse PDF çıktısına iletişim bilgisi eklenir.
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  includeContactInfo && styles.checkboxSelected,
                ]}
              >
                {includeContactInfo ? (
                  <Feather name="check" size={18} color={colors.surface} />
                ) : null}
              </View>
            </TouchableOpacity>

            {includeContactInfo ? (
              <>
                <Text style={styles.label}>İsim Soyisim</Text>
                <TextInput
                  style={styles.textInput}
                  value={contactFullName}
                  onChangeText={setContactFullName}
                  placeholder="Ad Soyad"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <Text style={styles.label}>Telefon No</Text>
                <TextInput
                  style={styles.textInput}
                  value={contactPhone}
                  onChangeText={(value) =>
                    setContactPhone(value.replace(/[^0-9+() -]/g, ''))
                  }
                  placeholder="05xx xxx xx xx"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
              </>
            ) : null}
          </View>

          {recentCalculations.length > 0 ? (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.recentHeader}
                onPress={() => setIsRecentCalculationsOpen((value) => !value)}
              >
                <View style={styles.recentHeaderText}>
                  <Text style={styles.sectionTitle}>Son 20 Hesaplama</Text>
                  <Text style={styles.helperText}>
                    Eski hesaplamaları tekrar açıp PDF olarak paylaşabilirsiniz.
                  </Text>
                </View>
                <View style={styles.recentHeaderIcon}>
                  <Feather
                    name={isRecentCalculationsOpen ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={colors.primary}
                  />
                </View>
              </TouchableOpacity>
              {isRecentCalculationsOpen
                ? recentCalculations.map((recentCalculation) => (
                    <View key={recentCalculation.id} style={styles.recentItem}>
                      <View style={styles.recentItemMain}>
                        <View style={styles.recentItemHeader}>
                          <Text style={styles.recentItemTitle}>
                            {formatCurrency(recentCalculation.summary.principal)}{' '}
                            · {recentCalculation.summary.term} ay
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              handleDeleteRecentCalculation(recentCalculation)
                            }
                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            style={styles.recentDeleteButton}
                          >
                            <Feather
                              name="trash-2"
                              size={18}
                              color={colors.danger}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.recentItemText}>
                          {getRecentInstallmentSummary(recentCalculation)}
                          {' · '}%
                          {recentCalculation.form.interestRate} faiz
                        </Text>
                        <Text style={styles.recentItemText}>
                          {PLAN_TYPE_LABELS[
                            recentCalculation.form.planType ?? 'standard'
                          ]}
                          {getRecentPlanDetail(recentCalculation)}
                        </Text>
                        <Text style={styles.recentItemText}>
                          {formatDate(recentCalculation.form.creditUsageDate)} →{' '}
                          {formatDate(
                            recentCalculation.form.firstInstallmentDate
                          )}
                        </Text>
                        <Text style={styles.recentItemMeta}>
                          {new Date(recentCalculation.createdAt).toLocaleString(
                            'tr-TR',
                            {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </Text>
                      </View>
                      <View style={styles.recentActions}>
                        <TouchableOpacity
                          style={styles.recentActionButton}
                          onPress={() =>
                            handleOpenRecentCalculation(recentCalculation)
                          }
                        >
                          <Text style={styles.recentActionText}>Görüntüle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.recentActionButton,
                            styles.recentPdfButton,
                            isInterstitialActionRunning && styles.disabledActionButton,
                          ]}
                          onPress={() =>
                            handleShareRecentCalculationPdf(recentCalculation)
                          }
                          disabled={isInterstitialActionRunning}
                        >
                          <Text style={styles.recentPdfText}>PDF</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                : null}
            </View>
          ) : null}

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
              <LoanResult
                resultRef={resultRef}
                result={result}
                onShare={handleShare}
                onSharePdf={handleSharePdf}
                isActionDisabled={isInterstitialActionRunning}
              />
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.buttonContainer,
            { paddingBottom: ACTION_BAR_VERTICAL_PADDING + insets.bottom },
          ]}
        >
          <TouchableOpacity style={styles.button} onPress={handleCalculate}>
            <View style={styles.buttonIconBadge}>
              <Feather name="zap" size={18} color="#FFDD57" />
            </View>
            <Text style={styles.buttonText}>Hesapla</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: colors.background,
  },
  nativeRepaintGuard: {
    opacity: 0.999,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  infoButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
    ...shadows.card,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 18,
  },
  loanTypeGroup: {
    gap: spacing.sm,
  },
  loanTypeOption: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loanTypeOptionSelected: {
    backgroundColor: '#E7F5FF',
    borderColor: colors.primary,
  },
  loanTypeText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '800',
  },
  loanTypeTextSelected: {
    color: colors.primaryDark,
  },
  planTypeGroup: {
    gap: spacing.sm,
  },
  planTypeOption: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planTypeOptionSelected: {
    backgroundColor: '#E7F5FF',
    borderColor: colors.primary,
  },
  planTypeText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '800',
  },
  planTypeTextSelected: {
    color: colors.primaryDark,
  },
  customPaymentGroup: {
    gap: spacing.sm,
  },
  customPaymentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addCustomPaymentButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  addCustomPaymentText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '900',
  },
  customPaymentRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customPaymentInstallmentInput: {
    flex: 0.8,
  },
  customPaymentAmountInput: {
    flex: 1.4,
  },
  removeCustomPaymentButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginBottom: 0,
    width: 44,
  },
  removeCustomPaymentButtonDisabled: {
    opacity: 0.45,
  },
  rateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateInput: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: colors.text,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  dateInputText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  datePickerOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  datePickerSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card,
  },
  datePickerSpinner: {
    alignSelf: 'stretch',
    height: 216,
  },
  datePickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  datePickerTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  datePickerClose: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  datePickerDone: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  datePickerDoneText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  aboutOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  aboutSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    maxHeight: '82%',
    padding: spacing.lg,
    width: '100%',
    ...shadows.card,
  },
  aboutContent: {
    flexGrow: 0,
    width: '100%',
  },
  aboutContentInner: {
    gap: spacing.md,
    paddingRight: spacing.xs,
  },
  aboutTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 26,
    width: '100%',
  },
  aboutText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
    width: '100%',
  },
  aboutStrong: {
    fontWeight: '900',
  },
  aboutLinkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '100%',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  aboutLink: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '900',
  },
  aboutCloseButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  aboutCloseText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  contactToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  contactToggleTextWrapper: {
    flex: 1,
    gap: spacing.xs,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  recentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  recentHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  recentHeaderIcon: {
    alignItems: 'center',
    flexShrink: 0,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  recentItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.md,
    padding: spacing.md,
  },
  recentItemMain: {
    gap: spacing.xs,
  },
  recentItemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recentDeleteButton: {
    padding: 4,
  },
  recentItemTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  recentItemText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  recentItemMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.55,
  },
  recentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recentActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  recentPdfButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabledActionButton: {
    opacity: 0.55,
  },
  recentActionText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '900',
  },
  recentPdfText: {
    color: colors.surface,
    fontSize: typography.small,
    fontWeight: '900',
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderColor: '#FFC9C9',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
  },
  buttonContainer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: ACTION_BAR_VERTICAL_PADDING,
    position: 'absolute',
    right: 0,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0877E8',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 54,
    shadowColor: '#0877E8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  buttonIconBadge: {
    alignItems: 'center',
    backgroundColor: '#0757B8',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '800',
  },
});

export default LoanCalculator;
