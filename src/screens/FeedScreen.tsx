import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { APIError, apiRequest } from '../api/client';
import type { FeedAuthor, FeedComment, FeedPost } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import {
  colors,
  premium,
  radius,
  shadows,
  spacing,
  typography,
} from '../design/tokens';
import { usePremium } from '../subscription/PremiumProvider';
import { usePaywall } from '../subscription/PaywallProvider';
import { canCreateFeedPost } from '../subscription/premiumFeatures';

const AuthorAvatar = ({ author, size = 42 }: { author: FeedAuthor; size?: number }) =>
  author.avatarUrl ? (
    <Image source={{ uri: author.avatarUrl }} style={{ borderRadius: size / 2, height: size, width: size }} />
  ) : (
    <View style={[styles.avatar, { borderRadius: size / 2, height: size, width: size }]}>
      <Text style={styles.avatarText}>{(author.displayName || 'B').slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
    </View>
  );

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

const FeedScreen = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const { session, user, openLogin } = useAuth();
  const { isPremium } = usePremium();
  const { openPaywall } = usePaywall();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);

  const load = useCallback(async () => {
    const startedAt = Date.now();
    setFetching(true);
    try {
      const result = await apiRequest<{ items: FeedPost[] }>('/v1/feed/posts?limit=30', { token: session?.token });
      setPosts(result.items);
    } catch {
      // Keep the last successful feed visible during a temporary outage.
    } finally {
      const remainingIndicatorTime = 700 - (Date.now() - startedAt);
      if (remainingIndicatorTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingIndicatorTime));
      }
      setLoading(false);
      setRefreshing(false);
      setFetching(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!user) return;
    setPosts((current) =>
      current.map((post) =>
        post.author.id === user.id
          ? {
              ...post,
              author: {
                id: user.id,
                displayName: user.displayName,
                bankName: user.bankName,
                jobTitle: user.jobTitle,
                avatarUrl: user.avatarUrl,
              },
            }
          : post
      )
    );
  }, [user]);

  const requireMember = (action: () => void) => {
    if (!session) { openLogin(); return; }
    action();
  };

  const openComposer = () => {
    if (!session) {
      openLogin();
      return;
    }
    if (!canCreateFeedPost(isPremium)) {
      openPaywall();
      return;
    }
    setComposerVisible(true);
  };

  const toggleLike = async (post: FeedPost) => {
    if (!session) { openLogin(); return; }
    const liked = !post.likedByMe;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likedByMe: liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) } : item));
    try { await apiRequest(`/v1/feed/posts/${post.id}/like`, { method: liked ? 'PUT' : 'DELETE', token: session.token }); }
    catch { void load(); }
  };

  const deletePost = async (post: FeedPost) => {
    if (!session) return;

    try {
      await apiRequest(`/v1/feed/posts/${post.id}`, {
        method: 'DELETE',
        token: session.token,
      });
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch {
      Alert.alert('Silinemedi', 'Gönderi silinirken bir sorun oluştu. Lütfen tekrar deneyin.');
    }
  };

  const confirmDeletePost = (post: FeedPost) => {
    Alert.alert(
      'Gönderi silinsin mi?',
      'Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: () => void deletePost(post) },
      ]
    );
  };

  const showPostActions = (post: FeedPost) => {
    if (post.author.id === user?.id) {
      Alert.alert(
        'Gönderi seçenekleri',
        undefined,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Gönderiyi sil',
            style: 'destructive',
            onPress: () => confirmDeletePost(post),
          },
        ]
      );
      return;
    }

    requireMember(() =>
      Alert.alert(post.author.displayName || 'Bankacı', undefined, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Gönderiyi bildir',
          onPress: () =>
            session &&
            apiRequest(`/v1/feed/posts/${post.id}/report`, {
              method: 'POST',
              token: session.token,
              body: { reason: 'Uygunsuz içerik' },
            })
              .then(() => Alert.alert('Teşekkürler', 'Bildiriminizi aldık.'))
              .catch(() => undefined),
        },
        {
          text: 'Kullanıcıyı engelle',
          style: 'destructive',
          onPress: () =>
            session &&
            apiRequest(`/v1/users/${post.author.id}/block`, {
              method: 'PUT',
              token: session.token,
            })
              .then(() =>
                setPosts((current) =>
                  current.filter((item) => item.author.id !== post.author.id)
                )
              )
              .catch(() => undefined),
        },
      ])
    );
  };

  const prependPost = (post: FeedPost) => { setPosts((current) => [post, ...current]); setComposerVisible(false); };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListHeaderComponent={<View style={styles.stickyHeader}><View style={styles.header}><View><Text style={styles.eyebrow}>Bankacı topluluğu</Text><View style={styles.pageTitleRow}><Text style={styles.pageTitle}>Öğle Arası</Text></View></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Premium paylaşım oluştur" onPress={openComposer}><LinearGradient colors={[...premium.gradient]} start={premium.gradientStart} end={premium.gradientEnd} style={styles.composeButton}><MaterialCommunityIcons name="crown" color={premium.onGradient} size={16} /><Feather name="edit-3" color={premium.onGradient} size={18} /><Text style={styles.composeText}>Paylaş</Text></LinearGradient></TouchableOpacity></View>{fetching ? <View accessibilityLabel="Paylaşımlar yenileniyor" style={styles.fetchingBanner}><ActivityIndicator color={colors.primary} size="small" /><Text style={styles.fetchingText}>Paylaşımlar yenileniyor…</Text></View> : null}</View>}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} style={styles.empty} /> : <View style={styles.empty}><Feather name="users" size={34} color={colors.textMuted} /><Text style={styles.emptyTitle}>İlk paylaşımı sen yap</Text><Text style={styles.emptyText}>Bankacılık deneyimlerini, sorularını ve fikirlerini toplulukla paylaş.</Text></View>}
        renderItem={({ item }) => <View style={styles.postCard}><View style={styles.authorRow}><AuthorAvatar author={item.author} /><View style={styles.authorText}><Text style={styles.authorName}>{item.author.displayName || 'Bankacı'}</Text><Text style={styles.authorMeta}>{[item.author.bankName, item.author.jobTitle].filter(Boolean).join(' · ') || 'Topluluk üyesi'}</Text><Text style={styles.date}>{formatDate(item.createdAt)}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Gönderi seçenekleri" hitSlop={12} onPress={() => showPostActions(item)}><Feather name="more-horizontal" color={colors.textMuted} size={20} /></TouchableOpacity></View><Text style={styles.body}>{item.body}</Text>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} resizeMode="cover" style={styles.postImage} /> : null}<View style={styles.actions}><TouchableOpacity onPress={() => void toggleLike(item)} style={styles.action}><Feather name="heart" color={item.likedByMe ? colors.danger : colors.textMuted} size={19} /><Text style={[styles.actionText, item.likedByMe && { color: colors.danger }]}>{item.likeCount}</Text></TouchableOpacity><TouchableOpacity onPress={() => setCommentsPost(item)} style={styles.action}><Feather name="message-circle" color={colors.textMuted} size={19} /><Text style={styles.actionText}>{item.commentCount}</Text></TouchableOpacity></View></View>}
      />
      <ComposerModal visible={composerVisible} token={session?.token ?? null} onClose={() => setComposerVisible(false)} onCreated={prependPost} />
      <CommentsModal post={commentsPost} token={session?.token ?? null} onLogin={openLogin} onClose={() => setCommentsPost(null)} onCommentAdded={() => setPosts((current) => current.map((post) => post.id === commentsPost?.id ? { ...post, commentCount: post.commentCount + 1 } : post))} />
    </SafeAreaView>
  );
};

