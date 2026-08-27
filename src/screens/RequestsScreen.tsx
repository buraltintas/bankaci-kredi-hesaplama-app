import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRequest } from '../api/client';
import { apiBaseURL } from '../api/config';
import type { BankerNote, LoanRequest, LoanRequestLink } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { usePremium } from '../subscription/PremiumProvider';
import { usePaywall } from '../subscription/PaywallProvider';
import { colors, premium, radius, shadows, spacing, typography } from '../design/tokens';
import SlidingTabs from '../components/SlidingTabs';

const WEB_URL = 'https://bankaci.app';
const LOAN_LABELS: Record<LoanRequest['loanType'], string> = { consumer: 'İhtiyaç Kredisi', vehicle: 'Taşıt Kredisi', housing: 'Konut Kredisi', commercial: 'Ticari Kredi' };
const PROMPTS = ['Konut kredisi ihtiyaçlarınız için iletişime geçebilirsiniz.', 'Kredi seçeneklerini birlikte değerlendirelim.', 'İşletmenize uygun finansman çözümleri için ulaşabilirsiniz.'];
const PALETTES = [
  { id: 'blue-violet', label: 'Mavi', from: '#1669E8', to: '#7450F7' },
  { id: 'ocean', label: 'Okyanus', from: '#063B63', to: '#0B8B8B' },
  { id: 'plum', label: 'Mürdüm', from: '#42275A', to: '#8E4B78' },
  { id: 'night', label: 'Gece', from: '#0F172A', to: '#334155' },
  { id: 'warm', label: 'Sıcak', from: '#C2410C', to: '#F59E0B' },
] as const;
const VISUAL_PRESETS = [
  { id: 'bold', label: 'Güçlü' },
  { id: 'framed', label: 'Çerçeveli' },
  { id: 'minimal', label: 'Sade' },
] as const;
type VisualPreset = typeof VISUAL_PRESETS[number]['id'];
type VisualPalette = typeof PALETTES[number];
type RequestSection = 'requests' | 'notes' | 'visual';
const REQUEST_TABS = [
  { key: 'requests', label: 'Talepler' },
  { key: 'notes', label: 'Notlar' },
  { key: 'visual', label: 'Görsel' },
] as const;

