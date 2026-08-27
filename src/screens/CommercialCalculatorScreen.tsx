import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CalculateActionBar from '../components/CalculateActionBar';
import NumericInput from '../components/NumericInput';
import ResultBannerAd from '../../components/AdBanner';
import { useInterstitialAction } from '../ads/useInterstitialAction';
import { buildCommercialAnalyticsEvent } from '../analytics/calculationEvents';
import { trackCalculation } from '../analytics/analyticsStorage';
import { calculateCommercial } from '../domain/commercial/calculateCommercial';
import { buildCommercialShareMessage } from '../domain/commercial/shareSummary';
import { COMMERCIAL_PRODUCT_LABELS, type CommercialInput, type CommercialProductType, type CommercialResult } from '../domain/commercial/types';
import { colors, premium, radius, spacing, typography, shadows } from '../design/tokens';
import { formatCurrency } from '../utils/formatCurrency';
import { addMonths, formatDate } from '../utils/dateMath';
import { parseNumericInput } from '../utils/sanitizeNumericInput';
import { exportCommercialPdf } from '../pdf/exportCommercialPdf';
import { getCommercialCalculations, saveCommercialCalculation, type StoredCommercialCalculation } from '../storage/commercialCalculatorStorage';
import { loadPdfContactPreferences, savePdfContactPreferences } from '../storage/calculatorStorage';
import { usePremium } from '../subscription/PremiumProvider';
import { usePaywall } from '../subscription/PaywallProvider';
import { canExportPdf } from '../subscription/premiumFeatures';

type Props = { topContent?: React.ReactNode; contentOpacity?: Animated.Value };
type MovementForm = { id: string; date: Date; kind: 'usage' | 'repayment'; amount: string };
const products = Object.keys(COMMERCIAL_PRODUCT_LABELS) as CommercialProductType[];
const n = (value: string, mode: 'decimal' | 'money' | 'integer' = 'decimal') => parseNumericInput(value, mode).value ?? 0;
const inputNumber = (value: number) => String(value).replace('.', ',');
const inputMoney = (value: number) => {
  const [whole, fraction] = value.toFixed(2).split('.');
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === '00' ? formatted : `${formatted},${fraction}`;
};
const defaultStart = new Date();

function DateField({ label, value, onChange }: { label: string; value: Date; onChange: (date: Date) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TouchableOpacity style={styles.date} onPress={() => setOpen(true)}><Text style={styles.dateText}>{formatDate(value)}</Text><Feather name="calendar" size={19} color={colors.primary} /></TouchableOpacity>{open ? <DateTimePicker value={value} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, date) => { if (Platform.OS !== 'ios') setOpen(false); if (date) onChange(date); }} /> : null}{open && Platform.OS === 'ios' ? <TouchableOpacity onPress={() => setOpen(false)}><Text style={styles.done}>Tamam</Text></TouchableOpacity> : null}</View>;
}

const Metric = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => <View style={[styles.metric, strong && styles.metricStrong]}><Text style={[styles.metricLabel, strong && styles.onStrong]}>{label}</Text><Text style={[styles.metricValue, strong && styles.onStrong]}>{value}</Text></View>;