const ComposerModal = ({ visible, token, onClose, onCreated }: { visible: boolean; token: string | null; onClose: () => void; onCreated: (post: FeedPost) => void }) => {
  const [body, setBody] = useState(''); const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null); const [busy, setBusy] = useState(false);
  const pickImage = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!result.canceled) setAsset(result.assets[0]); };
  const submit = async () => { if (!token || !body.trim()) return; setBusy(true); try { let imageUrl: string | undefined; if (asset) { const data = new FormData(); data.append('image', { uri: asset.uri, name: asset.fileName ?? 'feed.jpg', type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob); imageUrl = (await apiRequest<{ url: string }>('/v1/media/feed', { method: 'POST', token, formData: data })).url; } const post = await apiRequest<FeedPost>('/v1/feed/posts', { method: 'POST', token, body: { body, imageUrl } }); setBody(''); setAsset(null); onCreated(post); } catch (error) { if (error instanceof APIError && error.code === 'premium_required') { Alert.alert('Premium durumu eşitlenemedi', 'Premium erişiminiz uygulamada açık ancak hesabınıza henüz yansımamış. Kısa süre sonra tekrar deneyin veya Ayarlar’dan Premium erişimini kontrol edin.'); } else if (error instanceof APIError && error.status === 401) { Alert.alert('Oturum süresi doldu', 'Paylaşmak için hesabınıza yeniden giriş yapın.'); } else if (error instanceof APIError && error.code === 'invalid_post') { Alert.alert('Paylaşılamadı', 'Paylaşım metnini kontrol edip tekrar deneyin.'); } else { Alert.alert('Paylaşılamadı', 'Bağlantınızı kontrol edip tekrar deneyin.'); } } finally { setBusy(false); } };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Yeni paylaşım</Text><TouchableOpacity onPress={onClose}><Text style={styles.close}>Kapat</Text></TouchableOpacity></View><TextInput autoFocus multiline maxLength={2000} placeholder="Bankacılık dünyasında ne düşünüyorsun?" placeholderTextColor={colors.placeholder} style={styles.composerInput} value={body} onChangeText={setBody} />{asset ? <Image source={{ uri: asset.uri }} style={styles.preview} /> : null}<View style={styles.composerFooter}><TouchableOpacity onPress={() => void pickImage()} style={styles.photoButton}><Feather name="image" size={20} color={colors.primary} /><Text style={styles.photoText}>Fotoğraf</Text></TouchableOpacity><TouchableOpacity disabled={busy || !body.trim()} onPress={() => void submit()} style={styles.publishButton}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.publishText}>Paylaş</Text>}</TouchableOpacity></View></KeyboardAvoidingView></Modal>;
};

