import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APIError, apiRequest } from '../api/client';
import type { Member, MemberSession } from '../api/types';
import {
  colors,
  premium,
  radius,
  shadows,
  spacing,
  typography,
} from '../design/tokens';
import {
  identifyRevenueCatUser,
  resetRevenueCatToGuest,
} from '../subscription/purchases';
import { getStoredExpoPushToken } from '../notifications/pushTokenStorage';
import {
  clearPersistedSession,
  isSessionExpired,
  readPersistedSession,
  writePersistedSession,
} from './sessionStorage';

const IDENTITY_BOOT_TIMEOUT_MS = 8000;

type AuthContextValue = {
  session: MemberSession | null;
  user: Member | null;
  isLoading: boolean;
  openLogin: () => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (user: Member) => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
  openLogin: () => undefined,
  logout: async () => undefined,
  deleteAccount: async () => undefined,
  updateUser: () => undefined,
});

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<MemberSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const authRevision = useRef(0);

  useEffect(() => {
    let active = true;
    void readPersistedSession()
      .then(async (cached) => {
        if (!cached || !active) return;
        if (isSessionExpired(cached)) {
          await clearPersistedSession().catch(() => undefined);
          return;
        }
        const requestRevision = authRevision.current;
        setSession(cached);
        void Promise.race([
          identifyRevenueCatUser(cached.user.revenueCatUserId, cached.user.email),
          new Promise((resolve) => setTimeout(resolve, IDENTITY_BOOT_TIMEOUT_MS)),
        ]);
        void apiRequest<Member>('/v1/me', {
          token: cached.token,
        })
          .then(async (user) => {
            if (!active || authRevision.current !== requestRevision) return;
            const refreshed = { ...cached, user };
            setSession(refreshed);
            await writePersistedSession(refreshed);
          })
          .catch(async (error: unknown) => {
            if (!(error instanceof APIError) || error.status !== 401) return;
            if (!active || authRevision.current !== requestRevision) return;
            authRevision.current += 1;
            await clearPersistedSession().catch(() => undefined);
            setSession(null);
            await resetRevenueCatToGuest();
          });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const current = session;
      const requestRevision = authRevision.current;
      if (isSessionExpired(current)) {
        authRevision.current += 1;
        void clearPersistedSession()
          .catch(() => undefined)
          .finally(() => {
            if (!active) return;
            setSession(null);
            void resetRevenueCatToGuest();
          });
        return;
      }
      void apiRequest<Member>('/v1/me', { token: current.token })
        .then(async (user) => {
          if (!active || authRevision.current !== requestRevision) return;
          const refreshed = { ...current, user };
          setSession(refreshed);
          await writePersistedSession(refreshed);
        })
        .catch(async (error: unknown) => {
          if (!(error instanceof APIError) || error.status !== 401) return;
          if (!active || authRevision.current !== requestRevision) return;
          authRevision.current += 1;
          await clearPersistedSession().catch(() => undefined);
          setSession(null);
          await resetRevenueCatToGuest();
        });
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [session]);

  useEffect(() => {
    if (!session?.user.revenueCatUserId) return undefined;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void identifyRevenueCatUser(
          session.user.revenueCatUserId,
          session.user.email
        );
      }
    });
  }, [session?.user.email, session?.user.revenueCatUserId]);

  const completeLogin = useCallback(async (next: MemberSession) => {
    await writePersistedSession(next);
    authRevision.current += 1;
    setSession(next);
    await Promise.race([
      identifyRevenueCatUser(next.user.revenueCatUserId, next.user.email),
      new Promise<void>((resolve) => setTimeout(resolve, 6000)),
    ]);
    setIsLoginVisible(false);
  }, []);

  const logout = useCallback(async () => {
    const current = session;
    await clearPersistedSession();
    authRevision.current += 1;
    setSession(null);
    if (current) {
      const pushToken = await getStoredExpoPushToken();
      void apiRequest<void>('/v1/auth/logout', {
        method: 'POST',
        token: current.token,
        body: { pushToken },
      }).catch(() => undefined);
    }
    await resetRevenueCatToGuest();
  }, [session]);

  const deleteAccount = useCallback(async () => {
    const current = session;
    if (!current) return;
    await apiRequest<void>('/v1/me', {
      method: 'DELETE',
      token: current.token,
    });
    await clearPersistedSession();
    authRevision.current += 1;
    setSession(null);
    await resetRevenueCatToGuest();
  }, [session]);

  const updateUser = useCallback(
    (user: Member) => {
      setSession((current) => {
        if (!current) return current;
        const next = { ...current, user };
        void writePersistedSession(next);
        return next;
      });
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      openLogin: () => setIsLoginVisible(true),
      logout,
      deleteAccount,
      updateUser,
    }),
    [deleteAccount, isLoading, logout, session, updateUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {isLoading ? (
        <View style={styles.bootRoot}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.bootText}>Hesabınız hazırlanıyor</Text>
        </View>
      ) : children}
      <LoginModal
        visible={isLoginVisible}
        onClose={() => setIsLoginVisible(false)}
        onComplete={completeLogin}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

