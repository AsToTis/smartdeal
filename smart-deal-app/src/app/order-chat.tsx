import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Alert, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

const { width, height } = Dimensions.get('window');

export default function OrderChatScreen() {
  const params = useLocalSearchParams();
  const orderId = Number(params.order_id || params.orderId || params.id);
  const initialRole = (params.role as string) || 'buyer';
  const target = (params.target as string) || (initialRole === 'seller' ? 'buyer' : 'seller'); // 'seller' or 'rider' or 'buyer'
  
  const [role, setRole] = useState<string>(initialRole);
  const [userId, setUserId] = useState<number>(Number(params.user_id || params.userId) || 0);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  const flatListRef = useRef<FlatList>(null);

  // Helper to format image URLs
  const getFullImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
      return url;
    }
    return `${BASE_URL.replace('/api', '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Resolve user and role if not passed
  useEffect(() => {
    (async () => {
      try {
        if (!userId) {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.user_id) setUserId(Number(parsed.user_id));
            if (!params.role && parsed.role) setRole(parsed.role);
          }
        }
      } catch (e) {
        console.error('Error getting stored user for chat:', e);
      }
    })();
  }, []);

  // Fetch basic order info for header badge
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const res = await axios.get(`${BASE_URL}/orders/${orderId}`);
        if (res.data?.success) {
          setOrderInfo(res.data.order || res.data.data);
        }
      } catch (e) {}
    })();
  }, [orderId]);

  const fetchMessages = async (showLoading = false) => {
    if (!orderId) return;
    try {
      if (showLoading) setLoading(true);
      const targetParam = target ? `?target=${target}` : (role === 'seller' ? '?target=seller' : '?target=buyer');
      const res = await axios.get(`${BASE_URL}/orders/${orderId}/messages${targetParam}`);
      if (res.data?.success) {
        setMessages(res.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(true);
    const intervalId = setInterval(() => {
      fetchMessages(false);
    }, 3500);

    return () => clearInterval(intervalId);
  }, [orderId, target]);

  // Image picking options
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('การเข้าถึง', 'กรุณาอนุญาตให้เข้าถึงรูปภาพในเครื่อง');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Pick image error:', error);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('การเข้าถึง', 'กรุณาอนุญาตให้เข้าถึงกล้องถ่ายรูป');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert(
      'แนบรูปภาพ',
      'เลือกช่องทางการแนบรูปภาพ',
      [
        { text: 'ถ่ายรูปจากกล้อง 📷', onPress: handleTakePhoto },
        { text: 'เลือกจากคลังภาพ 🖼️', onPress: handlePickImage },
        { text: 'ยกเลิก', style: 'cancel' }
      ]
    );
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;

    try {
      setSending(true);

      const senderType = role === 'seller' ? 'seller' : role === 'rider' ? 'rider' : 'buyer';
      const receiverType = target === 'rider' ? 'rider' : target === 'seller' ? 'seller' : 'all';

      if (selectedImage) {
        const formData = new FormData();
        formData.append('sender_id', String(userId || 1));
        formData.append('sender_type', senderType);
        formData.append('receiver_type', receiverType);
        if (inputText.trim()) {
          formData.append('message', inputText.trim());
        }

        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('image', {
          uri: selectedImage,
          name: `chat_${orderId}_${Date.now()}.${fileType}`,
          type: `image/${fileType}`
        } as any);

        const res = await axios.post(`${BASE_URL}/orders/${orderId}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          setInputText('');
          setSelectedImage(null);
          fetchMessages(false);
        }
      } else {
        const res = await axios.post(`${BASE_URL}/orders/${orderId}/messages`, {
          sender_id: userId || 1,
          sender_type: senderType,
          receiver_type: receiverType,
          message: inputText.trim()
        });

        if (res.data?.success) {
          setInputText('');
          fetchMessages(false);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถส่งข้อความได้ กรุณาลองใหม่');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isSelf = (item.sender_type === role) || (userId && item.sender_id === userId);
    const isRider = item.sender_type === 'rider';
    const isSeller = item.sender_type === 'seller';
    const isBuyer = item.sender_type === 'buyer';
    const isSystem = item.sender_type === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Ionicons name="information-circle" size={14} color="#64748b" />
            <Text style={styles.systemMessageText}>{item.message}</Text>
          </View>
        </View>
      );
    }

    const roleBadgeText = isSelf 
      ? 'คุณ' 
      : isRider 
        ? `🛵 ไรเดอร์ (${orderInfo?.rider_name || 'ไรเดอร์'})` 
        : isSeller 
          ? `🏪 ร้านค้า (${orderInfo?.shop_name || 'ร้านค้า'})` 
          : `👤 ลูกค้า (${orderInfo?.customer_name || 'ลูกค้า'})`;

    const fullImg = item.image_url ? getFullImageUrl(item.image_url) : null;

    return (
      <View style={[styles.messageRow, isSelf ? styles.messageRowSelf : styles.messageRowOther]}>
        {!isSelf && (
          <View style={[
            styles.avatarBadge,
            isRider ? styles.avatarRider : isSeller ? styles.avatarSeller : styles.avatarBuyer
          ]}>
            <Text style={styles.avatarText}>
              {isRider ? '🛵' : isSeller ? '🏪' : '👤'}
            </Text>
          </View>
        )}

        <View style={[
          styles.messageBubble, 
          isSelf 
            ? styles.messageBubbleSelf 
            : isRider 
              ? styles.messageBubbleRider 
              : isSeller 
                ? styles.messageBubbleSeller 
                : styles.messageBubbleBuyer
        ]}>
          <View style={styles.roleHeaderRow}>
            <Text style={[
              styles.senderRoleText, 
              isSelf ? styles.senderRoleSelf : isRider ? styles.senderRoleRider : isSeller ? styles.senderRoleSeller : styles.senderRoleBuyer
            ]}>
              {roleBadgeText}
            </Text>
            <Text style={[styles.messageTime, isSelf ? styles.messageTimeSelf : styles.messageTimeOther]}>
              {new Date(item.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {fullImg && (
            <TouchableOpacity 
              activeOpacity={0.85} 
              onPress={() => setPreviewImageUrl(fullImg)}
              style={styles.imageWrapper}
            >
              <Image 
                source={{ uri: fullImg }} 
                style={styles.attachedImage} 
                resizeMode="cover" 
              />
              <View style={styles.imageOverlayBadge}>
                <Ionicons name="expand" size={14} color="#fff" />
                <Text style={styles.imageOverlayText}>แตะเพื่อดูรูป</Text>
              </View>
            </TouchableOpacity>
          )}

          {!!item.message && (
            <Text style={[styles.messageText, isSelf ? styles.messageTextSelf : styles.messageTextOther]}>
              {item.message}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const getStatusBadge = (status?: string) => {
    switch(status) {
      case 'preparing': return { label: 'กำลังเตรียม', bg: '#fef3c7', text: '#d97706' };
      case 'ready': return { label: 'พร้อมส่ง', bg: '#e0e7ff', text: '#4338ca' };
      case 'delivering': return { label: 'กำลังจัดส่ง 🛵', bg: '#dcfce7', text: '#15803d' };
      case 'delivered': return { label: 'จัดส่งสำเร็จ 📦', bg: '#dbeafe', text: '#1d4ed8' };
      case 'completed': return { label: 'สำเร็จแล้ว ✅', bg: '#f0fdf4', text: '#16a34a' };
      default: return { label: status || 'ดำเนินการ', bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const statusBadge = getStatusBadge(orderInfo?.order_status);

  // Dynamic Header Title & Subtitle based on target
  const getHeaderInfo = () => {
    if (target === 'rider') {
      return {
        title: `🛵 แชทกับไรเดอร์`,
        sub: orderInfo?.rider_name ? `คุณ ${orderInfo.rider_name} (${orderInfo.rider_phone || ''})` : 'คนขับจัดส่งคำสั่งซื้อนี้',
        icon: 'bicycle',
        placeholder: 'พิมพ์ข้อความถึงไรเดอร์...'
      };
    } else if (role === 'seller') {
      return {
        title: `👤 แชทกับลูกค้า`,
        sub: orderInfo?.customer_name || orderInfo?.receiver_name || 'ลูกค้าคำสั่งซื้อนี้',
        icon: 'person',
        placeholder: 'พิมพ์ข้อความถึงลูกค้า...'
      };
    } else {
      return {
        title: `🏪 แชทกับร้านค้า`,
        sub: orderInfo?.shop_name || 'ร้านค้า',
        icon: 'storefront',
        placeholder: 'พิมพ์ข้อความถึงร้านค้า...'
      };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{headerInfo.title}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {headerInfo.sub} • ออเดอร์ #{orderId}
          </Text>
        </View>
        <View style={[styles.headerStatusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.headerStatusText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>กำลังโหลดข้อความ...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => (item.id || item.message_id || Math.random()).toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>เริ่มต้นการสนทนา</Text>
                <Text style={styles.emptySubtitle}>
                  {target === 'rider'
                    ? 'สอบถามตำแหน่งหรือแจ้งจุดนัดรับกับไรเดอร์ได้ที่นี่'
                    : 'สอบถามรายละเอียดสินค้าหรือสถานะออเดอร์กับร้านค้าได้ที่นี่'}
                </Text>
              </View>
            }
          />
        )}

        {/* Selected Image Preview before sending */}
        {selectedImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewThumb} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.previewTitle}>รูปภาพพร้อมส่ง</Text>
              <Text style={styles.previewSub}>พิมพ์ข้อความเพิ่มเติมหรือกดส่งได้ทันที</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
              <MaterialIcons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TouchableOpacity 
            style={styles.attachmentBtn} 
            onPress={showAttachmentOptions}
            disabled={sending}
          >
            <Ionicons name="camera" size={22} color="#16a34a" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={headerInfo.placeholder}
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />

          <TouchableOpacity 
            style={[
              styles.sendBtn, 
              (!inputText.trim() && !selectedImage) && { opacity: 0.5 }
            ]} 
            onPress={sendMessage}
            disabled={(!inputText.trim() && !selectedImage) || sending}
          >
            {sending ? (
               <ActivityIndicator size="small" color="#fff" />
            ) : (
               <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Full Image Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.fullImageModal}>
          <TouchableOpacity 
            style={styles.modalCloseBtn}
            onPress={() => setPreviewImageUrl(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image 
              source={{ uri: previewImageUrl }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    zIndex: 10
  },
  backBtn: { padding: 6, marginLeft: -6 },
  headerCenter: { flex: 1, marginHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  headerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatContainer: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },

  messageRow: { marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end' },
  messageRowSelf: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  avatarRider: { backgroundColor: '#dcfce7' },
  avatarSeller: { backgroundColor: '#fef3c7' },
  avatarBuyer: { backgroundColor: '#dbeafe' },
  avatarText: { fontSize: 16 },

  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleSelf: {
    backgroundColor: '#16a34a',
    borderBottomRightRadius: 4,
  },
  messageBubbleRider: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderBottomLeftRadius: 4,
  },
  messageBubbleSeller: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderBottomLeftRadius: 4,
  },
  messageBubbleBuyer: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderBottomLeftRadius: 4,
  },

  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  senderRoleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  senderRoleSelf: { color: '#dcfce7' },
  senderRoleRider: { color: '#059669' },
  senderRoleSeller: { color: '#d97706' },
  senderRoleBuyer: { color: '#2563eb' },

  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
    backgroundColor: '#000',
    position: 'relative'
  },
  attachedImage: {
    width: width * 0.55,
    height: width * 0.42,
    borderRadius: 12,
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600'
  },

  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextSelf: { color: '#ffffff' },
  messageTextOther: { color: '#0f172a' },
  
  messageTime: { fontSize: 10 },
  messageTimeSelf: { color: 'rgba(255,255,255,0.75)' },
  messageTimeOther: { color: '#94a3b8' },

  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: '#475569', fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  emptySubtitle: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  previewSub: {
    fontSize: 11,
    color: '#64748b',
  },
  removeImageBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputArea: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 8
  },
  attachmentBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullImageModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
  },
  fullImage: {
    width: width * 0.95,
    height: height * 0.8,
  }
});