export default function RequestsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { session, user, openLogin } = useAuth();
  const { isPremium } = usePremium();
  const { openPaywall } = usePaywall();
  const [section, setSection] = useState<RequestSection>('requests');
  const [link, setLink] = useState<LoanRequestLink | null>(null);
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [notes, setNotes] = useState<BankerNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [palette, setPalette] = useState<VisualPalette>(PALETTES[0]);
  const [visualPreset, setVisualPreset] = useState<VisualPreset>('bold');
  const [visualName, setVisualName] = useState('');
  const [visualPhone, setVisualPhone] = useState('');
  const [showVisualName, setShowVisualName] = useState(true);
  const [showVisualPhone, setShowVisualPhone] = useState(true);
  const visualRef = useRef<ViewShot>(null);
  const currentUserID = user?.id;
  const currentDisplayName = user?.displayName;
  const currentEmail = user?.email;

  useEffect(() => {
    if (!currentUserID || !currentEmail) return;
    setVisualName(currentDisplayName || currentEmail.split('@')[0]);
  }, [currentDisplayName, currentEmail, currentUserID]);

  const load = useCallback(async () => {
    if (!session || !isPremium) return;
    setLoading(true);
    try {
      const [linkData, requestData, noteData] = await Promise.all([
        apiRequest<{items: LoanRequestLink[]}>('/v1/me/request-links', { token: session.token }),
        apiRequest<{items: LoanRequest[]}>('/v1/me/loan-requests', { token: session.token }),
        apiRequest<{items: BankerNote[]}>('/v1/me/notes', { token: session.token }),
      ]);
      setLink(linkData.items[0] ?? null);
      setRequests(requestData.items);
      setNotes(noteData.items);
      if (linkData.items[0]) {
        setPhone(linkData.items[0].bankerPhone);
        setVisualPhone((current) => current || linkData.items[0].bankerPhone);
        setShowEmail(linkData.items[0].showEmail);
      }
    } catch { Alert.alert('Yüklenemedi', 'Talep alanı şu anda yenilenemedi.'); }
    finally { setLoading(false); }
  }, [isPremium, session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session || !user) return <Gate title="Talepler" text="Talep linkinizi ve müşterilerinizden gelen başvuruları yönetmek için giriş yapın." button="E-posta ile giriş yap" onPress={openLogin} />;
  if (!isPremium) return <Gate title="Talepler" text="Talep linki, gelen talepler, paylaşılabilir görseller ve kişisel notlar Bankacı Premium’a dahildir." button="Premium seçeneklerini gör" onPress={openPaywall} premiumGate />;

  const createLink = async () => {
    if (phone.replace(/\D/g, '').length < 10) { Alert.alert('Telefon gerekli', 'Müşterinizin göreceği telefon numaranızı yazın.'); return; }
    try {
      const item = await apiRequest<LoanRequestLink>('/v1/me/request-links', { method: 'POST', token: session.token, body: { label: 'Kredi Talep Formu', bankerPhone: phone, showEmail, defaultLoanType: null } });
      setLink(item);
      setVisualPhone((current) => current || phone);
    } catch { Alert.alert('Oluşturulamadı', 'Bilgileri kontrol edip tekrar deneyin.'); }
  };
  const toggleLink = async (active: boolean) => {
    if (!link) return;
    try { await apiRequest(`/v1/me/request-links/${link.id}`, { method:'PATCH', token:session.token, body:{isActive:active} }); setLink({...link,isActive:active}); }
    catch { Alert.alert('Güncellenemedi', 'Link durumu değiştirilemedi.'); }
  };
  const requestURL = link ? `${WEB_URL}/r/${encodeURIComponent(link.requestId)}` : '';
  const shareLink = async () => { if (!link) return; await Share.share({message:`Kredi talebinizi güvenle bu bağlantı üzerinden iletebilirsiniz:\n${requestURL}`,url:requestURL}); };
  const copyLink = async () => { if (!link) return; await Clipboard.setStringAsync(requestURL); Alert.alert('Link kopyalandı', 'Talep bağlantısını istediğiniz yerde paylaşabilirsiniz.'); };
  const updateStatus = async (item:LoanRequest,status:LoanRequest['status']) => { await apiRequest(`/v1/me/loan-requests/${item.id}`,{method:'PATCH',token:session.token,body:{status}}); setRequests(v=>v.map(x=>x.id===item.id?{...x,status}:x)); };
  const saveNote = async () => {
    const body=noteBody.trim(); if(!body)return;
    try { const saved=await apiRequest<BankerNote>(editingNote?`/v1/me/notes/${editingNote}`:'/v1/me/notes',{method:editingNote?'PATCH':'POST',token:session.token,body:{body}}); setNotes(v=>[saved,...v.filter(x=>x.id!==saved.id)]); setNoteBody(''); setEditingNote(null); }
    catch { Alert.alert('Kaydedilemedi','Notunuz kaydedilemedi.'); }
  };
  const deleteNote = (item:BankerNote) => Alert.alert('Not silinsin mi?', 'Bu işlem geri alınamaz.', [{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{await apiRequest(`/v1/me/notes/${item.id}`,{method:'DELETE',token:session.token});setNotes(v=>v.filter(x=>x.id!==item.id));}}]);
  const shareVisual = async () => { if (!prompt.trim()) { Alert.alert('Metin gerekli', 'Görselde yer alacak metni yazın.'); return; } try { const uri=await visualRef.current?.capture?.(); if(uri && await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri,{mimeType:'image/png',dialogTitle:'Görseli paylaş'}); } catch { Alert.alert('Paylaşılamadı','Görsel hazırlanamadı.'); } };
  const openDocument = async (objectName:string,index:number) => { try { const extension=objectName.split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'bin'; const target=`${FileSystem.cacheDirectory}talep-belgesi-${index+1}.${extension}`; const result=await FileSystem.downloadAsync(`${apiBaseURL}/v1/me/loan-request-documents?object=${encodeURIComponent(objectName)}`,target,{headers:{Authorization:`Bearer ${session.token}`}}); if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri,{dialogTitle:'Talep belgesini aç'}); } catch { Alert.alert('Belge açılamadı','Belge indirilemedi. Lütfen tekrar deneyin.'); } };

  return <SafeAreaView style={styles.root} edges={['top','left','right']}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>BANKACI PREMIUM</Text><Text style={styles.title}>Talepler</Text></View><MaterialCommunityIcons name="crown" size={24} color={premium.accent}/></View>
      <SlidingTabs<RequestSection> value={section} onChange={setSection} options={REQUEST_TABS}/>
      {loading?<View style={styles.loading}><ActivityIndicator color={premium.accent}/><Text style={styles.muted}>Güncelleniyor…</Text></View>:<View style={[styles.content,{paddingBottom:tabBarHeight+spacing.xl}]}>
      {section==='requests'&&<>
        {!link?<View style={styles.card}><Text style={styles.cardTitle}>Talep linkinizi oluşturun</Text><Text style={styles.muted}>Tek ve kalıcı bağlantınız siz kapatana kadar çalışır. Formda profil adınız ve telefonunuz görünür; e-posta isteğe bağlıdır.</Text><Text style={styles.label}>Telefon</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05xx xxx xx xx" placeholderTextColor={colors.placeholder}/><View style={styles.row}><View style={styles.flex}><Text style={styles.label}>E-postamı göster</Text><Text style={styles.hint}>{user.email}</Text></View><Switch value={showEmail} onValueChange={setShowEmail}/></View><TouchableOpacity style={styles.primary} onPress={()=>void createLink()}><Text style={styles.primaryText}>Talep linkini oluştur</Text></TouchableOpacity></View>:
        <View style={styles.card}><View style={styles.row}><View style={styles.flex}><Text style={styles.cardTitle}>Talep bağlantınız</Text><Text style={styles.muted}>{link.viewCount} açılma · {link.submissionCount} talep</Text></View><Switch value={link.isActive} onValueChange={v=>void toggleLink(v)}/></View><Text style={styles.hint}>{link.isActive?'Aktif ve süresiz':'Pasif — müşteriler formu açamaz'}</Text><View style={styles.actions}><TouchableOpacity disabled={!link.isActive} style={[styles.small,!link.isActive&&styles.disabled]} onPress={()=>void copyLink()}><Feather name="copy" size={18} color={colors.primary}/><Text style={styles.secondaryText}>Kopyala</Text></TouchableOpacity><TouchableOpacity disabled={!link.isActive} style={[styles.small,!link.isActive&&styles.disabled]} onPress={()=>void shareLink()}><Feather name="share-2" size={18} color={colors.primary}/><Text style={styles.secondaryText}>Paylaş</Text></TouchableOpacity></View></View>}
        <Text style={styles.sectionTitle}>Gelen talepler</Text>
        {requests.map(item=><View key={item.id} style={styles.card}><TouchableOpacity style={styles.row} onPress={()=>setExpanded(expanded===item.id?null:item.id)}><View style={styles.flex}><Text style={styles.cardTitle}>{item.fullName}</Text><Text style={styles.muted}>{LOAN_LABELS[item.loanType]} · {Number(item.amount).toLocaleString('tr-TR')} TL · {item.termMonths} ay</Text></View><Feather name={expanded===item.id?'chevron-up':'chevron-down'} size={22} color={colors.primary}/></TouchableOpacity>{expanded===item.id&&<View style={styles.detail}><View style={styles.actions}><TouchableOpacity style={styles.small} onPress={()=>void Linking.openURL(`tel:${item.phone}`)}><Feather name="phone" size={17} color={colors.primary}/><Text style={styles.secondaryText}>Ara</Text></TouchableOpacity><TouchableOpacity style={styles.small} onPress={()=>void Linking.openURL(`https://wa.me/${item.phone.replace(/\D/g,'')}`)}><MaterialCommunityIcons name="whatsapp" size={18} color="#158B46"/><Text style={styles.secondaryText}>WhatsApp</Text></TouchableOpacity></View><Text style={styles.hint}>{item.phone}{item.email?` · ${item.email}`:''}</Text>{item.notes?<View style={styles.noteBox}><Text style={styles.label}>Müşteri notu</Text><Text style={styles.noteText}>{item.notes}</Text></View>:null}{item.documentUrls.length?<View style={styles.noteBox}><Text style={styles.label}>Belgeler</Text>{item.documentUrls.map((document,i)=><Text key={document} onPress={()=>void openDocument(document,i)} style={styles.linkText}>Belge {i+1} · Güvenli aç</Text>)}</View>:null}<View style={styles.actions}><TouchableOpacity style={styles.status} onPress={()=>void updateStatus(item,'contacted')}><Text style={styles.statusText}>Görüşüldü</Text></TouchableOpacity><TouchableOpacity style={styles.status} onPress={()=>void updateStatus(item,'closed')}><Text style={styles.statusText}>Kapat</Text></TouchableOpacity></View></View>}</View>)}
        {!requests.length&&<Text style={styles.empty}>Henüz gelen talep yok.</Text>}
      </>}
      {section==='visual'&&<>
        <Text style={styles.sectionTitle}>Paylaşılabilir görsel</Text>
        <ViewShot ref={visualRef} options={{format:'png',quality:1,width:1080,height:1350}} style={styles.visualCapture}>
          <LinearGradient colors={[palette.from,palette.to]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.visual,visualPreset==='minimal'&&styles.visualMinimal]}>
            <View style={[styles.visualInner,visualPreset==='framed'&&styles.visualInnerFramed,visualPreset==='minimal'&&styles.visualInnerMinimal]}>
              <View>
                <View style={styles.visualMark}><Feather name="arrow-up-right" size={18} color="#FFF"/></View>
                <Text style={[styles.visualTitle,prompt.length>80&&styles.visualTitleLong,visualPreset==='minimal'&&styles.visualTitleMinimal]}>{prompt.trim() || 'Görsel metninizi yazın.'}</Text>
              </View>
              {(showVisualName&&visualName.trim())||(showVisualPhone&&visualPhone.trim())?<View style={[styles.visualContact,visualPreset==='minimal'&&styles.visualContactMinimal]}>
                {showVisualName&&visualName.trim()?<Text style={styles.visualName}>{visualName.trim()}</Text>:null}
                {showVisualPhone&&visualPhone.trim()?<Text style={styles.visualPhone}>{visualPhone.trim()}</Text>:null}
              </View>:null}
            </View>
          </LinearGradient>
        </ViewShot>

        <View style={styles.card}>
          <Text style={styles.label}>Görsel metni</Text>
          <TextInput multiline maxLength={160} style={[styles.input,styles.visualTextInput]} value={prompt} onChangeText={setPrompt} placeholder="Kendi mesajınızı yazın…" placeholderTextColor={colors.placeholder}/>
          <Text style={styles.hint}>{prompt.length}/160</Text>
          <Text style={styles.label}>Hazır metinler</Text>
          {PROMPTS.map(value=><TouchableOpacity key={value} onPress={()=>setPrompt(value)} style={[styles.choice,prompt===value&&styles.choiceActive]}><Text style={styles.noteText}>{value}</Text></TouchableOpacity>)}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>İsim soyisim</Text>
          <View style={styles.row}><TextInput editable={showVisualName} maxLength={60} style={[styles.input,styles.flex,!showVisualName&&styles.disabled]} value={visualName} onChangeText={setVisualName} placeholder="İsim soyisim" placeholderTextColor={colors.placeholder}/><Switch value={showVisualName} onValueChange={setShowVisualName}/></View>
          <Text style={styles.label}>Telefon</Text>
          <View style={styles.row}><TextInput editable={showVisualPhone} maxLength={24} keyboardType="phone-pad" style={[styles.input,styles.flex,!showVisualPhone&&styles.disabled]} value={visualPhone} onChangeText={setVisualPhone} placeholder="05xx xxx xx xx" placeholderTextColor={colors.placeholder}/><Switch value={showVisualPhone} onValueChange={setShowVisualPhone}/></View>
          <Text style={styles.hint}>Anahtarları kapatarak bilgileri görselden çıkarabilirsiniz.</Text>
        </View>

        <Text style={styles.label}>Tasarım</Text>
        <View style={styles.presetRow}>{VISUAL_PRESETS.map(value=><TouchableOpacity key={value.id} onPress={()=>setVisualPreset(value.id)} style={[styles.preset,visualPreset===value.id&&styles.presetActive]}><Text style={[styles.presetText,visualPreset===value.id&&styles.presetTextActive]}>{value.label}</Text></TouchableOpacity>)}</View>
        <Text style={styles.label}>Renk</Text>
        <View style={styles.paletteRow}>{PALETTES.map(value=><TouchableOpacity accessibilityLabel={`${value.label} renk teması`} key={value.id} onPress={()=>setPalette(value)} style={[styles.paletteOuter,palette.id===value.id&&styles.paletteActive]}><LinearGradient colors={[value.from,value.to]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.palette}/></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.primary} onPress={()=>void shareVisual()}><Feather name="share-2" size={18} color={colors.surface}/><Text style={styles.primaryText}>Görseli paylaş</Text></TouchableOpacity>
      </>}
      {section==='notes'&&<><Text style={styles.sectionTitle}>Kişisel notlar</Text><View style={styles.card}><TextInput multiline style={[styles.input,styles.noteInput]} value={noteBody} onChangeText={setNoteBody} placeholder="Kendinize bir not yazın…" placeholderTextColor={colors.placeholder}/><TouchableOpacity style={styles.primary} onPress={()=>void saveNote()}><Text style={styles.primaryText}>{editingNote?'Notu güncelle':'Not ekle'}</Text></TouchableOpacity></View>{notes.map(item=><View key={item.id} style={styles.card}><Text style={styles.noteText}>{item.body}</Text><Text style={styles.hint}>{new Date(item.updatedAt).toLocaleString('tr-TR')}</Text><View style={styles.actions}><TouchableOpacity style={styles.small} onPress={()=>{setEditingNote(item.id);setNoteBody(item.body)}}><Feather name="edit-2" size={16} color={colors.primary}/><Text style={styles.secondaryText}>Düzenle</Text></TouchableOpacity><TouchableOpacity style={styles.small} onPress={()=>deleteNote(item)}><Feather name="trash-2" size={16} color={colors.danger}/><Text style={[styles.secondaryText,{color:colors.danger}]}>Sil</Text></TouchableOpacity></View></View>)}</>}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

function Gate({title,text,button,onPress,premiumGate=false}:{title:string;text:string;button:string;onPress:()=>void;premiumGate?:boolean}) { return <SafeAreaView style={styles.root}><View style={styles.gate}><MaterialCommunityIcons name={premiumGate?'crown':'account-circle-outline'} size={42} color={premiumGate?premium.accent:colors.primary}/><Text style={styles.title}>{title}</Text><Text style={[styles.muted,{textAlign:'center'}]}>{text}</Text><TouchableOpacity style={styles.primary} onPress={onPress}><Text style={styles.primaryText}>{button}</Text></TouchableOpacity></View></SafeAreaView>; }

const styles=StyleSheet.create({root:{backgroundColor:colors.background,flex:1},scroll:{flex:1},scrollContent:{gap:spacing.lg,paddingHorizontal:spacing.lg,paddingTop:spacing.lg},header:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',paddingTop:spacing.md},eyebrow:{color:premium.accent,fontSize:11,fontWeight:'900',letterSpacing:1},title:{color:colors.text,fontSize:typography.title,fontWeight:'900',marginTop:2},content:{gap:spacing.md},loading:{alignItems:'center',gap:spacing.sm,paddingTop:spacing.xxl},card:{backgroundColor:colors.surface,borderRadius:radius.lg,gap:spacing.md,padding:spacing.lg,...shadows.card},cardTitle:{color:colors.text,fontSize:typography.sectionTitle,fontWeight:'800'},sectionTitle:{color:colors.text,fontSize:typography.sectionTitle,fontWeight:'900',marginTop:spacing.sm},muted:{color:colors.textMuted,lineHeight:21},hint:{color:colors.textMuted,fontSize:typography.small},label:{color:colors.text,fontWeight:'800'},input:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:radius.md,borderWidth:1,color:colors.text,minHeight:50,paddingHorizontal:spacing.md},row:{alignItems:'center',flexDirection:'row',gap:spacing.md},flex:{flex:1},primary:{alignItems:'center',backgroundColor:colors.primary,borderRadius:radius.md,flexDirection:'row',gap:spacing.sm,justifyContent:'center',minHeight:50,paddingHorizontal:spacing.lg},primaryText:{color:colors.surface,fontWeight:'900'},secondary:{alignItems:'center',borderColor:colors.border,borderRadius:radius.md,borderWidth:1,flexDirection:'row',gap:spacing.sm,justifyContent:'center',minHeight:48},secondaryText:{color:colors.primary,fontWeight:'800'},disabled:{opacity:.4},detail:{borderTopColor:colors.border,borderTopWidth:1,gap:spacing.md,paddingTop:spacing.md},actions:{flexDirection:'row',gap:spacing.sm},small:{alignItems:'center',borderColor:colors.border,borderRadius:radius.md,borderWidth:1,flex:1,flexDirection:'row',gap:spacing.xs,justifyContent:'center',minHeight:42},status:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,flex:1,padding:spacing.sm},statusText:{color:colors.text,fontWeight:'800',textAlign:'center'},noteBox:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,gap:spacing.xs,padding:spacing.md},noteText:{color:colors.text,lineHeight:21},linkText:{color:colors.primary,fontWeight:'700',paddingVertical:spacing.xs},empty:{color:colors.textMuted,padding:spacing.xl,textAlign:'center'},visualCapture:{aspectRatio:.8,backgroundColor:colors.surface,borderRadius:radius.lg,overflow:'hidden',width:'100%',...shadows.card},visual:{flex:1,padding:spacing.lg},visualMinimal:{padding:spacing.md},visualInner:{flex:1,justifyContent:'space-between',padding:spacing.md},visualInnerFramed:{borderColor:'rgba(255,255,255,.72)',borderRadius:radius.lg,borderWidth:2,padding:spacing.lg},visualInnerMinimal:{backgroundColor:'rgba(255,255,255,.14)',borderRadius:radius.lg,padding:spacing.lg},visualMark:{alignItems:'center',backgroundColor:'rgba(255,255,255,.18)',borderColor:'rgba(255,255,255,.3)',borderRadius:20,borderWidth:1,height:40,justifyContent:'center',width:40},visualTitle:{color:'#FFF',fontSize:30,fontWeight:'900',lineHeight:36,marginTop:spacing.xl},visualTitleLong:{fontSize:24,lineHeight:30},visualTitleMinimal:{fontWeight:'800'},visualContact:{borderTopColor:'rgba(255,255,255,.38)',borderTopWidth:1,paddingTop:spacing.lg},visualContactMinimal:{backgroundColor:'rgba(8,20,42,.16)',borderRadius:radius.md,borderTopWidth:0,padding:spacing.md},visualName:{color:'#FFF',fontSize:20,fontWeight:'900'},visualPhone:{color:'#FFF',fontSize:17,fontWeight:'800',marginTop:spacing.sm},visualTextInput:{minHeight:104,paddingTop:spacing.md,textAlignVertical:'top'},choice:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:radius.md,borderWidth:1,padding:spacing.md},choiceActive:{borderColor:premium.accent,borderWidth:2},presetRow:{flexDirection:'row',gap:spacing.sm},preset:{alignItems:'center',backgroundColor:colors.surface,borderColor:colors.border,borderRadius:radius.md,borderWidth:1,flex:1,minHeight:44,justifyContent:'center'},presetActive:{backgroundColor:'#F1ECFF',borderColor:premium.accent,borderWidth:2},presetText:{color:colors.textMuted,fontWeight:'800'},presetTextActive:{color:premium.accent},paletteRow:{flexDirection:'row',flexWrap:'wrap',gap:spacing.md},paletteOuter:{borderColor:'transparent',borderRadius:28,borderWidth:3,padding:3},palette:{borderRadius:22,height:44,width:44},paletteActive:{borderColor:colors.text},noteInput:{minHeight:100,paddingTop:spacing.md,textAlignVertical:'top'},gate:{alignItems:'center',gap:spacing.lg,justifyContent:'center',padding:spacing.xl,flex:1},});