const LoginModal = ({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: (session: MemberSession) => Promise<void>;
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const requestCode = async () => {
    setBusy(true);
    try {
      await apiRequest('/v1/auth/email/code', {
        method: 'POST',
        body: { email },
      });
      setStep('code');
    } catch {
      Alert.alert('Kod gönderilemedi', 'E-posta adresinizi ve internet bağlantınızı kontrol edin.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    try {
      const next = await apiRequest<MemberSession>('/v1/auth/email/verify', {
        method: 'POST',
        body: {
          email,
          code,
          deviceName: Platform.OS,
        },
      });
      await onComplete(next);
      setCode('');
      setStep('email');
    } catch {
      Alert.alert('Kod doğrulanamadı', 'Kod hatalı veya süresi dolmuş olabilir.');
    } finally {
      setBusy(false);
    }
  };

  const isSubmitDisabled =
    busy || (step === 'email' ? !email.includes('@') : code.length !== 6);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <ScrollView
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.modalHeader}>
          <View style={styles.headerCopy}>
            <View style={styles.accountIcon}>
              <Feather name="user" size={22} color={colors.surface} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.modalTitle}>Bankacı hesabı</Text>
              <Text style={styles.modalSubtitle}>
                {step === 'email'
                  ? 'Şifresiz giriş yapın; tek kullanımlık kod e-postanıza gelsin.'
                  : `${email} adresine gönderilen 6 haneli kodu yazın.`}
              </Text>
              {step === 'code' ? (
                <Text style={styles.deliveryHint}>
                  E-postayı göremiyorsanız spam veya gereksiz klasörünü de
                  kontrol edin.
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            accessibilityLabel="Giriş ekranını kapat"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Feather name="x" size={21} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.loginCard}>
        <Text style={styles.inputLabel}>
          {step === 'email' ? 'E-posta adresiniz' : '6 haneli giriş kodu'}
        </Text>
        {step === 'email' ? (
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            importantForAutofill="yes"
            keyboardType="email-address"
            onBlur={() => setIsInputFocused(false)}
            onFocus={() => setIsInputFocused(true)}
            placeholder="ornek@bankaci.app"
            placeholderTextColor={colors.placeholder}
            spellCheck={false}
            style={[styles.input, isInputFocused && styles.inputFocused]}
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
        ) : (
          <View
            style={[
              styles.input,
              styles.codeInputContainer,
              isInputFocused && styles.inputFocused,
            ]}
          >
            <View pointerEvents="none" style={styles.codeDigits}>
              {Array.from({ length: 6 }, (_, index) => {
                const digit = code[index];
                const isCursorBeforeDigit =
                  isInputFocused && code.length < 6 && code.length === index;
                const isCursorAfterDigit =
                  isInputFocused && code.length === 6 && index === 5;

                return (
                  <View key={index} style={styles.codeDigitSlot}>
                    {isCursorBeforeDigit ? (
                      <View style={styles.codeCursor} />
                    ) : null}
                    <Text
                      style={[
                        styles.codeDigit,
                        !digit && styles.codeDigitPlaceholder,
                      ]}
                    >
                      {digit ?? '0'}
                    </Text>
                    {isCursorAfterDigit ? (
                      <View style={styles.codeCursor} />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <TextInput
              accessibilityLabel="6 haneli giriş kodu"
              autoComplete="one-time-code"
              autoFocus
              caretHidden
              importantForAutofill="yes"
              keyboardType="number-pad"
              maxLength={6}
              onBlur={() => setIsInputFocused(false)}
              onFocus={() => setIsInputFocused(true)}
              selectionColor="transparent"
              style={styles.codeInputCapture}
              textContentType="oneTimeCode"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            />
          </View>
        )}

        <View style={styles.securityNote}>
          <Feather name="shield" size={16} color={colors.success} />
          <Text style={styles.securityNoteText}>
            Tek kullanımlık kod · Şifre oluşturmanız gerekmez
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          disabled={isSubmitDisabled}
          onPress={() => void (step === 'email' ? requestCode() : verifyCode())}
          style={[
            styles.primaryButton,
            isSubmitDisabled && styles.primaryButtonDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {step === 'email' ? 'Kod gönder' : 'Giriş yap'}
              </Text>
              <Feather
                name="arrow-right"
                size={19}
                color={colors.surface}
              />
            </>
          )}
        </TouchableOpacity>

        {step === 'code' ? (
          <TouchableOpacity
            onPress={() => {
              setCode('');
              setStep('email');
            }}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>E-posta adresini değiştir</Text>
          </TouchableOpacity>
        ) : null}
        </View>

        <LinearGradient
          colors={premium.gradient}
          end={premium.gradientEnd}
          start={premium.gradientStart}
          style={styles.premiumCard}
        >
          <View style={styles.premiumBadge}>
            <MaterialCommunityIcons
              name="crown"
              size={16}
              color={premium.onGradient}
            />
            <Text style={styles.premiumBadgeText}>BANKACI PREMIUM</Text>
          </View>
          <Text style={styles.premiumTitle}>
            Bankacı Premium ile daha fazlasını yapın.
          </Text>
          <Text style={styles.premiumDescription}>
            Profesyonel hesaplama araçlarını reklamsız ve kesintisiz kullanın.
          </Text>
          <View style={styles.premiumFeatures}>
            {[
              'Reklamsız ve kesintisiz kullanım',
              'Gelişmiş ödeme planları ve PDF',
              'Konut kredisi devir hesaplama',
            ].map((feature) => (
              <View key={feature} style={styles.premiumFeature}>
                <Feather
                  name="check-circle"
                  size={16}
                  color={premium.onGradient}
                />
                <Text style={styles.premiumFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  bootRoot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  bootText: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: spacing.md,
  },
  modalRoot: { backgroundColor: colors.background, flex: 1 },
  modalContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerCopy: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  accountIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  deliveryHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 36,
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  inputLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  codeInputContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  codeInputCapture: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
  },
  codeDigits: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  codeDigitSlot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 35,
    position: 'relative',
  },
  codeCursor: {
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 32,
    marginRight: 2,
    width: 2,
  },
  codeDigit: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  codeDigitPlaceholder: { color: colors.placeholder },
  securityNote: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  securityNoteText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 54,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '800',
  },
  textButton: {
    alignItems: 'center',
    minHeight: 44,
    paddingTop: spacing.lg,
  },
  textButtonLabel: { color: colors.primary, fontWeight: '700' },
  premiumCard: {
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
    ...shadows.card,
  },
  premiumBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  premiumBadgeText: {
    color: premium.onGradient,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  premiumTitle: {
    color: premium.onGradient,
    fontSize: 21,
    fontWeight: '900',
    marginTop: spacing.lg,
  },
  premiumDescription: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  premiumFeatures: { gap: spacing.sm, marginTop: spacing.lg },
  premiumFeature: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  premiumFeatureText: {
    color: premium.onGradient,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
  },
});
