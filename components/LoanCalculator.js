import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  SafeAreaView,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { LOAN_TYPES } from '../utils/constants';
import { formatMoney, formatInput } from '../utils/formatters';
import LoanResult from './LoanResult';

const LoanCalculator = () => {
  const [loanTypeOpen, setLoanTypeOpen] = useState(false);
  const [loanType, setLoanType] = useState('Bireysel İhtiyaç/Taşıt Kredisi');

  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [bsmv, setBsmv] = useState('15');
  const [kkdf, setKkdf] = useState('15');
  const [term, setTerm] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  const loanTypeItems = Object.keys(LOAN_TYPES).map((type) => ({
    label: type,
    value: type,
  }));

  const handleLoanTypeChange = (type) => {
    setLoanType(type);
    setAmount('');
    setInterestRate('');
    setTerm('');
    setMonthlyPayment(0);
    setBsmv(LOAN_TYPES[type].bsmv.toString());
    setKkdf(LOAN_TYPES[type].kkdf.toString());
  };

  const handleAmountChange = (value) => {
    const formattedValue = formatInput(value);
    setAmount(formattedValue);
    setMonthlyPayment(0);
  };

  const handleInterestRateChange = (value) => {
    setInterestRate(value);
    setMonthlyPayment(0);
  };

  const handleBsmvChange = (value) => {
    setBsmv(value);
    setMonthlyPayment(0);
  };

  const handleKkdfChange = (value) => {
    setKkdf(value);
    setMonthlyPayment(0);
  };

  const handleTermChange = (value) => {
    setTerm(value);
    setMonthlyPayment(0);
  };

  const calculateLoan = () => {
    const principal = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    const rateStr = interestRate != null ? interestRate.toString() : '0';
    const parsedRate = parseFloat(rateStr.replace(',', '.'));
    const monthlyRate = parsedRate;
    const bsmvRate = parseFloat(bsmv);
    const kkdfRate = parseFloat(kkdf);
    const termCount = parseFloat(term);

    if (!principal || !monthlyRate || !termCount) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    const c = (monthlyRate / 100) * (1 + kkdfRate / 100 + bsmvRate / 100);

    const payment = parseFloat(
      (principal *
        ((monthlyRate / 100) * (1 + kkdfRate / 100 + bsmvRate / 100))) /
        (1 -
          1 /
            Math.pow(
              1 + (monthlyRate / 100) * (1 + kkdfRate / 100 + bsmvRate / 100),
              termCount
            ))
    );

    setMonthlyPayment(payment);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const scrollViewRef = React.useRef(null);
  const resultRef = React.useRef();

  const handleShare = async () => {
    try {
      const uri = await resultRef.current.capture();

      const shareOptions = {
        title: 'Kredi Hesaplama Sonucu',
        message: `Kredi Tutarı: ${amount} TL
        Vade: ${term} ay
        Faiz Oranı: %${interestRate}
        Aylık Taksit: ${formatMoney(monthlyPayment)}
        Toplam Geri Ödeme: ${formatMoney(monthlyPayment * parseFloat(term))}
        KKDF: %${kkdf} | BSMV: %${bsmv}`,
        url: Platform.OS === 'ios' ? uri : `file://${uri}`,
      };

      await Share.share(shareOptions);
    } catch (error) {
      alert('Paylaşım sırasında bir hata oluştu');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.mainContainer}
      >
        <Text style={styles.header}>Kredi Hesaplama</Text>

        <View style={styles.dropdownWrapper}>
          <Text style={styles.label}>Kredi Tipi</Text>
          <DropDownPicker
            open={loanTypeOpen}
            value={loanType}
            items={loanTypeItems}
            setOpen={setLoanTypeOpen}
            setValue={setLoanType}
            onSelectItem={(item) => handleLoanTypeChange(item.value)}
            placeholder='Kredi tipini seçiniz'
            style={styles.dropdown}
            zIndex={3000}
          />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Text style={styles.label}>Kredi Miktarı (TL)</Text>
            <TextInput
              style={styles.input}
              keyboardType='numeric'
              value={amount}
              onChangeText={handleAmountChange}
              placeholder='Kredi miktarını giriniz'
            />

            <Text style={styles.label}>Faiz Oranı (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType='numeric'
              value={interestRate}
              onChangeText={handleInterestRateChange}
              placeholder='Faiz oranını giriniz'
            />

            <Text style={styles.label}>BSMV (%)</Text>
            <TextInput
              style={[
                styles.input,
                loanType !== 'Özel' && styles.disabledInput,
              ]}
              keyboardType='numeric'
              value={bsmv}
              onChangeText={handleBsmvChange}
              editable={loanType === 'Özel'}
              placeholder='BSMV oranını giriniz'
            />

            <Text style={styles.label}>KKDF (%)</Text>
            <TextInput
              style={[
                styles.input,
                loanType !== 'Özel' && styles.disabledInput,
              ]}
              keyboardType='numeric'
              value={kkdf}
              onChangeText={handleKkdfChange}
              editable={loanType === 'Özel'}
              placeholder='KKDF oranını giriniz'
            />

            <Text style={styles.label}>Vade (Ay)</Text>
            <TextInput
              style={styles.input}
              keyboardType='numeric'
              value={term}
              onChangeText={handleTermChange}
              placeholder='Vade süresini giriniz'
            />

            {monthlyPayment > 0 && (
              <LoanResult
                resultRef={resultRef}
                monthlyPayment={monthlyPayment}
                amount={amount}
                term={term}
                interestRate={interestRate}
                kkdf={kkdf}
                bsmv={bsmv}
                onShare={handleShare}
              />
            )}
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={calculateLoan}>
            <Text style={styles.buttonText}>Hesapla</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    padding: 16,
    backgroundColor: '#fff',
  },
  dropdownWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  scrollView: {
    flex: 1,
    zIndex: 0,
    marginBottom: Platform.OS === 'ios' ? 90 : 80,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  dropdown: {
    borderColor: '#ddd',
    marginBottom: 16,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoanCalculator;
