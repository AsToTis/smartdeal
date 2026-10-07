import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

export default function OrderChatScreen() {
  const { order_id, role, user_id } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Parse params
  const orderId = Number(order_id);
  const senderId = Number(user_id);
  const senderType = role === 'seller' ? 'seller' : 'buyer';

  const fetchMessages = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const res = await axios.get(`${BASE_URL}/orders/${orderId}/messages`);
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
    // Initial fetch
    fetchMessages(true);

    // Polling every 3 seconds
    const intervalId = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [orderId]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      setSending(true);
      const res = await axios.post(`${BASE_URL}/orders/${orderId}/messages`, {
        sender_id: senderId,
        sender_type: senderType,
        message: inputText.trim()
      });

      if (res.data?.success) {
        setInputText('');
        fetchMessages(false); // Fetch immediately to update UI
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isSelf = item.sender_type === role;
    const isRider = item.sender_type === 'rider';
    const isSeller = item.sender_type === 'seller';
    const isBuyer = item.sender_type === 'buyer';

    const roleTag = isRider ? '🛵 ไรเดอร์' : isSeller ? '🏪 ร้านค้า' : '👤 ลูกค้า';

    return (
      <View style={[styles.messageRow, isSelf ? styles.messageRowSelf : styles.messageRowOther]}>
        <View style={[
          styles.messageBubble, 
          isSelf ? styles.messageBubbleSelf : isRider ? styles.messageBubbleRider : styles.messageBubbleOther
        ]}>
          <Text style={[styles.senderRoleText, isSelf ? styles.senderRoleSelf : isRider ? styles.senderRoleRider : styles.senderRoleOther]}>
            {isSelf ? 'คุณ' : roleTag}
          </Text>

          {item.image_url && (
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.attachedImage} 
              resizeMode="cover" 
            />
          )}

          {!!item.message && (
            <Text style={[styles.messageText, isSelf ? styles.messageTextSelf : isRider ? styles.messageTextRider : styles.messageTextOther]}>
              {item.message}
            </Text>
          )}

          <Text style={[styles.messageTime, isSelf ? styles.messageTimeSelf : isRider ? styles.messageTimeRider : styles.messageTimeOther]}>
            {new Date(item.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แชทคำสั่งซื้อ #{orderId}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>เริ่มต้นการสนทนา</Text>
              </View>
            }
          />
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            placeholder="พิมพ์ข้อความ..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
               <ActivityIndicator size="small" color="#fff" />
            ) : (
               <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  chatContainer: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageRow: { marginBottom: 12, flexDirection: 'row' },
  messageRowSelf: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleRider: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderBottomLeftRadius: 4,
  },
  senderRoleText: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  senderRoleSelf: { color: '#bbf7d0' },
  senderRoleRider: { color: '#059669' },
  senderRoleOther: { color: '#0284c7' },
  messageTextRider: { color: '#064e3b', fontWeight: '500' },
  messageTimeRider: { color: '#059669', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  attachedImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginVertical: 4,
  },
  messageBubbleSelf: {
    backgroundColor: '#16a34a',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#e2e8f0',
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextSelf: { color: '#fff' },
  messageTextOther: { color: '#0f172a' },
  messageTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  messageTimeSelf: { color: 'rgba(255,255,255,0.7)' },
  messageTimeOther: { color: '#64748b' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-end'
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 44,
    maxHeight: 120,
    fontSize: 15,
    color: '#0f172a'
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#16a34a',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 0
  }
});
