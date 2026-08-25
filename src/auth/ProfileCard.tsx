import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '../api/client';
import type { Member } from '../api/types';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAuth } from './AuthProvider';

const Avatar = ({ user, size = 52 }: { user: Member; size?: number }) => {
  if (user.avatarUrl) {
    return <Image source={{ uri: user.avatarUrl }} style={{ borderRadius: size / 2, height: size, width: size }} />;
  }
  const initial = (user.displayName || user.email).slice(0, 1).toLocaleUpperCase('tr-TR');
  return (
    <View style={[styles.avatarFallback, { borderRadius: size / 2, height: size, width: size }]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
};

export const ProfileCard = () => {
  const { user, session, openLogin, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '', bankName: '', jobTitle: '' });

  const openEditor = () => {
    if (!user) return;
    setForm({ displayName: user.displayName, bio: user.bio, bankName: user.bankName, jobTitle: user.jobTitle });
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!session) return;
    if (!form.displayName.trim()) {
      Alert.alert('İsim gerekli', 'Profilinizde görünecek isminizi yazın.');
      return;
    }
    setBusy(true);
    try {
      const updated = await apiRequest<Member>('/v1/me', { method: 'PATCH', token: session.token, body: form });
      updateUser(updated);
      setEditing(false);
    } catch {
      Alert.alert('Profil kaydedilemedi', 'Bağlantınızı kontrol edip tekrar deneyin.');
    } finally { setBusy(false); }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Çıkış yapılsın mı?',
      'Hesaplama araçlarını misafir olarak kullanmaya devam edebilirsiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış yap',
          style: 'destructive',
          onPress: () => {
            setLogoutBusy(true);
            void logout()
              .catch(() => {
                Alert.alert(
                  'Çıkış tamamlanamadı',
                  'Güvenli oturum bilgisi silinemedi. Lütfen tekrar deneyin.'
                );
              })
              .finally(() => setLogoutBusy(false));
          },
        },
      ]
    );
  };

  const chooseAvatar = async () => {
    if (!session || !user) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('image', { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
    setBusy(true);
    try {
      const response = await apiRequest<{ avatarUrl: string }>('/v1/me/avatar', { method: 'POST', token: session.token, formData });
      updateUser({ ...user, avatarUrl: response.avatarUrl });
    } catch {
      Alert.alert('Fotoğraf yüklenemedi', 'JPG, PNG veya WebP bir fotoğraf seçip tekrar deneyin.');
    } finally { setBusy(false); }
  };

  if (!user) {
    return (
      <View>
        <Text style={styles.title}>Bankacı hesabı</Text>
        <Text style={styles.paragraph}>Profilinizi oluşturun, bankacılarla paylaşım yapın ve Premium üyeliğinizi tüm cihazlarınızda kullanın.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={openLogin}>
          <Text style={styles.primaryButtonText}>E-posta ile giriş yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.profileRow}>
        <Avatar user={user} />
        <View style={styles.profileText}>
          <Text style={styles.name}>{user.displayName || 'İsmini ekle'}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.jobTitle || user.bankName ? <Text style={styles.meta}>{[user.bankName, user.jobTitle].filter(Boolean).join(' · ')}</Text> : null}
        </View>
      </View>
      <TouchableOpacity style={styles.outlineButton} onPress={openEditor}><Feather name="edit-2" size={16} color={colors.primary} /><Text style={styles.outlineText}>Profili düzenle</Text></TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Bankacı hesabından çık"
        disabled={logoutBusy}
        onPress={confirmLogout}
        style={styles.logoutButton}
      >
        {logoutBusy ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <Text style={styles.logoutText}>Hesaptan çık</Text>
        )}
      </TouchableOpacity>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editor}>
          <View style={styles.editorHeader}><Text style={styles.editorTitle}>Profili düzenle</Text><TouchableOpacity onPress={() => setEditing(false)}><Text style={styles.close}>Kapat</Text></TouchableOpacity></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TouchableOpacity disabled={busy} onPress={() => void chooseAvatar()} style={styles.avatarEditor}><Avatar user={user} size={76} /><Text style={styles.changePhoto}>Fotoğrafı değiştir</Text></TouchableOpacity>
            {([['displayName', 'Ad soyad *'], ['bankName', 'Banka / kurum (isteğe bağlı)'], ['jobTitle', 'Görev / unvan (isteğe bağlı)'], ['bio', 'Hakkında (isteğe bağlı)']] as const).map(([key, label]) => <TextInput key={key} autoCapitalize="words" placeholder={label} placeholderTextColor={colors.placeholder} multiline={key === 'bio'} maxLength={key === 'bio' ? 400 : key === 'displayName' ? 80 : 100} style={[styles.input, key === 'bio' && styles.bioInput]} value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} />)}
            <TouchableOpacity disabled={busy} onPress={() => void saveProfile()} style={styles.primaryButton}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Kaydet</Text>}</TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.sectionTitle, fontWeight: '700', marginBottom: spacing.md }, paragraph: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22, marginBottom: spacing.md }, primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.lg }, primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '800' }, profileRow: { alignItems: 'center', flexDirection: 'row' }, avatarFallback: { alignItems: 'center', backgroundColor: colors.primary, justifyContent: 'center' }, avatarInitial: { color: colors.surface, fontSize: 22, fontWeight: '800' }, profileText: { flex: 1, marginLeft: spacing.md }, name: { color: colors.text, fontSize: 17, fontWeight: '800' }, email: { color: colors.textMuted, fontSize: typography.small, marginTop: 2 }, meta: { color: colors.primary, fontSize: typography.small, fontWeight: '600', marginTop: spacing.xs }, outlineButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg, minHeight: 46 }, outlineText: { color: colors.primary, fontWeight: '700' }, logoutButton: { alignItems: 'center', minHeight: 44, paddingTop: spacing.md }, logoutText: { color: colors.danger, fontWeight: '700' }, editor: { backgroundColor: colors.background, flex: 1, padding: spacing.xl }, editorHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl }, editorTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800' }, close: { color: colors.primary, fontWeight: '700' }, avatarEditor: { alignItems: 'center', marginBottom: spacing.xl }, changePhoto: { color: colors.primary, fontWeight: '700', marginTop: spacing.sm }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: typography.body, marginBottom: spacing.md, minHeight: 50, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, bioInput: { minHeight: 100, textAlignVertical: 'top' },
});
