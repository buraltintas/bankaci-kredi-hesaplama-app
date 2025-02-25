import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Feather } from '@expo/vector-icons';
import { formatMoney } from '../utils/formatters';

const LoanResult = ({
  resultRef,
  monthlyPayment,
  amount,
  term,
  interestRate,
  kkdf,
  bsmv,
  onShare,
}) => {
  const formattedAmount = formatMoney(
    parseFloat(amount.replace(/\./g, '').replace(',', '.'))
  );

  return (
    <>
      <ViewShot ref={resultRef} options={{ format: 'jpg', quality: 0.9 }}>
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Kredi Tutarı:</Text>
          <Text style={styles.resultValue}>{formattedAmount}</Text>

          <Text style={styles.resultLabel}>Vade:</Text>
          <Text style={styles.resultValue}>{term} Ay</Text>

          <Text style={styles.resultLabel}>Aylık Taksit Tutarı:</Text>
          <Text style={styles.resultValue}>{formatMoney(monthlyPayment)}</Text>

          <Text style={styles.resultLabel}>Toplam Geri Ödeme:</Text>
          <Text style={styles.resultValue}>
            {formatMoney(monthlyPayment * parseFloat(term))}
          </Text>

          <View style={styles.infoContainer}>
            <Text style={styles.info}>Faiz Oranı: %{interestRate}</Text>
          </View>
          <View style={styles.infoContainer}>
            <Text style={styles.info}>KKDF: %{kkdf}</Text>
            <Text style={styles.info}>BSMV: %{bsmv}</Text>
          </View>
        </View>
      </ViewShot>

      <TouchableOpacity
        style={[styles.shareButton, styles.resultContainer]}
        onPress={onShare}
      >
        <Feather name='share-2' size={24} color='#2196F3' />
        <Text style={styles.shareButtonText}>Paylaş</Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  resultContainer: {
    marginTop: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  infoContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  info: {
    color: '#666',
    fontSize: 14,
  },
  shareButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: '#2196F3',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LoanResult;
