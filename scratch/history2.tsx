import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

type HistoryItem = {
  id: number;
  order_id: number;
  restaurant_name: string;
  delivery_address: string;
  customer_name: string;
  delivery_fee: number;
  completed_at: string;
};

type Summary = {
  total_jobs: number;
  total_earnings: number;
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_jobs: 0, total_earnings: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const { rider } = useAuth();

  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      // If we don't have a rider.id for some reason, just skip
      const riderId = rider?.id || (rider as any)?.rider_id;
      if (!riderId) throw new Error("No rider ID");
      
      const response = await api.get(`/rider/${riderId}/history`);
      if (response.data.success) {
        const data = response.data.data || {};
        setHistory(data.deliveries || []);
        setSummary({
          total_jobs: data.deliveries?.length || 0,
          total_earnings: data.total_earnings || 0
        });
      } else {
        throw new Error(response.data.message || 'Failed to fetch history');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistory([]);
      setSummary({ total_jobs: 0, total_earnings: 0 });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [rider]);

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
    const dateStr = new Date(item.completed_at).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
          <Text style={styles.fee}>+฿{item.delivery_fee || 0}</Text>
        </View>
        <Text style={styles.detailText}>งานที่ #{item.id} • {dateStr}</Text>
        <Text style={styles.detailText}>
          <Ionicons name="location-outline" size={14} /> ส่งที่: {item.delivery_address}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>จำนวนงานทั้งหมด</Text>
          <Text style={styles.summaryValue}>{summary.total_jobs}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>รายได้รวม</Text>
          <Text style={styles.summaryValueAmount}>฿{summary.total_earnings}</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchHistory} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ยังไม่มีประวัติการส่ง</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  fee: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  }
});