export default function CommercialCalculatorScreen({ topContent, contentOpacity }: Props) {
  const insets = useSafeAreaInsets(); const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null); const resultY = useRef(0);
  const { isPremium } = usePremium(); const { openPaywall } = usePaywall();
  const { isInterstitialActionRunning, runActionWithOptionalInterstitial } = useInterstitialAction();
  const [product, setProduct] = useState<CommercialProductType>('commercial_installment');
  const [principal, setPrincipal] = useState(''); const [rate, setRate] = useState('');
  const [term, setTerm] = useState('12'); const [frequency, setFrequency] = useState<1 | 3 | 6>(1);
  const [startDate, setStartDate] = useState(defaultStart); const [endDate, setEndDate] = useState(addMonths(defaultStart, 1));
  const [bsmv, setBsmv] = useState('5'); const [kkdf, setKkdf] = useState('0'); const [otherTax, setOtherTax] = useState('0');
  const [revolvingMode, setRevolvingMode] = useState<'simple' | 'movements'>('simple');
  const [documentType, setDocumentType] = useState<'cheque' | 'promissory_note'>('cheque');
  const [includeDiscountTransactionDay, setIncludeDiscountTransactionDay] = useState(true);
  const [movements, setMovements] = useState<MovementForm[]>([{ id: 'initial', date: defaultStart, kind: 'usage', amount: '' }]);
  const [result, setResult] = useState<CommercialResult | null>(null); const [history, setHistory] = useState<StoredCommercialCalculation[]>([]);
  const [showDetails, setShowDetails] = useState(false); const [showHistory, setShowHistory] = useState(false);
  const [includeContactInfo, setIncludeContactInfo] = useState(false);
  const [contactFullName, setContactFullName] = useState(''); const [contactPhone, setContactPhone] = useState('');
  const [hasLoadedContactPreferences, setHasLoadedContactPreferences] = useState(false);
  useEffect(() => { void getCommercialCalculations().then(setHistory); }, []);
  useEffect(() => {
    let mounted = true;
    void loadPdfContactPreferences().then((preferences) => {
      if (!mounted) return;
      if (preferences) {
        setIncludeContactInfo(preferences.includeContactInfo);
        setContactFullName(preferences.fullName);
        setContactPhone(preferences.phone);
      }
      setHasLoadedContactPreferences(true);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!hasLoadedContactPreferences) return;
    void savePdfContactPreferences({ includeContactInfo, fullName: contactFullName, phone: contactPhone }).catch(() => undefined);
  }, [contactFullName, contactPhone, hasLoadedContactPreferences, includeContactInfo]);

  const taxConfig = { bsmvRatePercent: n(bsmv), kkdfRatePercent: n(kkdf), otherTaxRatePercent: n(otherTax) };
  const createInput = (): CommercialInput => {
    if (product === 'commercial_installment') return { productType: product, principal: n(principal, 'money'), monthlyInterestRatePercent: n(rate), termMonths: n(term, 'integer'), paymentFrequencyMonths: frequency, creditUsageDate: startDate, firstInstallmentDate: endDate, ...taxConfig };
    if (product === 'commercial_spot') return { productType: product, principal: n(principal, 'money'), annualInterestRatePercent: n(rate), creditUsageDate: startDate, maturityDate: endDate, ...taxConfig };
    if (product === 'commercial_discount') return { productType: product, documentType, nominalAmount: n(principal, 'money'), annualDiscountRatePercent: n(rate), transactionDate: startDate, maturityDate: endDate, includeTransactionDay: includeDiscountTransactionDay, ...taxConfig };
    return { productType: product, mode: revolvingMode, principal: revolvingMode === 'simple' ? n(principal, 'money') : undefined, annualInterestRatePercent: n(rate), startDate, endDate, movements: revolvingMode === 'movements' ? movements.map((m) => ({ id: m.id, date: m.date, amount: n(m.amount, 'money') * (m.kind === 'repayment' ? -1 : 1) })) : undefined, ...taxConfig };
  };
  const calculate = async () => {
    let input: CommercialInput;
    let next: CommercialResult;
    try {
      input = createInput();
      next = calculateCommercial(input);
    } catch (error) {
      Alert.alert('Hesaplama yapılamadı', error instanceof Error ? error.message : 'Alanları kontrol edin.');
      return;
    }

    await runActionWithOptionalInterstitial('calculate', () => {
      setResult(next);
      setShowDetails(false);
      void saveCommercialCalculation(input, next).then(() => getCommercialCalculations().then(setHistory));
      void trackCalculation(buildCommercialAnalyticsEvent(next)).catch(() => undefined);
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, resultY.current - 12), animated: true }), 150);
    });
  };
  const shareResult = async () => {
    if (!result) return;
    await runActionWithOptionalInterstitial('share', async () => {
      try {
        await Share.share({ message: buildCommercialShareMessage(result) });
      } catch {
        Alert.alert('Paylaşım', 'Paylaşım sırasında bir hata oluştu.');
      }
    });
  };
  const exportPdf = async () => {
    if (!result) return;
    const contactInfo = includeContactInfo
      ? { fullName: contactFullName.trim(), phone: contactPhone.trim() }
      : undefined;
    if (includeContactInfo && (!contactInfo?.fullName || !contactInfo.phone)) {
      Alert.alert('İletişim bilgisi', 'PDF için isim soyisim ve telefon numarası girin.');
      return;
    }
    try {
      await exportCommercialPdf(result, contactInfo);
    } catch (error) {
      Alert.alert('PDF oluşturulamadı', error instanceof Error ? error.message : 'Tekrar deneyin.');
    }
  };
  const reopen = (item: StoredCommercialCalculation) => {
    const input = item.input;
    setProduct(input.productType); setBsmv(inputNumber(input.bsmvRatePercent)); setKkdf(inputNumber(input.kkdfRatePercent)); setOtherTax(inputNumber(input.otherTaxRatePercent));
    if (input.productType === 'commercial_installment') {
      setPrincipal(inputMoney(input.principal)); setRate(inputNumber(input.monthlyInterestRatePercent)); setTerm(String(input.termMonths)); setFrequency(input.paymentFrequencyMonths); setStartDate(input.creditUsageDate); setEndDate(input.firstInstallmentDate);
    } else if (input.productType === 'commercial_spot') {
      setPrincipal(inputMoney(input.principal)); setRate(inputNumber(input.annualInterestRatePercent)); setStartDate(input.creditUsageDate); setEndDate(input.maturityDate);
    } else if (input.productType === 'commercial_discount') {
      setPrincipal(inputMoney(input.nominalAmount)); setRate(inputNumber(input.annualDiscountRatePercent)); setDocumentType(input.documentType); setIncludeDiscountTransactionDay(input.includeTransactionDay ?? false); setStartDate(input.transactionDate); setEndDate(input.maturityDate);
    } else {
      setRevolvingMode(input.mode); setRate(inputNumber(input.annualInterestRatePercent)); setStartDate(input.startDate); setEndDate(input.endDate);
      if (input.principal) setPrincipal(inputMoney(input.principal));
      if (input.movements) setMovements(input.movements.map((movement, index) => ({ id: movement.id ?? `${Date.now()}-${index}`, date: movement.date, kind: movement.amount < 0 ? 'repayment' : 'usage', amount: inputMoney(Math.abs(movement.amount)) })));
    }
    setResult(item.result); setTimeout(() => scrollRef.current?.scrollTo({ y: resultY.current, animated: true }), 100);
  };
  const headline = result?.productType === 'commercial_installment'
    ? [
        result.input.paymentFrequencyMonths === 1
          ? 'Aylık taksit'
          : `${result.input.paymentFrequencyMonths} ayda bir taksit`,
        result.regularInstallment,
      ]
    : result?.productType === 'commercial_spot'
      ? ['Vade sonu ödeme', result.maturityPayment]
      : result?.productType === 'commercial_discount'
        ? ['Net ele geçen tutar', result.netProceeds]
        : result
          ? ['Toplam finansman maliyeti', result.totalFinancingCost]
          : null;
  const resultDescription = result
    ? result.productType === 'commercial_installment'
      ? `${COMMERCIAL_PRODUCT_LABELS[result.productType]} · ${result.input.paymentFrequencyMonths === 1 ? 'Aylık ödeme' : `${result.input.paymentFrequencyMonths} ayda bir ödeme`}`
      : result.productType === 'commercial_revolving'
        ? `${COMMERCIAL_PRODUCT_LABELS[result.productType]} · ${result.input.mode === 'movements' ? 'Hareketli hesap' : 'Basit hesap'}`
        : result.productType === 'commercial_discount'
          ? `${COMMERCIAL_PRODUCT_LABELS[result.productType]} · ${result.input.documentType === 'cheque' ? 'Çek' : 'Senet'}`
          : COMMERCIAL_PRODUCT_LABELS[result.productType]
    : null;

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scrollRef} style={styles.scrollView} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} stickyHeaderIndices={topContent ? [1] : undefined} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.lg + (Platform.OS === 'android' ? insets.top : 0), paddingBottom: 100 + tabBarHeight }]}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>BANKACI</Text><Text style={styles.title}>Kredi Hesaplama</Text></View></View>{topContent}
    <Animated.View style={[styles.animatedContent, contentOpacity ? { opacity: contentOpacity } : null]}>
    <View style={styles.card}><Text style={styles.sectionTitle}>Ticari Kredi Bilgileri</Text><Text style={styles.label}>Kredi Tipi</Text><View style={styles.productGrid}>{products.map((key) => <TouchableOpacity key={key} onPress={() => { setProduct(key); setResult(null); }} style={[styles.product, product === key && styles.productSelected]}><Text style={[styles.productText, product === key && styles.productTextSelected]}>{COMMERCIAL_PRODUCT_LABELS[key]}</Text></TouchableOpacity>)}</View>
      {product === 'commercial_revolving' ? <><Text style={styles.label}>Hesaplama biçimi</Text><View style={styles.row}>{(['simple', 'movements'] as const).map((key) => <TouchableOpacity key={key} style={[styles.choice, revolvingMode === key && styles.choiceSelected]} onPress={() => setRevolvingMode(key)}><Text style={revolvingMode === key ? styles.choiceTextSelected : styles.choiceText}>{key === 'simple' ? 'Basit' : 'Hareketli hesap'}</Text></TouchableOpacity>)}</View></> : null}
      {product === 'commercial_discount' ? <><Text style={styles.label}>Belge türü</Text><View style={styles.row}>{(['cheque', 'promissory_note'] as const).map((key) => <TouchableOpacity key={key} style={[styles.choice, documentType === key && styles.choiceSelected]} onPress={() => setDocumentType(key)}><Text style={documentType === key ? styles.choiceTextSelected : styles.choiceText}>{key === 'cheque' ? 'Çek' : 'Senet'}</Text></TouchableOpacity>)}</View></> : null}
      {!(product === 'commercial_revolving' && revolvingMode === 'movements') ? <NumericInput label={product === 'commercial_discount' ? 'Nominal tutar (TL)' : 'Kredi tutarı (TL)'} value={principal} onChangeText={setPrincipal} mode="money" placeholder="Örn. 500.000" /> : null}
      <NumericInput label={product === 'commercial_installment' ? 'Aylık faiz oranı (%)' : product === 'commercial_discount' ? 'Yıllık iskonto oranı (%)' : 'Yıllık faiz oranı (%)'} value={rate} onChangeText={setRate} placeholder="Örn. 5,75" />
      {product === 'commercial_installment' ? <><NumericInput label="Vade (ay)" value={term} onChangeText={setTerm} mode="integer"/><Text style={styles.label}>Ödeme sıklığı</Text><View style={styles.row}>{([1,3,6] as const).map((key) => <TouchableOpacity key={key} style={[styles.choice, frequency === key && styles.choiceSelected]} onPress={() => setFrequency(key)}><Text style={frequency === key ? styles.choiceTextSelected : styles.choiceText}>{key === 1 ? 'Aylık' : `${key} ayda bir`}</Text></TouchableOpacity>)}</View></> : null}
      <View style={styles.dateRow}><DateField label={product === 'commercial_installment' ? 'Kullandırım' : product === 'commercial_discount' ? 'İskonto tarihi' : 'Başlangıç'} value={startDate} onChange={setStartDate}/><DateField label={product === 'commercial_installment' ? 'İlk taksit' : product === 'commercial_discount' ? 'Faize esas vade' : 'Vade / bitiş'} value={endDate} onChange={setEndDate}/></View>
      {product === 'commercial_discount' ? <><Text style={styles.label}>İskonto günü faize dahil mi?</Text><View style={styles.row}><TouchableOpacity style={[styles.choice, !includeDiscountTransactionDay && styles.choiceSelected]} onPress={() => setIncludeDiscountTransactionDay(false)}><Text style={!includeDiscountTransactionDay ? styles.choiceTextSelected : styles.choiceText}>Hariç</Text></TouchableOpacity><TouchableOpacity style={[styles.choice, includeDiscountTransactionDay && styles.choiceSelected]} onPress={() => setIncludeDiscountTransactionDay(true)}><Text style={includeDiscountTransactionDay ? styles.choiceTextSelected : styles.choiceText}>Dahil · TCMB yöntemi</Text></TouchableOpacity></View><Text style={styles.hint}>Vade tatil gününe denk geliyorsa bankanızın faize esas aldığı düzeltilmiş tarihi girin.</Text></> : null}
      {product === 'commercial_revolving' && revolvingMode === 'movements' ? <View style={styles.movements}><Text style={styles.sectionTitle}>Hesap hareketleri</Text><Text style={styles.hint}>Kullanım bakiyeyi artırır, geri ödeme azaltır. Tarih alanına işlem tarihini değil, bankanın faize esas aldığı valör tarihini girin; geri ödeme valörü bankaya göre sonraki iş günü olabilir.</Text>{movements.map((movement, index) => <View key={movement.id} style={styles.movement}><DateField label={`${index + 1}. hareket valörü`} value={movement.date} onChange={(date) => setMovements((all) => all.map((m) => m.id === movement.id ? {...m,date} : m))}/><View style={styles.row}>{(['usage','repayment'] as const).map((kind) => <TouchableOpacity key={kind} style={[styles.miniChoice, movement.kind === kind && styles.choiceSelected]} onPress={() => setMovements((all) => all.map((m) => m.id === movement.id ? {...m,kind} : m))}><Text style={movement.kind === kind ? styles.choiceTextSelected : styles.choiceText}>{kind === 'usage' ? 'Kullanım' : 'Geri ödeme'}</Text></TouchableOpacity>)}</View><NumericInput label="Tutar (TL)" value={movement.amount} onChangeText={(amount) => setMovements((all) => all.map((m) => m.id === movement.id ? {...m,amount} : m))} mode="money"/>{movements.length > 1 ? <TouchableOpacity onPress={() => setMovements((all) => all.filter((m) => m.id !== movement.id))}><Text style={styles.remove}>Hareketi kaldır</Text></TouchableOpacity> : null}</View>)}<TouchableOpacity style={styles.add} onPress={() => setMovements((all) => [...all, { id: `${Date.now()}`, date: endDate, kind: 'usage', amount: '' }])}><Feather name="plus" size={18} color={colors.primary}/><Text style={styles.addText}>Hareket ekle</Text></TouchableOpacity></View> : null}
    </View>
    <View style={styles.card}><Text style={styles.sectionTitle}>Vergi ve fon oranları</Text><Text style={styles.hint}>Varsayılanlar ticari işlem için BSMV %5, KKDF %0'dır. Sözleşmenize göre düzenleyin.</Text><View style={styles.taxRow}><View style={styles.tax}><NumericInput label="BSMV (%)" value={bsmv} onChangeText={setBsmv}/></View><View style={styles.tax}><NumericInput label="KKDF (%)" value={kkdf} onChangeText={setKkdf}/></View><View style={styles.tax}><NumericInput label="Diğer (%)" value={otherTax} onChangeText={setOtherTax}/></View></View></View>
    <View style={styles.card}><TouchableOpacity style={styles.contactToggle} onPress={() => setIncludeContactInfo((value) => !value)}><View style={styles.contactToggleText}><Text style={styles.sectionTitle}>PDF İletişim Bilgisi</Text><Text style={styles.hint}>İstenirse PDF çıktısına iletişim bilgisi eklenir.</Text></View><View style={[styles.checkbox, includeContactInfo && styles.checkboxSelected]}>{includeContactInfo ? <Feather name="check" size={18} color={colors.surface}/> : null}</View></TouchableOpacity>{includeContactInfo ? <><Text style={styles.label}>İsim Soyisim</Text><TextInput style={styles.textInput} value={contactFullName} onChangeText={setContactFullName} placeholder="Ad Soyad" placeholderTextColor={colors.textMuted} autoCapitalize="words"/><Text style={styles.label}>Telefon No</Text><TextInput style={styles.textInput} value={contactPhone} onChangeText={(value) => setContactPhone(value.replace(/[^0-9+() -]/g, ''))} placeholder="05xx xxx xx xx" placeholderTextColor={colors.textMuted} keyboardType="phone-pad"/></> : null}</View>
    <View onLayout={(event) => { resultY.current = event.nativeEvent.layout.y; }}>{result && headline ? <View style={styles.card}><View style={styles.resultType}><Text style={styles.resultTypeLabel}>Hesaplanan ticari ürün</Text><Text style={styles.resultTypeValue}>{resultDescription}</Text></View><Metric label={String(headline[0])} value={formatCurrency(Number(headline[1]))} strong/><View style={styles.metrics}>{result.productType === 'commercial_installment' ? <><Metric label="İlk taksit" value={formatCurrency(result.firstInstallment)}/><Metric label="Toplam geri ödeme" value={formatCurrency(result.totalRepayment)}/></> : null}<Metric label="Faiz / iskonto" value={formatCurrency(result.interest)}/><Metric label="BSMV" value={formatCurrency(result.bsmv)}/><Metric label="KKDF" value={formatCurrency(result.kkdf)}/><Metric label="Diğer vergi / fon" value={formatCurrency(result.otherTax)}/></View>
      {(result.productType === 'commercial_installment' || result.productType === 'commercial_revolving') ? <TouchableOpacity style={styles.detailButton} onPress={() => setShowDetails((v) => !v)}><Text style={styles.detailText}>{result.productType === 'commercial_installment' ? 'Ödeme planı' : 'Faiz dönemleri'}</Text><Feather name={showDetails ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary}/></TouchableOpacity> : null}
      {showDetails && result.productType === 'commercial_installment' ? result.schedule.map((row) => <View key={row.installmentNumber} style={styles.detailRow}><Text style={styles.detailText}>{row.installmentNumber}. taksit · {formatDate(row.date)}</Text><Text>{formatCurrency(row.installment)}</Text></View>) : null}
      {showDetails && result.productType === 'commercial_revolving' ? result.periods.map((row, index) => <View key={`${row.startDate}-${index}`} style={styles.detailRow}><Text style={styles.detailText}>{formatDate(row.startDate)} – {formatDate(row.endDate)} · {row.dayCount} gün</Text><Text>{formatCurrency(row.interest)}</Text></View>) : null}
      {result.productType === 'commercial_revolving' && result.input.mode === 'movements' ? <View style={styles.resultMovements}><Text style={styles.resultMovementsTitle}>Hesap hareketleri</Text>{result.input.movements?.map((movement, index) => <View key={movement.id ?? `${movement.date.toISOString()}-${index}`} style={styles.movementResultRow}><View><Text style={styles.movementResultDate}>{formatDate(movement.date)}</Text><Text style={styles.movementResultKind}>{movement.amount >= 0 ? 'Kullanım' : 'Geri ödeme'}</Text></View><Text style={[styles.movementResultAmount, movement.amount < 0 && styles.movementResultRepayment]}>{movement.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(movement.amount))}</Text></View>)}</View> : null}
      <View style={styles.actions}><View style={styles.actionColumn}><TouchableOpacity style={[styles.secondaryAction, isInterstitialActionRunning && styles.actionDisabled]} disabled={isInterstitialActionRunning} onPress={() => void shareResult()}><Feather name="share-2" size={20} color={colors.primary}/><Text style={styles.actionText}>Paylaş</Text></TouchableOpacity></View><View style={styles.actionColumn}><TouchableOpacity accessibilityRole="button" accessibilityLabel={canExportPdf(isPremium) ? 'PDF' : 'PDF (premium)'} style={[styles.primaryActionWrapper, isInterstitialActionRunning && styles.actionDisabled]} disabled={isInterstitialActionRunning} onPress={() => { if (!canExportPdf(isPremium)) return openPaywall(); void exportPdf(); }}>{canExportPdf(isPremium) ? <View style={styles.primaryAction}><Feather name="file-text" size={20} color={colors.surface}/><Text style={styles.primaryActionText}>PDF</Text></View> : <LinearGradient colors={premium.gradient} start={premium.gradientStart} end={premium.gradientEnd} style={styles.primaryAction}><MaterialCommunityIcons name="crown" size={19} color={premium.onGradient}/><Text style={styles.primaryActionText}>PDF</Text></LinearGradient>}</TouchableOpacity></View></View></View> : null}</View>
    {result ? <ResultBannerAd /> : null}
    {history.length ? <View style={styles.card}><TouchableOpacity style={styles.detailButton} onPress={() => setShowHistory((v) => !v)}><Text style={styles.sectionTitle}>Son ticari hesaplamalar</Text><Feather name={showHistory ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary}/></TouchableOpacity>{showHistory ? history.map((item) => <TouchableOpacity key={item.id} style={styles.history} onPress={() => reopen(item)}><View><Text style={styles.detailText}>{COMMERCIAL_PRODUCT_LABELS[item.input.productType]}</Text><Text style={styles.hint}>{new Date(item.createdAt).toLocaleString('tr-TR')}</Text></View><Feather name="arrow-right" size={18} color={colors.primary}/></TouchableOpacity>) : null}</View> : null}
    <Text style={styles.disclaimer}>Hesaplamalar bilgilendirme amaçlıdır. Banka tahsis, komisyon, sigorta ve farklı gün/değer tarihi uygulamaları sonucu değiştirebilir.</Text>
    </Animated.View>
  </ScrollView><CalculateActionBar onPress={() => void calculate()} isReady={Boolean(rate) && (Boolean(principal) || (product === 'commercial_revolving' && revolvingMode === 'movements'))} paddingBottom={spacing.lg}/></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:colors.background},flex:{flex:1,backgroundColor:colors.background},scrollView:{flex:1},scrollContent:{gap:spacing.lg,paddingHorizontal:spacing.lg},animatedContent:{gap:spacing.lg},header:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',paddingTop:spacing.md},eyebrow:{color:colors.primary,fontSize:typography.small,fontWeight:'800',letterSpacing:0,textTransform:'uppercase'},title:{color:colors.text,fontSize:typography.title,fontWeight:'800'},card:{backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.lg,gap:spacing.md,...shadows.card},sectionTitle:{color:colors.text,fontSize:typography.sectionTitle,fontWeight:'800'},resultType:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,padding:spacing.md},resultTypeLabel:{color:colors.textMuted,fontSize:12,fontWeight:'700'},resultTypeValue:{color:colors.text,fontSize:typography.body,fontWeight:'900',marginTop:spacing.xs},label:{color:colors.text,fontSize:typography.small,fontWeight:'700'},productGrid:{gap:spacing.sm},product:{backgroundColor:colors.surfaceMuted,borderColor:colors.border,borderRadius:radius.md,borderWidth:1,justifyContent:'center',minHeight:46,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},productSelected:{backgroundColor:'#E7F5FF',borderColor:colors.primary},productText:{color:colors.text,fontSize:typography.small,fontWeight:'800'},productTextSelected:{color:colors.primaryDark},field:{flex:1,gap:spacing.sm},dateRow:{flexDirection:'row',gap:spacing.sm},date:{alignItems:'center',backgroundColor:colors.surface,borderColor:colors.border,borderRadius:radius.md,borderWidth:1,flexDirection:'row',justifyContent:'space-between',minHeight:52,paddingHorizontal:spacing.md},dateText:{color:colors.text,fontWeight:'700'},done:{color:colors.primary,fontWeight:'800',textAlign:'right'},row:{flexDirection:'row',gap:spacing.sm},choice:{alignItems:'center',backgroundColor:colors.surfaceMuted,borderRadius:radius.md,flex:1,padding:11},miniChoice:{alignItems:'center',backgroundColor:colors.surfaceMuted,borderRadius:radius.md,flex:1,padding:8},choiceSelected:{backgroundColor:colors.primary},choiceText:{color:colors.text,fontSize:12,fontWeight:'700'},choiceTextSelected:{color:'white',fontSize:12,fontWeight:'800'},hint:{color:colors.textMuted,fontSize:12,lineHeight:18},taxRow:{flexDirection:'row',gap:spacing.sm},tax:{flex:1},contactToggle:{alignItems:'center',flexDirection:'row',gap:spacing.md,justifyContent:'space-between'},contactToggleText:{flex:1,gap:spacing.xs},checkbox:{alignItems:'center',borderColor:colors.border,borderRadius:radius.sm,borderWidth:1,height:28,justifyContent:'center',width:28},checkboxSelected:{backgroundColor:colors.primary,borderColor:colors.primary},textInput:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:radius.md,borderWidth:1,color:colors.text,fontSize:typography.body,minHeight:52,paddingHorizontal:spacing.md},movements:{gap:spacing.md},movement:{borderColor:colors.border,borderRadius:radius.md,borderWidth:1,gap:spacing.sm,padding:spacing.md},remove:{color:colors.danger,fontSize:12,fontWeight:'700'},add:{alignItems:'center',borderColor:colors.primary,borderRadius:radius.md,borderStyle:'dashed',borderWidth:1,flexDirection:'row',gap:spacing.sm,justifyContent:'center',padding:12},addText:{color:colors.primary,fontWeight:'800'},metric:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,flexGrow:1,minWidth:'46%',padding:spacing.md},metricStrong:{backgroundColor:colors.primaryDark,minWidth:'100%',padding:spacing.lg},metricLabel:{color:colors.textMuted,fontSize:12,fontWeight:'700'},metricValue:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:4},onStrong:{color:'white'},metrics:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},detailButton:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',paddingVertical:spacing.sm},detailText:{color:colors.text,fontWeight:'800'},detailRow:{alignItems:'center',borderTopColor:colors.border,borderTopWidth:1,flexDirection:'row',justifyContent:'space-between',paddingVertical:spacing.sm},resultMovements:{borderTopColor:colors.border,borderTopWidth:1,gap:spacing.sm,paddingTop:spacing.md},resultMovementsTitle:{color:colors.text,fontSize:typography.body,fontWeight:'900'},movementResultRow:{alignItems:'center',backgroundColor:colors.surfaceMuted,borderRadius:radius.md,flexDirection:'row',justifyContent:'space-between',padding:spacing.md},movementResultDate:{color:colors.text,fontWeight:'800'},movementResultKind:{color:colors.textMuted,fontSize:12,marginTop:2},movementResultAmount:{color:colors.primary,fontWeight:'900'},movementResultRepayment:{color:colors.success},actions:{alignItems:'stretch',flexDirection:'row',gap:spacing.sm,marginTop:spacing.sm},actionColumn:{flex:1,minWidth:0},secondaryAction:{alignItems:'center',borderColor:colors.border,borderRadius:radius.md,borderWidth:1,flexDirection:'row',gap:spacing.sm,justifyContent:'center',minHeight:52,paddingHorizontal:spacing.md,width:'100%'},primaryActionWrapper:{borderRadius:radius.md,minHeight:52,overflow:'hidden',width:'100%'},primaryAction:{alignItems:'center',backgroundColor:colors.primary,flex:1,flexDirection:'row',gap:spacing.sm,justifyContent:'center',minHeight:52,paddingHorizontal:spacing.md},actionDisabled:{opacity:0.55},actionText:{color:colors.primary,fontSize:typography.body,fontWeight:'900'},primaryActionText:{color:'white',fontSize:typography.body,fontWeight:'900'},history:{alignItems:'center',borderTopColor:colors.border,borderTopWidth:1,flexDirection:'row',justifyContent:'space-between',paddingVertical:spacing.md},disclaimer:{color:colors.textMuted,fontSize:11,lineHeight:17,marginBottom:spacing.xl,textAlign:'center'} });
