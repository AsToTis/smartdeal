import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BASE_URL } from '../constants/api';

export default function RefundScreen() {
  const router = useRouter();
  const { order_id, user_id } = useLocalSearchParams();
  
  const [bankName, setBankName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [accName, setAccName] = useState('');
  const [slipImage, setSlipImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSlipImage(result.assets[0]);
    }
  };

  const submitRefund = async () => {
    if (!bankName || !accNumber || !accName || !slipImage) {
      return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลและแนบสลิปที่โอนให้ครบถ้วน');
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('user_id', user_id as string);
    formData.append('order_id', order_id as string);
    formData.append('bank_name', bankName);
    formData.append('account_number', accNumber);
    formData.append('account_name', accName);
    
    // @ts-ignore
    formData.append('slip_image', {
      uri: slipImage.uri,
      type: 'image/jpeg',
      name: 'slip.jpg',
    });

    try {
      const response = await axios.post(`${BASE_URL}/refund-request`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data.success) {
        Alert.alert('สำเร็จ', 'ส่งคำขอคืนเงินเรียบร้อยแล้ว กรุณารอแอดมินตรวจสอบ', [
          { text: 'ตกลง', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งคำขอได้ หรือคุณอาจจะเคยส่งคำขอสำหรับออเดอร์นี้ไปแล้ว');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ขอคืนเงิน (ยกเลิกอัตโนมัติ)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.subtitle}>กรุณากรอกข้อมูลบัญชีเพื่อรับเงินคืนสำหรับออเดอร์ #{order_id}</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="ชื่อธนาคาร (เช่น กสิกรไทย)" 
        value={bankName} 
        onChangeText={setBankName} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="เลขที่บัญชี" 
        value={accNumber} 
        onChangeText={setAccNumber} 
        keyboardType="numeric" 
      />
      <TextInput 
        style={styles.input} 
        placeholder="ชื่อบัญชี (ควรตรงกับสลิปที่โอน)" 
        value={accName} 
        onChangeText={setAccName} 
      />

      <TouchableOpacity style={styles.imgBtn} onPress={pickImage}>
        <Text style={styles.imgBtnText}>แนบรูปสลิปตอนชำระเงินค่าอาหาร</Text>
      </TouchableOpacity>
      
      {slipImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: slipImage.uri }} style={styles.preview} />
        </View>
      )}

      <TouchableOpacity 
        style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
        onPress={submitRefund}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>ส่งเรื่องขอคืนเงิน</Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#fff' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 5,
    color: '#333'
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    fontSize: 16
  },
  imgBtn: { 
    backgroundColor: '#eef2ff', 
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderStyle: 'dashed',
    padding: 20, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginBottom: 15 
  },
  imgBtnText: {
    color: '#4f46e5',
    fontWeight: '600'
  },
  previewContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    backgroundColor: '#f9f9f9'
  },
  preview: { 
    width: '100%', 
    height: 200, 
    resizeMode: 'contain'
  },
  submitBtn: { 
    backgroundColor: '#f43f5e', 
    padding: 15, 
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 10
  },
  submitText: {
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16
  }
});
