import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CommercialInput, CommercialResult } from '../domain/commercial/types';

const KEY = '@bankaci/commercial-calculations/v1';
const LIMIT = 20;

export type StoredCommercialCalculation = {
  id: string;
  createdAt: string;
  input: CommercialInput;
  result: CommercialResult;
};

const reviveDates = (item: StoredCommercialCalculation): StoredCommercialCalculation => {
  const input = item.input as any;
  ['creditUsageDate', 'firstInstallmentDate', 'maturityDate', 'startDate', 'endDate', 'transactionDate'].forEach((key) => {
    if (input[key]) input[key] = new Date(input[key]);
  });
  input.movements?.forEach((movement: any) => { movement.date = new Date(movement.date); });
  const result = item.result as any;
  result.input = input;
  result.schedule?.forEach((row: any) => { row.date = new Date(row.date); });
  result.periods?.forEach((period: any) => {
    period.startDate = new Date(period.startDate);
    period.endDate = new Date(period.endDate);
  });
  return item;
};

export const getCommercialCalculations = async (): Promise<StoredCommercialCalculation[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredCommercialCalculation[]).map(reviveDates) : [];
  } catch { return []; }
};

export const saveCommercialCalculation = async (input: CommercialInput, result: CommercialResult) => {
  const current = await getCommercialCalculations();
  const item: StoredCommercialCalculation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(), input, result,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify([item, ...current].slice(0, LIMIT)));
  return item;
};