const CommentsModal = ({ post, token, onLogin, onClose, onCommentAdded }: { post: FeedPost | null; token: string | null; onLogin: () => void; onClose: () => void; onCommentAdded: () => void }) => {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<FeedComment[]>([]); const [body, setBody] = useState('');
  useEffect(() => { if (post) void apiRequest<{ items: FeedComment[] }>(`/v1/feed/posts/${post.id}/comments`).then((response) => setComments(response.items)).catch(() => setComments([])); }, [post]);
  const send = async () => { if (!token) { onLogin(); return; } if (!post || !body.trim()) return; try { const comment = await apiRequest<FeedComment>(`/v1/feed/posts/${post.id}/comments`, { method: 'POST', token, body: { body } }); setComments((current) => [...current, comment]); setBody(''); onCommentAdded(); } catch { Alert.alert('Yorum gönderilemedi'); } };
  return (
    <Modal visible={post !== null} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.commentsKeyboardArea}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.commentsRoot}>
          <View style={styles.commentsHeader}><Text style={styles.modalTitle}>Yorumlar</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Yorumları kapat" hitSlop={10} onPress={onClose}><Text style={styles.close}>Kapat</Text></TouchableOpacity></View>
          <FlatList data={comments} keyExtractor={(item) => item.id} contentContainerStyle={styles.commentsList} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" style={styles.commentsListView} ListEmptyComponent={<View style={styles.commentsEmpty}><Feather name="message-circle" size={30} color={colors.textMuted} /><Text style={styles.emptyText}>Henüz yorum yok.</Text></View>} renderItem={({ item }) => <View style={styles.comment}><AuthorAvatar author={item.author} size={36} /><View style={styles.commentBubble}><Text style={styles.commentAuthor}>{item.author.displayName || 'Bankacı'}</Text><Text style={styles.commentBody}>{item.body}</Text></View></View>} />
          <View style={[styles.commentComposerArea, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.commentComposer}>
              <TextInput placeholder={token ? 'Yorum yaz…' : 'Yorum için giriş yapın'} placeholderTextColor={colors.placeholder} returnKeyType="send" style={styles.commentInput} value={body} onChangeText={setBody} onFocus={() => { if (!token) onLogin(); }} onSubmitEditing={() => void send()} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Yorumu gönder" disabled={!body.trim()} hitSlop={8} onPress={() => void send()} style={[styles.commentSend, body.trim() ? styles.commentSendActive : styles.commentSendDisabled]}><Feather name="send" size={19} color={colors.surface} /></TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 }, content: { paddingHorizontal: spacing.lg }, stickyHeader: { backgroundColor: colors.background, marginHorizontal: -spacing.lg, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, zIndex: 2 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, eyebrow: { color: colors.primary, fontSize: typography.small, fontWeight: '800', textTransform: 'uppercase' }, pageTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, pageTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800' }, composeButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, minHeight: 42, paddingHorizontal: spacing.md }, composeText: { color: colors.surface, fontWeight: '800' }, postCard: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.md, padding: spacing.lg, ...shadows.card }, authorRow: { alignItems: 'center', flexDirection: 'row' }, avatar: { alignItems: 'center', backgroundColor: colors.primary, justifyContent: 'center' }, avatarText: { color: colors.surface, fontWeight: '800' }, authorText: { flex: 1, marginLeft: spacing.md }, authorName: { color: colors.text, fontSize: typography.body, fontWeight: '800' }, authorMeta: { color: colors.textMuted, fontSize: typography.small, marginTop: 1 }, date: { color: colors.placeholder, fontSize: 11, marginTop: 2 }, body: { color: colors.text, fontSize: typography.body, lineHeight: 22, marginTop: spacing.md }, postImage: { aspectRatio: 1.5, borderRadius: radius.md, marginTop: spacing.md, width: '100%' }, actions: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md }, action: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 34, paddingRight: spacing.xl }, actionText: { color: colors.textMuted, fontWeight: '700' }, reportAction: { marginLeft: 'auto', paddingRight: 0 }, empty: { alignItems: 'center', padding: spacing.xxl }, emptyTitle: { color: colors.text, fontSize: typography.sectionTitle, fontWeight: '800', marginTop: spacing.md }, emptyText: { color: colors.textMuted, lineHeight: 21, marginTop: spacing.sm, textAlign: 'center' }, modal: { backgroundColor: colors.background, flex: 1, padding: spacing.xl }, modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.lg }, modalTitle: { color: colors.text, fontSize: 24, fontWeight: '800' }, close: { color: colors.primary, fontWeight: '700', padding: spacing.sm }, composerInput: { backgroundColor: colors.surface, borderRadius: radius.lg, color: colors.text, fontSize: 17, minHeight: 180, padding: spacing.lg, textAlignVertical: 'top' }, preview: { aspectRatio: 1.8, borderRadius: radius.md, marginTop: spacing.md, width: '100%' }, composerFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }, photoButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 }, photoText: { color: colors.primary, fontWeight: '700' }, publishButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, justifyContent: 'center', minHeight: 46, minWidth: 110 }, publishText: { color: colors.surface, fontWeight: '800' }, commentsKeyboardArea: { backgroundColor: colors.background, flex: 1 }, commentsRoot: { backgroundColor: colors.background, flex: 1, paddingHorizontal: spacing.lg }, commentsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.md, paddingTop: spacing.md }, commentsListView: { flex: 1 }, commentsList: { paddingBottom: spacing.lg, paddingTop: spacing.sm }, commentsEmpty: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl }, comment: { alignItems: 'flex-start', flexDirection: 'row', marginBottom: spacing.md }, commentBubble: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, flex: 1, marginLeft: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, commentAuthor: { color: colors.text, fontWeight: '800' }, commentBody: { color: colors.text, lineHeight: 20, marginTop: spacing.xs }, commentComposerArea: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexShrink: 0, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md }, commentComposer: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, height: 52, paddingLeft: spacing.md, paddingRight: 6 }, commentInput: { color: colors.text, flex: 1, fontSize: typography.body, height: 50, paddingVertical: 0 }, commentSend: { alignItems: 'center', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 }, commentSendActive: { backgroundColor: colors.primary }, commentSendDisabled: { backgroundColor: colors.primary, opacity: 0.35 },
  fetchingBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  fetchingText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
});

export default FeedScreen;
