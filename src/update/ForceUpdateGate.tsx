import React, { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../design/tokens';
import {
  getAndroidUpdateRequirement,
  type AndroidUpdateRequirement,
} from './forceUpdateService';

type AndroidInAppUpdateModule = {
  startImmediateUpdate: () => Promise<boolean>;
};

const androidInAppUpdate = NativeModules.AndroidInAppUpdate as
  | AndroidInAppUpdateModule
  | undefined;

const openPlayStore = async (webStoreUrl: string): Promise<void> => {
  const marketUrl =
    'market://details?id=com.xewor.bankacikredihesaplama';

  try {
    await Linking.openURL(marketUrl);
  } catch {
    await Linking.openURL(webStoreUrl);
  }
};

const ForceUpdateGate = ({ children }: PropsWithChildren) => {
  const [requirement, setRequirement] =
    useState<AndroidUpdateRequirement | null>(null);
  const [isStartingUpdate, setIsStartingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const refreshRequirement = useCallback(async () => {
    const nextRequirement = await getAndroidUpdateRequirement();
    setRequirement(nextRequirement);
  }, []);

  useEffect(() => {
    void refreshRequirement();

    if (Platform.OS !== 'android') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshRequirement();
      }
    });

    return () => subscription.remove();
  }, [refreshRequirement]);

  const handleUpdate = useCallback(async () => {
    if (!requirement) {
      return;
    }

    setIsStartingUpdate(true);
    setUpdateError('');

    try {
      const didStartImmediateUpdate =
        (await androidInAppUpdate?.startImmediateUpdate()) ?? false;

      if (!didStartImmediateUpdate) {
        await openPlayStore(requirement.policy.storeUrl);
      }
    } catch {
      try {
        await openPlayStore(requirement.policy.storeUrl);
      } catch {
        setUpdateError(
          'Google Play açılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
        );
      }
    } finally {
      setIsStartingUpdate(false);
    }
  }, [requirement]);

  const isUpdateRequired = requirement?.isRequired === true;

  return (
    <View style={styles.root}>
      {children}
      <Modal
        visible={isUpdateRequired}
        animationType="fade"
        onRequestClose={() => undefined}
        statusBarTranslucent={false}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Feather name="download-cloud" size={34} color={colors.primary} />
            </View>
            <Text style={styles.title}>Güncelleme gerekli</Text>
            <Text style={styles.message}>{requirement?.policy.message}</Text>
            <Text style={styles.detail}>
              Bu sürüm artık desteklenmiyor. Güvenli ve sorunsuz kullanım için
              en güncel Bankacı sürümünü yükleyin.
            </Text>

            {updateError ? <Text style={styles.error}>{updateError}</Text> : null}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Bankacı'yı şimdi güncelle"
              style={styles.updateButton}
              onPress={() => void handleUpdate()}
              disabled={isStartingUpdate}
            >
              <Feather name="refresh-cw" size={19} color={colors.surface} />
              <Text style={styles.updateButtonText}>
                {isStartingUpdate ? 'Google Play açılıyor…' : 'Şimdi güncelle'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl * 2,
    padding: spacing.xl,
    ...shadows.card,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#E7F1FC',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  detail: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  updateButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 54,
  },
  updateButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '800',
  },
});

export default ForceUpdateGate;
