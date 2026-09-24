import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { BASE_URL } from '../constants/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          phone: phone,
          password: password,
          role: 'buyer'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('สำเร็จ', 'สมัครสมาชิกเรียบร้อยแล้ว! กรุณาเข้าสู่ระบบ', [
          { text: 'ตกลง', onPress: () => router.replace('/login') }
        ]);
      } else {
        Alert.alert('สมัครสมาชิกไม่สำเร็จ', data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>สมัครสมาชิก 📝</Text>

      <TextInput
        style={styles.input}
        placeholder="ชื่อ - นามสกุล"
        value={fullName}
        onChangeText={setFullName}
      />

      <TextInput
        style={styles.input}
        placeholder="อีเมล (Email)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="เบอร์โทรศัพท์"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="รหัสผ่าน (Password)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.regBtn} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.regBtnText}>ยืนยันสมัครสมาชิก</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
        <Text style={styles.loginText}>มีบัญชีอยู่แล้ว? <Text style={styles.highlightText}>เข้าสู่ระบบ</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#e8e8e8' },
  regBtn: { backgroundColor: '#52c41a', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  regBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { color: '#595959', fontSize: 14 },
  highlightText: { color: '#52c41a', fontWeight: 'bold' },
});