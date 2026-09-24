import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, Image, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('test@gmail.com');
  const [password, setPassword] = useState('123456password');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกอีเมล/เบอร์โทร และรหัสผ่าน');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${BASE_URL}/login`, { identifier, password });

      if (res.data?.user) {
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        if (res.data.user.is_seller && res.data.user.shop_data?.shop_id) {
          await AsyncStorage.setItem('shop_id', String(res.data.user.shop_data.shop_id));
        } else {
          await AsyncStorage.removeItem('shop_id');
        }
      }

      Alert.alert('สำเร็จ', 'เข้าสู่ระบบเรียบร้อยแล้ว', [
        {
          text: 'เข้าสู่แอป',
          onPress: () => router.replace('/(tabs)')
        }
      ]);
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.skipBtn}>
            <Text style={styles.skipText}>ข้ามไปก่อน</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.brandTitle}>Smart Deal ⚡</Text>
        <Text style={styles.brandSubtitle}>อาหารสดส่วนเกิน ลดสูงสุด 70%</Text>

        <View style={styles.card}>
          <Text style={styles.title}>เข้าสู่ระบบ</Text>
          <Text style={styles.subtitle}>กรอกข้อมูลเพื่อเข้าใช้งานบัญชีของคุณ</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>อีเมล หรือ เบอร์โทรศัพท์</Text>
            <TextInput 
              style={styles.input} 
              placeholder="test@gmail.com หรือ 0812345678" 
              value={identifier} 
              onChangeText={setIdentifier}
              autoCapitalize="none"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>รหัสผ่าน</Text>
            <View style={styles.passwordWrapper}>
              <TextInput 
                style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]} 
                placeholder="••••••••" 
                secureTextEntry={!showPassword} 
                value={password} 
                onChangeText={setPassword}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={{ color: '#64748b', fontSize: 13 }}>ยังไม่มีบัญชี?</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}> สมัครสมาชิกที่นี่</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContainer: { padding: 20, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#e2e8f0' },
  skipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  brandTitle: { fontSize: 26, fontWeight: 'bold', color: '#16a34a', textAlign: 'center' },
  brandSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, color: '#0f172a' },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingRight: 10 },
  eyeBtn: { padding: 8 },
  primaryButton: { backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  registerLink: { color: '#16a34a', fontWeight: 'bold', fontSize: 13 }
});