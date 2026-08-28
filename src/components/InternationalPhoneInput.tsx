import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import CountryPicker, { type Country, type CountryCode as PickerCountryCode } from 'react-native-country-picker-modal';
import { getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { colors, radius, spacing } from '../design/tokens';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const DEFAULT_COUNTRY: PickerCountryCode = 'TR';

export default function InternationalPhoneInput({ value, onChange, placeholder = '5xx xxx xx xx' }: Props) {
  const [countryCode, setCountryCode] = useState<PickerCountryCode>(DEFAULT_COUNTRY);
  const [callingCode, setCallingCode] = useState(getCountryCallingCode(DEFAULT_COUNTRY as CountryCode));
  const [nationalNumber, setNationalNumber] = useState('');

  useEffect(() => {
    if (!value || nationalNumber) return;
    const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY as CountryCode);
    if (!parsed) return;
    if (parsed.country) {
      setCountryCode(parsed.country as PickerCountryCode);
      setCallingCode(parsed.countryCallingCode);
    }
    setNationalNumber(parsed.formatNational());
  }, [nationalNumber, value]);

  const updateNumber = (nextValue: string, nextCountry = countryCode, nextCallingCode = callingCode) => {
    const safeValue = nextValue.replace(/[^\d\s()-]/g, '');
    setNationalNumber(safeValue);
    if (!safeValue.trim()) {
      onChange('');
      return;
    }

    const parsed = isSupportedCountry(nextCountry)
      ? parsePhoneNumberFromString(safeValue, nextCountry as CountryCode)
      : undefined;
    const fallbackDigits = safeValue.replace(/\D/g, '').replace(/^0+/, '');
    onChange(parsed?.number || `+${nextCallingCode}${fallbackDigits}`);
  };

  const selectCountry = (country: Country) => {
    const nextCallingCode = country.callingCode[0];
    setCountryCode(country.cca2);
    setCallingCode(nextCallingCode);
    updateNumber(nationalNumber, country.cca2, nextCallingCode);
  };

  return <View style={styles.container}>
    <View style={styles.countryButton}>
      <CountryPicker
        countryCode={countryCode}
        onSelect={selectCountry}
        preferredCountries={['TR']}
        translation="common"
        withCallingCode
        withCallingCodeButton
        withCloseButton
        withFilter
        withFlag
      />
    </View>
    <TextInput
      accessibilityLabel="Telefon numarası"
      autoComplete="tel"
      keyboardType="phone-pad"
      maxLength={24}
      onChangeText={updateNumber}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      style={styles.input}
      value={nationalNumber}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
  },
  countryButton: {
    alignItems: 'center',
    borderRightColor: colors.border,
    borderRightWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  input: {
    color: colors.text,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
});
