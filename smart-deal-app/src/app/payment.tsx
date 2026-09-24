import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Image, ActivityIndicator, Alert, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { BASE_URL } from '../constants/api';
import { useCart } from '../context/CartContext';

// เบอร์ PromptPay หรือ เลขประจำตัวผู้เสียภาษีของ "บัญชีกลางระบบ"
const SYSTEM_PROMPTPAY_ID = '0817466755';

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const orderId = params.order_id ? Number(params.order_id) : null;
  const amount = params.amount ? Number(params.amount) : 0;
  const shopId = params.shop_id ? Number(params.shop_id) : 1;

  const { clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [chargeId, setChargeId] = useState<string | null>(null);

  // 1. นับเวลาถอยหลัง QR หมดอายุ (15 นาที = 900 วินาที)
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  useEffect(() => {
    let isMounted = true;
    const fetchQR = async () => {
      if (amount > 0 && orderId) {
        try {
          const res = await axios.post(`${BASE_URL}/payment/generate-qr`, {
            order_id: orderId,
            total_amount: amount
          });
          if (isMounted && res.data.success) {
            setQrUrl(res.data.qrImage);
            setChargeId(res.data.charge_id);
          }
        } catch (error) {
          console.error("Failed to generate QR", error);
        }
      }
    };
    fetchQR();
    return () => { isMounted = false; };
  }, [amount, orderId]);

  // Polling for payment status
  useEffect(() => {
    if (!orderId || !chargeId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${BASE_URL}/payment/status/${orderId}`);
        if (res.data.success && res.data.payment_status === 'paid') {
          clearInterval(interval);
          handlePaymentSuccess();
        }
      } catch (error) {
        console.error("Error polling status", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId, chargeId]);

  const handlePaymentSuccess = () => {
    clearCart();
    Alert.alert('สำเร็จ', 'ชำระเงินเรียบร้อยแล้ว!', [
      {
        text: 'ดูประวัติคำสั่งซื้อ',
        onPress: () => router.replace('/(tabs)/orders' as any)
      }
    ]);
  };

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // จัดการการกดย้อนกลับ
  const handleBack = () => {
    Alert.alert(
      'ยกเลิกการชำระเงิน?',
      'รายการสินค้าจะยังคงอยู่ในตะกร้าจนกว่าคุณจะชำระเงินสำเร็จ',
      [
        { text: 'ทำรายการต่อ', style: 'cancel' },
        { text: 'ย้อนกลับ', onPress: () => router.back() }
      ]
    );
  };

  // 2. บันทึกรูปภาพ QR Code
  const handleSaveQR = async () => {
    if (!qrUrl) return;
    try {
      setSaving(true);
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const filename = `${baseDir}QR_Order_${orderId || 'payment'}.png`;
      
      const downloadRes = await FileSystem.downloadAsync(qrUrl, filename);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri);
      } else {
        Alert.alert('สำเร็จ', 'บันทึกภาพ QR Code เรียบร้อยแล้ว');
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกภาพ QR Code ได้');
    } finally {
      setSaving(false);
    }
  };

  // 3. ทางลัดเปิดแอปธนาคาร (Deep Linking)
  const openBankApp = async (scheme: string, bankName: string) => {
    try {
      const supported = await Linking.canOpenURL(scheme);
      if (supported) {
        await Linking.openURL(scheme);
      } else {
        Alert.alert('เปิดแอปธนาคาร', `ระบบกำลังเปิด/จำลองแอป ${bankName}`);
      }
    } catch (error) {
      Alert.alert('แจ้งเตือน', `ไม่สามารถเปิดแอป ${bankName} ได้`);
    }
  };

  const banks = [
    { name: 'SCB EASY', code: 'SCB', bg: '#4e2a84', scheme: 'scbeasy://' },
    { name: 'K PLUS', code: 'K+', bg: '#00a950', scheme: 'kplus://' },
    { name: 'KMA', code: 'KMA', bg: '#fbb034', scheme: 'kma://' },
    { name: 'Bualuang', code: 'BBL', bg: '#0033a0', scheme: 'bblmbanking://' },
  ];

  // 4. ตรวจสอบสถานะการชำระเงิน (พร้อมจำลองการชำระเงินสำเร็จ)
  const handleConfirmPayment = async () => {
    if (!orderId) {
      Alert.alert('ผิดพลาด', 'ไม่พบรหัสคำสั่งซื้อ');
      return;
    }

    try {
      setLoading(true);
      
      // === สำหรับการทดสอบ: จำลองให้ Webhook ของธนาคารส่งสถานะว่า "จ่ายแล้ว" ทันทีที่กดปุ่ม ===
      if (chargeId) {
        await axios.post(`${BASE_URL}/payment/webhook`, {
          charge_id: chargeId,
          status: 'successful'
        });
      }
      // ====================================================================

      const res = await axios.get(`${BASE_URL}/payment/status/${orderId}`);
      if (res.data.success && res.data.payment_status === 'paid') {
        handlePaymentSuccess();
      } else {
        Alert.alert('แจ้งเตือน', 'ยังไม่พบยอดชำระเงิน กรุณารอสักครู่แล้วลองใหม่');
      }
    } catch (error: any) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถตรวจสอบสถานะการชำระเงินได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header แบบจัดกลางสวยงาม */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ชำระเงินผ่าน PromptPay</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* การ์ดหลัก PromptPay */}
        <View style={styles.mainCard}>
          {/* แสดงยอดชำระเงินและรหัสคำสั่งซื้อด้านในการ์ด */}
          <Text style={styles.amountLabel}>ยอดชำระสุทธิ</Text>
          <Text style={styles.cardAmountText}>฿{amount.toFixed(2)}</Text>
          {orderId && <Text style={styles.orderSubText}>รหัสคำสั่งซื้อ #{orderId}</Text>}

          {/* PromptPay Badge */}
          <View style={styles.ppHeader}>
            <View style={styles.ppBadge}>
              <Text style={styles.ppBadgeText}>PromptPay</Text>
            </View>
            <Text style={styles.ppTitle}>PROMPTPAY</Text>
          </View>

          {/* กรอบ QR Code พร้อมมุมตกแต่ง */}
          <View style={styles.qrWrapper}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {qrUrl ? (
              <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
            ) : (
              <ActivityIndicator size="large" color="#2e7a32" />
            )}
          </View>

          {/* ข้อความกำกับ */}
          <Text style={styles.scanTitle}>สแกน QR เพื่อชำระเงิน</Text>
          <Text style={styles.scanSub}>
            โอนเข้าบัญชีกลางระบบ (<Text style={{ fontWeight: 'bold', color: '#111' }}>{SYSTEM_PROMPTPAY_ID}</Text>)
          </Text>

          {/* ตัวนับเวลาถอยหลัง */}
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={18} color="#ea580c" />
            <Text style={styles.timerText}>
              {timeLeft > 0 
                ? `QR Code จะหมดอายุใน ${formatTime(timeLeft)} นาที`
                : 'QR Code หมดอายุแล้ว กรุณาสร้างรายการใหม่'}
            </Text>
          </View>
        </View>

        {/* ส่วนทางลัด Mobile Banking */}
        <Text style={styles.bankSectionTitle}>หรือเลือกจำลองชำระเงินผ่าน MOBILE BANKING</Text>
        <View style={styles.bankRow}>
          {banks.map((bank, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.bankItem}
              onPress={() => openBankApp(bank.scheme, bank.name)}
            >
              <View style={[styles.bankCircle, { backgroundColor: bank.bg }]}>
                <Text style={styles.bankCode}>{bank.code}</Text>
              </View>
              <Text style={styles.bankName}>{bank.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ปุ่มบันทึกภาพ QR */}
        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSaveQR}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#111" />
          ) : (
            <>
              <MaterialIcons name="save-alt" size={20} color="#0f766e" />
              <Text style={styles.saveBtnText}>บันทึกภาพ QR</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ปุ่มยืนยันการชำระเงิน */}
        <TouchableOpacity 
          style={styles.confirmBtn} 
          onPress={handleConfirmPayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="reload-outline" size={22} color="#fff" />
              <Text style={styles.confirmBtnText}>ตรวจสอบสถานะการชำระเงิน</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ตราสัญลักษณ์ความปลอดภัย SSL */}
        <View style={styles.sslBadge}>
          <MaterialIcons name="verified-user" size={16} color="#10b981" />
          <Text style={styles.sslText}>SECURE PAYMENT SSL ENCRYPTED</Text>
        </View>

      </ScrollView>
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
    borderColor: '#f1f5f9'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },

  scrollContent: { padding: 16, alignItems: 'center' },

  mainCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  amountLabel: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  cardAmountText: { fontSize: 28, fontWeight: 'bold', color: '#16a34a', marginBottom: 2 },
  orderSubText: { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginBottom: 16 },

  ppHeader: { alignItems: 'center', marginBottom: 16 },
  ppBadge: {
    backgroundColor: '#002b49',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  ppBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  ppTitle: { fontSize: 14, fontWeight: 'bold', color: '#002b49', letterSpacing: 1 },

  qrWrapper: {
    width: 220,
    height: 220,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  qrImage: { width: 180, height: 180 },

  // มุมกรอบเขียวของ QR
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#10b981',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },

  scanTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginTop: 12 },
  scanSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  timerText: { fontSize: 13, color: '#ea580c', fontWeight: 'bold' },

  bankSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 14,
    textAlign: 'center',
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  bankItem: { alignItems: 'center', flex: 1 },
  bankCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  bankCode: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  bankName: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  saveBtnText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },

  confirmBtn: {
    backgroundColor: '#0f172a',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmBtnText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },

  sslBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  sslText: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 0.5 },
});