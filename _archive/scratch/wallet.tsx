import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

type Transaction = {
  id: string | number;
  description?: string;
  amount: number | string;
  type: 'credit' | 'debit';
  created_at: string;
};

type WalletData = {
  balance: number;
  todayIncome: number;
  todayJobs: number;
  history: Transaction[];
};

export default function WalletScreen() {
  const router = useRouter();
  const { rider } = useAuth();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const fetchWallet = async () => {
    setRefreshing(true);
    try {
      const riderId = rider?.id || (rider as any)?.rider_id;
      if (!riderId) return;
      const res = await api.get(`/rider/wallet?rider_id=${riderId}`);
      if (res.data.success) {
        setWalletData(res.data);
      }
    } catch (e) {
      console.error('Fetch wallet error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [rider]);

  if (!walletData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>กระเป๋าเงินและรายได้</Text>
        <TouchableOpacity onPress={() => router.push('/income' as any)}>
          <MaterialCommunityIcons name="chart-box-outline" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchWallet} />}
      >
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>ยอดเงินคงเหลือในกระเป๋า</Text>
          <Text style={styles.balanceValue}>฿{Number(walletData.balance).toFixed(2)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>รายได้วันนี้</Text>
            <Text style={styles.statValue}>฿{Number(walletData.todayIncome).toFixed(2)}</Text>
            <View style={styles.statTrend}>
              <Ionicons name="trending-up" size={14} color="#2e7d32" />
              <Text style={styles.statTrendText}>อัปเดตล่าสุด</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>งานที่สำเร็จ</Text>
            <Text style={styles.statValue}>{walletData.todayJobs} งาน</Text>
            <View style={styles.statTrend}>
              <Ionicons name="add-circle" size={14} color="#2e7d32" />
              <Text style={styles.statTrendText}>วันนี้</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.withdrawButton}>
          <Ionicons name="card" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.withdrawButtonText}>ถอนเงินเข้าบัญชี</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ประวัติรายการ</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
          </TouchableOpacity>
        </View>

        {walletData.history.map((tx, idx) => {
          const date = new Date(tx.created_at);
          const dateStr = date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const isWithdraw = tx.type === 'debit';
          
          return (
            <View key={tx.id || idx} style={styles.transactionCard}>
              <View style={[styles.txIconBox, isWithdraw ? styles.txIconBoxWithdraw : styles.txIconBoxDelivery]}>
                {isWithdraw ? (
                  <MaterialCommunityIcons name="bank" size={24} color="#333" />
                ) : (
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#2e7d32" />
                )}
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txTitle} numberOfLines={1}>{isWithdraw ? 'ถอนเงิน' : `ออเดอร์ ${tx.description || ''}`}</Text>
                <Text style={styles.txTime}>{dateStr}</Text>
              </View>
              <View style={styles.txAmountContainer}>
                <Text style={[styles.txAmount, isWithdraw ? styles.txAmountNegative : styles.txAmountPositive]}>
                  {isWithdraw ? '- ฿' : '+ ฿'}{Number(tx.amount).toFixed(2)}
                </Text>
                <Text style={styles.txSubtext}>{isWithdraw ? 'สำเร็จ' : 'ค่าส่ง'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  balanceContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#0a192f',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 5,
  },
  statLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statTrendText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginLeft: 4,
  },
  withdrawButton: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 32,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  txIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  txIconBoxDelivery: {
    backgroundColor: '#dcedc8',
  },
  txIconBoxWithdraw: {
    backgroundColor: '#f5f5f5',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  txTime: {
    fontSize: 12,
    color: '#888',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  txAmountPositive: {
    color: '#2e7d32',
  },
  txAmountNegative: {
    color: '#333',
  },
  txSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
