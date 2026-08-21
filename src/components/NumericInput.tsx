import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../design/tokens';
import {
  NumericInputMode,
  sanitizeNumericInput,
} from '../utils/sanitizeNumericInput';

type NumericInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  mode?: NumericInputMode;
  placeholder?: string;
  editable?: boolean;
  error?: string;
} & Pick<TextInputProps, 'returnKeyType'>;

const NumericInput = ({
  label,
  value,
  onChangeText,
  mode = 'decimal',
  placeholder,
  editable = true,
  error,
  returnKeyType,
}: NumericInputProps) => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            editable && value.length > 0 && styles.inputWithClearButton,
            !editable && styles.disabledInput,
            Boolean(error) && styles.errorInput,
          ]}
          keyboardType={mode === 'integer' ? 'number-pad' : 'decimal-pad'}
          value={value}
          onChangeText={(nextValue) =>
            onChangeText(sanitizeNumericInput(nextValue, mode))
          }
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          editable={editable}
          returnKeyType={returnKeyType}
        />
        {editable && value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} alanını temizle`}
            hitSlop={8}
            onPress={() => onChangeText('')}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.clearButtonPressed,
            ]}
          >
            <Feather name="x-circle" size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  inputWithClearButton: {
    paddingRight: 52,
  },
  clearButton: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    width: 40,
  },
  clearButtonPressed: {
    opacity: 0.55,
  },
  disabledInput: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
  },
  errorInput: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
  },
});

export default NumericInput;
