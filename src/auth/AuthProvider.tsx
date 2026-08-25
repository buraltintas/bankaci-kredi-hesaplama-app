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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { APIError, apiRequest } from '../api/client';
import type { Member, MemberSession } from '../api/types';
import { colors, radius, spacing, typography } from '../design/tokens';
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
  updateUser: (user: Member) => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
  openLogin: () => undefined,
  logout: async () => undefined,
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
    setIsLoginVisible(false);
    void identifyRevenueCatUser(next.user.revenueCatUserId, next.user.email);
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
      updateUser,
    }),
    [isLoading, logout, session, updateUser]
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Bankacı hesabı</Text>
            <Text style={styles.modalSubtitle}>
              {step === 'email'
                ? 'Şifre yok; e-postanıza tek kullanımlık kod gelir.'
                : `${email} adresine gelen 6 haneli kodu yazın.`}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={onClose}>
            <Text style={styles.closeText}>Kapat</Text>
          </TouchableOpacity>
        </View>

        {step === 'email' ? (
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            importantForAutofill="yes"
            keyboardType="email-address"
            placeholder="E-posta adresi"
            placeholderTextColor={colors.placeholder}
            spellCheck={false}
            style={styles.input}
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
        ) : (
          <TextInput
            autoComplete="one-time-code"
            autoFocus
            importantForAutofill="yes"
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, styles.codeInput]}
            textContentType="oneTimeCode"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
          />
        )}

        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy || (step === 'email' ? !email.includes('@') : code.length !== 6)}
          onPress={() => void (step === 'email' ? requestCode() : verifyCode())}
          style={styles.primaryButton}
        >
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === 'email' ? 'Kod gönder' : 'Giriş yap'}
            </Text>
          )}
        </TouchableOpacity>

        {step === 'code' ? (
          <TouchableOpacity onPress={() => setStep('email')} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>E-posta adresini değiştir</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  bootRoot: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  bootText: { color: colors.textMuted, fontSize: typography.body, marginTop: spacing.md },
  modalRoot: { backgroundColor: colors.background, flex: 1, padding: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxl },
  modalTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  modalSubtitle: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22, marginTop: spacing.sm, maxWidth: 300 },
  closeText: { color: colors.primary, fontSize: typography.body, fontWeight: '700', paddingVertical: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, color: colors.text, fontSize: 17, minHeight: 56, paddingHorizontal: spacing.lg },
  codeInput: { fontSize: 28, fontWeight: '800', letterSpacing: 10, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', marginTop: spacing.lg, minHeight: 54 },
  primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '800' },
  textButton: { alignItems: 'center', minHeight: 48, padding: spacing.md },
  textButtonLabel: { color: colors.primary, fontWeight: '700' },
});
