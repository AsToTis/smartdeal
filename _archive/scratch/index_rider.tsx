import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Vibration } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

interface Job {
  order_id: number;
  shop_name: string;
  shop_address: string;
  customer_address: string;
  delivery_fee: string;
  distance: string;
}

export default function HomeTabs() {
  const router = useRouter();
  const { token } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [jobs, setJobs] = useState<Job[]>([]);
  const prevJobsCountRef = useRef(0);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/rider/jobs');
      if (response.data.success) {
        // The API returns { success: true, data: [...] } not jobs
        const newJobs = response.data.data || [];
        setJobs(newJobs);
        
        if (newJobs.length > prevJobsCountRef.current) {
          Vibration.vibrate([0, 500, 200, 500]); // Vibrate pattern for new job
        }
        prevJobsCountRef.current = newJobs.length;
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="menu" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Deal</Text>
        <TouchableOpacity>
          <Ionicons name="notifications" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Toggle */}
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>สถานะการทำงาน</Text>
            <Text style={[styles.statusSubtitle, { color: isOnline ? '#2e7d32' : '#666' }]}>
              {isOnline ? 'คุณกำลังออนไลน์และพร้อมรับงาน' : 'คุณกำลังออฟไลน์'}
            </Text>
          </View>
          <Switch
            trackColor={{ false: '#e0e0e0', true: '#2e7d32' }}
            thumbColor={'#fff'}
            ios_backgroundColor="#e0e0e0"
            onValueChange={setIsOnline}
            value={isOnline}
          />
        </View>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningCol}>
            <Text style={styles.earningLabel}>รายได้วันนี้</Text>
            <Text style={styles.earningValue}>฿1,250.00</Text>
          </View>
          <View style={styles.earningColRight}>
            <Text style={styles.earningLabel}>จำนวนงาน</Text>
            <Text style={styles.earningValueRight}>8</Text>
          </View>
        </View>

        {/* Custom Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'new' && styles.activeTab]}
            onPress={() => setActiveTab('new')}
          >
            <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabText]}>งานใหม่</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'ongoing' && styles.activeTab]}
            onPress={() => setActiveTab('ongoing')}
          >
            <Text style={[styles.tabText, activeTab === 'ongoing' && styles.activeTabText]}>กำลังทำ</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>เสร็จสิ้น</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>งานจัดส่งที่ว่างอยู่ ({jobs.length})</Text>

        {/* Job List */}
        {jobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bike-fast" size={64} color="#ccc" />
            <Text style={styles.emptyText}>ยังไม่มีงานจัดส่งในขณะนี้</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <View key={job.order_id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#2e7d32" />
                </View>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobRestaurant}>{job.shop_name}</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="#666" />
                    <Text style={styles.jobAddress}>{job.shop_address}</Text>
                  </View>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceText}>฿{job.delivery_fee}</Text>
                  <Text style={styles.priceSubtext}>ค่าส่งรวมทิป</Text>
                </View>
              </View>

              <View style={styles.jobDetailsRow}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>ระยะทาง</Text>
                  <Text style={styles.detailValue}>{job.distance || '-'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>ไปส่งที่</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{job.customer_address || '-'}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={() => router.push(`/delivery/${job.order_id}` as any)}
              >
                <Text style={styles.acceptButtonText}>รับงาน</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
  },
  earningsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2e7d32',
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
  },
  earningCol: {
    flex: 1,
  },
  earningColRight: {
    alignItems: 'flex-end',
  },
  earningLabel: {
    color: '#a5d6a7',
    fontSize: 14,
    marginBottom: 8,
  },
  earningValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  earningValueRight: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#2e7d32',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
  },
  activeTabText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f8e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobRestaurant: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobAddress: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  priceSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  jobDetailsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    width: 1,
    backgroundColor: '#eee',
    marginHorizontal: 16,
  },
  acceptButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
});
