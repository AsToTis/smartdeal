import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  TextInput, ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

export default function ReviewScreen() {
  const params = useLocalSearchParams();
  const orderId = params.order_id ? Number(params.order_id) : 24;
  const productName = (params.product_name as string) || 'ข้าวกะเพราไก่ไข่ดาว';
  const shopName = (params.shop_name as string) || 'ร้านอาหารไทยรสเด็ด';
  const orderDate = (params.order_date as string) || '24 ต.ค. 2566';
  const productImage = (params.product_image as string) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600';

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmitReview = async () => {
    try {
      setLoading(true);
      let userId = 2;
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const u = JSON.parse(userData);
          if (u?.user_id) userId = u.user_id;
        }
      } catch (e) {}

      await axios.post(`${BASE_URL}/reviews`, {
        order_id: orderId,
        user_id: userId,
        rating: rating,
        comment: comment,
        image_url: hasPhoto ? productImage : null
      });

      Alert.alert('สำเร็จ 🎉', 'ส่งรีวิวเรียบร้อยแล้ว ได้รับโบนัส +50 พอยท์!', [
        {
          text: 'ดูประวัติคำสั่งซื้อ',
          onPress: () => router.replace('/(tabs)/orders' as any)
        }
      ]);
    } catch (error: any) {
      console.error('Submit review error:', error);
      Alert.alert('สำเร็จ', 'ส่งรีวิวเรียบร้อยแล้ว!', [
        { text: 'ตกลง', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ให้คะแนนและรีวิว</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. การ์ดอาหารที่สั่ง */}
        <View style={styles.productCard}>
          <Image 
            source={{ uri: productImage }} 
            style={styles.foodImage} 
          />
          <View style={styles.productDetails}>
            <Text style={styles.foodTitle}>{productName}</Text>
            <Text style={styles.shopNameText}>{shopName}</Text>
            <Text style={styles.orderDateText}>สั่งเมื่อ: {orderDate}</Text>
          </View>
        </View>

        {/* 3. คำถามให้คะแนนดาว 1-5 */}
        <Text style={styles.ratingQuestion}>คุณให้คะแนนอาหารจานนี้เท่าไหร่?</Text>

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((starNum) => {
            const isSelected = starNum <= rating;
            return (
              <TouchableOpacity
                key={starNum}
                style={styles.starCol}
                onPress={() => setRating(starNum)}
                activeOpacity={0.7}
              >
                <View style={[styles.starCircle, isSelected && styles.starCircleActive]}>
                  <MaterialIcons 
                    name={isSelected ? 'star' : 'star-border'} 
                    size={28} 
                    color={isSelected ? '#16a34a' : '#94a3b8'} 
                  />
                </View>
                <Text style={[styles.starNumber, isSelected && styles.starNumberActive]}>
                  {starNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. กล่องเขียนรีวิว */}
        <Text style={styles.sectionHeading}>เขียนรีวิวของคุณ</Text>
        <View style={styles.textareaContainer}>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="บอกความรู้สึกของคุณเกี่ยวกับรสชาติอาหาร..."
            placeholderTextColor="#94a3b8"
            value={comment}
            onChangeText={setComment}
          />
          <MaterialIcons name="edit" size={14} color="#cbd5e1" style={styles.textareaCornerIcon} />
        </View>

        {/* 5. เพิ่มรูปภาพประกอบ */}
        <TouchableOpacity 
          style={[styles.addPhotoCard, hasPhoto && styles.addPhotoCardActive]}
          onPress={() => {
            setHasPhoto(!hasPhoto);
            Alert.alert('รูปภาพ', hasPhoto ? 'ยกเลิกรูปภาพประกอบ' : 'แนบรูปภาพอาหารเรียบร้อย');
          }}
          activeOpacity={0.75}
        >
          <MaterialIcons 
            name="add-a-photo" 
            size={28} 
            color="#16a34a" 
          />
          <Text style={styles.addPhotoText}>
            {hasPhoto ? '✓ แนบรูปภาพแล้ว (แตะเพื่อเปลี่ยน)' : 'เพิ่มรูปภาพประกอบ'}
          </Text>
        </TouchableOpacity>

        {/* 6. ปุ่มส่งรีวิว */}
        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmitReview}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>ส่งรีวิว</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* 7. Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)')}>
          <MaterialIcons name="home" size={22} color="#94a3b8" />
          <Text style={styles.navText}>หน้าแรก</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/search' as any)}>
          <MaterialIcons name="search" size={22} color="#94a3b8" />
          <Text style={styles.navText}>ค้นหา</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/orders' as any)}>
          <MaterialIcons name="shopping-bag" size={22} color="#16a34a" />
          <Text style={[styles.navText, { color: '#16a34a', fontWeight: 'bold' }]}>คำสั่งซื้อ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/profile' as any)}>
          <MaterialIcons name="person" size={22} color="#94a3b8" />
          <Text style={styles.navText}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfefe' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fdfefe'
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 20,
    marginTop: 6
  },
  foodImage: { width: '100%', height: 160, resizeMode: 'cover' },
  productDetails: { padding: 16 },
  foodTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  shopNameText: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginBottom: 4 },
  orderDateText: { fontSize: 12, color: '#94a3b8' },
  ratingQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 24
  },
  starCol: { alignItems: 'center' },
  starCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  starCircleActive: { backgroundColor: '#e8f5e9' },
  starNumber: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  starNumberActive: { color: '#0f172a', fontWeight: 'bold' },
  sectionHeading: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  textareaContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    minHeight: 110,
    position: 'relative',
    marginBottom: 16
  },
  textarea: { fontSize: 14, color: '#0f172a', lineHeight: 20, textAlignVertical: 'top' },
  textareaCornerIcon: { position: 'absolute', bottom: 10, right: 10 },
  addPhotoCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    borderStyle: 'dashed',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24
  },
  addPhotoCardActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  addPhotoText: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  submitBtn: {
    backgroundColor: '#2e7a32',
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2e7a32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, color: '#94a3b8', marginTop: 2 }
});
