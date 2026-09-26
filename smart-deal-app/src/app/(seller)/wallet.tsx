import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function SellerWalletScreen() {
  const [activeTab, setActiveTab] = useState('sales'); // sales, withdrawals
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [stats, setStats] = useState<any>({ balance: 0, pending: 0, withdrawn_this_month: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [shopId, setShopId] = useState<string | null>(null);

  const fetchWalletData = async () => {
    try {
      let currentShopId = await AsyncStorage.getItem('shop_id');
      
      if (!currentShopId) {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user?.user_id) {
            const userShopRes = await axios.get(`${BASE_URL}/users/${user.user_id}/shop`);
            if (userShopRes.data?.success && userShopRes.data?.shop) {
              const newShopId = userShopRes.data.shop.shop_id.toString();
              currentShopId = newShopId;
              await AsyncStorage.setItem('shop_id', newShopId);
            }
          }
        }
      }

      if (!currentShopId) return;
      setShopId(currentShopId);

      const res = await axios.get(`${BASE_URL}/seller/wallet/${currentShopId}`);
      if (res.data?.success) {
        setStats({
          balance: res.data.balance || 0,
          pending: res.data.pending_amount || 0,
          withdrawn_this_month: 0
        });
        
        // Format history
        const formattedHistory = (res.data.history || []).map((item: any, index: number) => {
           let dateObj = new Date(item.created_at);
           let formattedDate = `${dateObj.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][dateObj.getMonth()]} ${dateObj.getFullYear()} • ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
           return {
             id: item.id || index,
             type: item.type, // 'sale' or 'withdrawal'
             title: item.type === 'sale' ? `ออเดอร์ #${item.id} (หัก GP)` : 'ถอนเงิน',
             date: formattedDate,
             amount: item.amount,
             status: item.status === 'completed' ? 'สำเร็จ' : (item.status === 'pending' ? 'รอดำเนินการ' : item.status),
             icon: item.type === 'sale' ? 'utensils' : 'money-check-alt'
           };
        });
        setTransactions(formattedHistory);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [])
  );

  const handleWithdraw = () => {
    setIsWithdrawModalVisible(true);
  };

  const submitWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }
    if (amount > stats.balance) {
      Alert.alert('ข้อผิดพลาด', 'ยอดเงินไม่เพียงพอ');
      return;
    }
    
    try {
      const res = await axios.post(`${BASE_URL}/seller/wallet/withdraw`, {
        shop_id: shopId,
        amount: amount
      });
      if (res.data?.success) {
        Alert.alert('สำเร็จ', 'ส่งคำขอถอนเงินสำเร็จ');
        setIsWithdrawModalVisible(false);
        setWithdrawAmount('');
        fetchWalletData();
      } else {
        Alert.alert('ข้อผิดพลาด', res.data?.message || 'ไม่สามารถถอนเงินได้');
      }
    } catch (error: any) {
       Alert.alert('ข้อผิดพลาด', error.response?.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const formatMoney = (amount: number) => {
    return Number(amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredTransactions = transactions.filter(t => 
    activeTab === 'sales' ? t.type === 'sale' : t.type === 'withdrawal'
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>กระเป๋าเงินผู้ขาย</Text>
        <View style={styles.helpBtn}>
          <MaterialIcons name="help" size={20} color="#0f172a" />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWalletData(); }} />}
      >
        {/* Wallet Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletCardTop}>
            <MaterialIcons name="account-balance-wallet" size={48} color="#2e7a32" style={{ opacity: 0.2 }} />
          </View>
          <View style={styles.walletCardBottom}>
            <Text style={styles.walletLabel}>ยอดเงินที่ถอนได้</Text>
            <Text style={styles.walletAmount}>฿{formatMoney(stats.balance)}</Text>
            <Text style={styles.walletSub}>Smart Deal Wallet • อัปเดตเมื่อ 5 นาทีที่แล้ว</Text>
            
            <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw}>
              <MaterialIcons name="account-balance" size={20} color="#fff" />
              <Text style={styles.withdrawBtnText}>ถอนเงินไปยังบัญชีธนาคาร</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Small Cards */}
        <View style={styles.smallCardsRow}>
          <View style={styles.smallCard}>
            <Text style={styles.smallCardLabel}>ยอดเงินรอดำเนินการ (Escrow)</Text>
            <Text style={styles.smallCardAmount}>฿{formatMoney(stats.pending)}</Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.smallCardLabel}>ถอนแล้วเดือนนี้</Text>
            <Text style={styles.smallCardAmount}>฿{formatMoney(stats.withdrawn_this_month)}</Text>
          </View>
        </View>

        {/* Transaction History */}
        <Text style={styles.historyTitle}>ประวัติรายการ</Text>
        <View style={styles.tabContainer}>
          {['sales', 'withdrawals'].map((tab) => {
            const labels: any = { sales: 'รายการขาย', withdrawals: 'การถอนเงิน' };
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[tab]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {filteredTransactions.slice(0, showAllTransactions ? filteredTransactions.length : 5).map(item => (
            <View key={item.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <FontAwesome5 name={item.icon} size={18} color="#2e7a32" />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionName}>{item.title}</Text>
                <Text style={styles.transactionDate}>{item.date}</Text>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[
                  styles.transactionAmount, 
                  { color: item.type === 'withdrawal' ? '#475569' : '#16a34a' }
                ]}>
                  {item.type === 'withdrawal' ? '-' : '+'}฿{formatMoney(item.amount)}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            </View>
          ))}
          
          {!showAllTransactions && filteredTransactions.length > 5 && (
            <TouchableOpacity 
              style={styles.viewAllBtn} 
              onPress={() => setShowAllTransactions(true)}
            >
              <Text style={styles.viewAllText}>ดูรายการทั้งหมด</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#2e7a32" />
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal
        visible={isWithdrawModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ถอนเงิน</Text>
            <Text style={styles.modalSubtitle}>ยอดเงินที่ถอนได้: ฿{formatMoney(stats.balance)}</Text>
            
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              placeholder="กรอกจำนวนเงิน"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalBtnCancel} 
                onPress={() => setIsWithdrawModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalBtnSubmit} 
                onPress={submitWithdraw}
              >
                <Text style={styles.modalBtnSubmitText}>ยืนยันถอนเงิน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  helpBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  walletCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  walletCardTop: {
    backgroundColor: '#2e7a32',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletCardBottom: {
    padding: 24,
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  walletAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2e7a32',
    marginBottom: 4,
  },
  walletSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 24,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7a32',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  withdrawBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  smallCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  smallCard: {
    flex: 1,
    backgroundColor: '#eef2ff',
    padding: 16,
    borderRadius: 24,
  },
  smallCardLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  smallCardAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  tabBtn: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#2e7a32',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2e7a32',
  },
  listContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#94a3b8',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: 'bold',
  },
  viewAllBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  viewAllText: {
    color: '#2e7a32',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBtnSubmit: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#2e7a32',
    alignItems: 'center',
  },
  modalBtnSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
