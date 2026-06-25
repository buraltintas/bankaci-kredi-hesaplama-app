import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../src/design/tokens';
import { formatCurrency } from '../src/utils/formatCurrency';
import { formatDate } from '../src/utils/dateMath';

const PLAN_TYPE_LABELS = {
  standard: 'Standart Sabit Taksitli',
  prepaidInterest: 'Peşin Faiz Ödemeli',
};

const formatPercent = (value, fractionDigits = 4, minimumFractionDigits = 0) =>
  `%${value.toLocaleString('tr-TR', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits,
  })}`;

const SummaryMetric = ({ label, value, highlighted }) => (
  <View style={[styles.metric, highlighted && styles.highlightMetric]}>
    <Text style={[styles.metricLabel, highlighted && styles.highlightLabel]}>
      {label}
    </Text>
    <Text style={[styles.metricValue, highlighted && styles.highlightValue]}>
      {value}
    </Text>
  </View>
);

const ScheduleRow = ({ item }) => (
  <View style={styles.scheduleRow}>
    <View style={styles.scheduleHeader}>
      <Text style={styles.scheduleNumber}>
        {item.isPrepaidInterest
          ? '0. Taksit Peşin Faiz'
          : `${item.installmentNumber}. Taksit`}
      </Text>
      <Text style={styles.scheduleDate}>{formatDate(item.date)}</Text>
    </View>
    <View style={styles.scheduleGrid}>
      <Text style={styles.scheduleCell}>Taksit: {formatCurrency(item.installment)}</Text>
      <Text style={styles.scheduleCell}>Anapara: {formatCurrency(item.principal)}</Text>
      <Text style={styles.scheduleCell}>Faiz: {formatCurrency(item.interest)}</Text>
      <Text style={styles.scheduleCell}>KKDF: {formatCurrency(item.kkdf)}</Text>
      <Text style={styles.scheduleCell}>BSMV: {formatCurrency(item.bsmv)}</Text>
      <Text style={styles.scheduleCell}>Kalan: {formatCurrency(item.remainingPrincipal)}</Text>
    </View>
  </View>
);

