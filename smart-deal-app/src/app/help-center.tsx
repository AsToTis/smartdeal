import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

export default function HelpCenterScreen() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim()) return Alert.alert('แจ้งเตือน', 'กรุณาระบุหัวข้อร้องเรียน');
    if (!message.trim()) return Alert.alert('แจ้งเตือน', 'กรุณาระบุรายละเอียดข้อร้องเรียน');

    setIsSubmitting(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      let userId = 2;
      if (userData) {
        userId = JSON.parse(userData).user_id;
      }

      const formData = new FormData();
      formData.append('user_id', String(userId));
      formData.append('subject', subject.trim());
      formData.append('message', message.trim());
      
      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'complaint_image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('image', { uri: imageUri, name: filename, type } as any);
      }

      const response = await axios.post(`${BASE_URL}/complaints`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        Alert.alert('สำเร็จ', 'ส่งเรื่องร้องเรียนของคุณไปยังระบบเรียบร้อยแล้ว แอดมินจะดำเนินการตรวจสอบโดยเร็วที่สุด', [
          { text: 'ตกลง', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('ผิดพลาด', response.data?.message || 'ไม่สามารถส่งเรื่องร้องเรียนได้');
      }
    } catch (error: any) {
      console.error('Submit Complaint Error:', error);
      Alert.alert('ผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ศูนย์ความช่วยเหลือ</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.description}>
            หากคุณพบปัญหาในการใช้งานแอปพลิเคชัน ร้านค้า สินค้า หรือบริการ สามารถแจ้งให้เราทราบผ่านแบบฟอร์มด้านล่างนี้
          </Text>

          <Text style={styles.label}>หัวข้อร้องเรียน <Text style={{ color: '#ef4444' }}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="เช่น อาหารได้ไม่ครบ, อาหารมีสิ่งเจือปน, พฤติกรรมคนขับ"
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.label}>รายละเอียดเพิ่มเติม <Text style={{ color: '#ef4444' }}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="อธิบายเหตุการณ์ หรือปัญหาที่คุณพบเจออย่างละเอียด..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          <Text style={styles.label}>หลักฐานภาพถ่าย (ถ้ามี)</Text>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                <MaterialIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
              <MaterialIcons name="add-photo-alternate" size={32} color="#94a3b8" />
              <Text style={styles.uploadBtnText}>อัปโหลดรูปภาพ</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.submitBtn, isSubmitting ? styles.submitBtnDisabled : null]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitBtnText}>{isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งเรื่องร้องเรียน'}</Text>
          </TouchableOpacity>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 20,
  },
  textArea: {
    height: 120,
  },
  uploadBtn: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    backgroundColor: '#ffffff',
  },
  uploadBtnText: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 14,
  },
  imagePreviewContainer: {
    marginBottom: 32,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 200,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
