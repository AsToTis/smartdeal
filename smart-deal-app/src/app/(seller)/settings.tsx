import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function SellerSettingsScreen() {
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [editModal, setEditModal] = useState({visible: false, field: '', value: '', title: ''});
  const [notiEnabled, setNotiEnabled] = useState(true);
  const [ownerName, setOwnerName] = useState('เจ้าของร้าน');
  const [userId, setUserId] = useState<string | null>(null);

  const fetchShopData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setOwnerName(`เจ้าของร้าน: ${parsed.full_name || 'สมชาย แซ่ตั้ง'}`);
        setUserId(parsed.user_id?.toString());
        
        if (parsed.user_id) {
          const res = await axios.get(`${BASE_URL}/seller/settings/${parsed.user_id}`);
          if (res.data?.success) {
            setShopInfo(res.data.data);
            setFormData(res.data.data);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchShopData();
    }, [])
  );

  const handleSave = async () => {
    if (!shopInfo?.shop_id) return;
    try {
      const res = await axios.put(`${BASE_URL}/seller/settings/${shopInfo.shop_id}`, formData);
      if (res.data?.success) {
        Alert.alert('สำเร็จ', 'บันทึกข้อมูลสำเร็จ');
        setShopInfo(formData);
      } else {
        Alert.alert('ข้อผิดพลาด', res.data?.message || 'ไม่สามารถบันทึกได้');
      }
    } catch (error) {
      console.error('Error saving shop data:', error);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const openEdit = (field: string, title: string) => {
    setEditModal({
      visible: true,
      field,
      title,
      value: formData[field] || ''
    });
  };

  const handleEditSave = () => {
    setFormData((prev: any) => ({ ...prev, [editModal.field]: editModal.value }));
    setEditModal({visible: false, field: '', value: '', title: ''});
  };

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบและกลับไปหน้าผู้ซื้อใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { 
        text: 'ออกจากระบบ', 
        style: 'destructive',
        onPress: () => {
          // just go back to profile (Buyer mode)
          router.replace('/(tabs)/profile');
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตั้งค่าร้านค้า</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Profile Card */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: shopInfo?.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' }} 
              style={styles.avatar} 
            />
            <View style={styles.cameraBadge}>
              <MaterialIcons name="camera-alt" size={14} color="#fff" />
            </View>
          </View>
          <Text style={styles.shopNameLarge}>{formData.name || shopInfo?.name || 'สมาร์ทดีล สาขากรุงเทพ'}</Text>
          <Text style={styles.ownerName}>{ownerName}</Text>
        </View>

        {/* ข้อมูลทั่วไป */}
        <Text style={styles.sectionTitle}>ข้อมูลทั่วไป</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => openEdit('name', 'ชื่อร้านค้า')}>
            <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
              <MaterialIcons name="storefront" size={20} color="#16a34a" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>ชื่อร้านค้า</Text>
              <Text style={styles.settingValue}>{formData.name || 'ยังไม่ระบุ'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => openEdit('address', 'ที่อยู่ร้านค้า')}>
            <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4' }]}>
              <MaterialIcons name="location-on" size={20} color="#2e7a32" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>ที่อยู่</Text>
              <Text style={styles.settingValue} numberOfLines={1}>
                {formData.address || 'ยังไม่ระบุ'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => openEdit('opening_hours', 'เวลาเปิด-ปิด')}>
            <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9' }]}>
              <MaterialIcons name="access-time" size={20} color="#2e7a32" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>เวลาเปิด-ปิด</Text>
              <Text style={styles.settingValue}>{formData.opening_hours || 'ทุกวัน 08:00 - 20:00'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* การเงินและการตั้งค่า */}
        <Text style={styles.sectionTitle}>การเงินและการตั้งค่า</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => openEdit('bank_name', 'ชื่อธนาคาร')}>
            <View style={[styles.iconCircle, { backgroundColor: '#e2e8f0' }]}>
              <MaterialIcons name="account-balance" size={20} color="#2e7a32" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>ธนาคาร</Text>
              <Text style={styles.settingValue}>{formData.bank_name || 'ยังไม่ระบุ'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => openEdit('bank_account', 'เลขบัญชี')}>
            <View style={[styles.iconCircle, { backgroundColor: '#e2e8f0' }]}>
              <MaterialIcons name="credit-card" size={20} color="#2e7a32" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>เลขบัญชี</Text>
              <Text style={styles.settingValue}>{formData.bank_account || 'ยังไม่ระบุ'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={[styles.iconCircle, { backgroundColor: '#eef2ff' }]}>
              <MaterialIcons name="notifications-active" size={20} color="#2e7a32" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingValue}>การแจ้งเตือนคำสั่งซื้อ</Text>
              <Text style={styles.settingLabel}>เปิดรับแจ้งเตือนเมื่อมีออเดอร์ใหม่</Text>
            </View>
            <Switch
              trackColor={{ false: '#cbd5e1', true: '#2e7a32' }}
              thumbColor={'#fff'}
              value={notiEnabled}
              onValueChange={setNotiEnabled}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>บันทึกการเปลี่ยนแปลง</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>ออกจากระบบ</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal(prev => ({...prev, visible: false}))}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>แก้ไข{editModal.title}</Text>
            
            <TextInput
              style={styles.textInput}
              value={editModal.value}
              onChangeText={(text) => setEditModal(prev => ({...prev, value: text}))}
              autoFocus
              multiline={editModal.field === 'address'}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalBtnCancel} 
                onPress={() => setEditModal(prev => ({...prev, visible: false}))}
              >
                <Text style={styles.modalBtnCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalBtnSubmit} 
                onPress={handleEditSave}
              >
                <Text style={styles.modalBtnSubmitText}>ยืนยัน</Text>
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
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#dcfce7',
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2e7a32',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  shopNameLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 14,
    color: '#16a34a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 72,
  },
  saveBtn: {
    backgroundColor: '#2e7a32',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 16,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 24,
    minHeight: 50,
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