const LoanResult = ({ resultRef, result, onShare, onSharePdf, isActionDisabled = false }) => {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const previewSchedule = useMemo(
    () => (isScheduleOpen ? result.schedule : []),
    [isScheduleOpen, result.schedule]
  );
  const hasBrokenPeriod = result.brokenPeriod.diffDays !== 0;
  const isPrepaidInterest = result.planType === 'prepaidInterest';

  return (
    <>
      <ViewShot ref={resultRef} options={{ format: 'jpg', quality: 0.9 }}>
        <View style={styles.resultContainer}>
          <View style={styles.heroResult}>
            <Text style={styles.heroLabel}>Aylık Taksit</Text>
            <Text style={styles.heroValue}>
              {formatCurrency(result.standardInstallment)}
            </Text>
            <Text style={styles.heroSubValue}>
              İlk taksit {formatCurrency(result.firstInstallment)}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <SummaryMetric
              label="Kredi Tutarı"
              value={formatCurrency(result.input.principal)}
              highlighted
            />
            <SummaryMetric label="Vade" value={`${result.input.term} ay`} />
            {isPrepaidInterest ? (
              <SummaryMetric
                label="Plan Tipi"
                value={PLAN_TYPE_LABELS.prepaidInterest}
              />
            ) : null}
            <SummaryMetric
              label={isPrepaidInterest ? 'Baz Aylık Faiz Oranı' : 'Aylık Faiz Oranı'}
              value={formatPercent(result.input.monthlyInterestRatePercent)}
            />
            {isPrepaidInterest ? (
              <>
                <SummaryMetric
                  label="İndirimli Faiz Oranı"
                  value={formatPercent(
                    (result.discountedMonthlyRate ?? 0) * 100,
                    3,
                    3
                  )}
                />
                <SummaryMetric
                  label="0. Taksit Peşin Faiz"
                  value={formatCurrency(result.realizedPrepaidInterest ?? 0)}
                />
              </>
            ) : null}
            <SummaryMetric label="Toplam Faiz" value={formatCurrency(result.totalInterest)} />
            <SummaryMetric label="Toplam BSMV" value={formatCurrency(result.totalBsmv)} />
            <SummaryMetric label="Toplam KKDF" value={formatCurrency(result.totalKkdf)} />
            <SummaryMetric label="Toplam Ödeme" value={formatCurrency(result.totalPayment)} />
          </View>

          <View style={styles.dateStrip}>
            <View>
              <Text style={styles.dateLabel}>Kullanım</Text>
              <Text style={styles.dateValue}>{formatDate(result.input.creditUsageDate)}</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.textMuted} />
            <View>
              <Text style={styles.dateLabel}>İlk Taksit</Text>
              <Text style={styles.dateValue}>{formatDate(result.input.firstInstallmentDate)}</Text>
            </View>
          </View>

          {hasBrokenPeriod ? (
            <View style={styles.brokenBox}>
              <Feather name="calendar" size={18} color={colors.warning} />
              <View style={styles.brokenTextWrapper}>
                <Text style={styles.brokenTitle}>
                  Kırık dönem farkı sadece 1. taksite yansıtıldı.
                </Text>
                <Text style={styles.brokenText}>
                  Gün farkı {result.brokenPeriod.diffDays}; faiz{' '}
                  {formatCurrency(result.brokenPeriod.interestDiff)}, KKDF{' '}
                  {formatCurrency(result.brokenPeriod.kkdfDiff)}, BSMV{' '}
                  {formatCurrency(result.brokenPeriod.bsmvDiff)}.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ViewShot>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.secondaryButton, isActionDisabled && styles.disabledButton]}
          onPress={onShare}
          disabled={isActionDisabled}
        >
          <Feather name="share-2" size={19} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Paylaş</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pdfButton, isActionDisabled && styles.disabledButton]}
          onPress={onSharePdf}
          disabled={isActionDisabled}
        >
          <Feather name="file-text" size={19} color={colors.surface} />
          <Text style={styles.pdfButtonText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scheduleCard}>
        <TouchableOpacity
          style={styles.scheduleToggle}
          onPress={() => setIsScheduleOpen((value) => !value)}
        >
          <View>
            <Text style={styles.sectionTitle}>Ödeme Planı</Text>
            <Text style={styles.scheduleHint}>
              {isPrepaidInterest
                ? `${result.input.term} taksit + 0. taksit peşin faiz`
                : `${result.schedule.length} taksit detaylı amortisman tablosu`}
            </Text>
          </View>
          <Feather
            name={isScheduleOpen ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>

        {previewSchedule.map((item) => (
          <ScheduleRow key={`${item.installmentNumber}-${item.date.toISOString()}`} item={item} />
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  resultContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  heroResult: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  heroLabel: {
    color: '#BFD7EA',
    fontSize: typography.small,
    fontWeight: '800',
  },
  heroValue: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '900',
  },
  heroSubValue: {
    color: '#DCEAF7',
    fontSize: typography.small,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  highlightMetric: {
    backgroundColor: '#E7F5FF',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  highlightLabel: {
    color: colors.primary,
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  highlightValue: {
    color: colors.primaryDark,
  },
  dateStrip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  dateValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  brokenBox: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E8',
    borderColor: '#FFE8A3',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  brokenTextWrapper: {
    flex: 1,
    gap: spacing.xs,
  },
  brokenTitle: {
    color: colors.warning,
    fontSize: typography.small,
    fontWeight: '900',
  },
  brokenText: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pdfButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
  },
  pdfButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  scheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  scheduleToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  scheduleHint: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  scheduleRow: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scheduleHeader: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  scheduleNumber: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  scheduleDate: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '900',
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
  },
  scheduleCell: {
    color: colors.text,
    flexBasis: '50%',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
});

export default LoanResult;
