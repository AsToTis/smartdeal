import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  Platform,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

interface NotificationBannerData {
  id?: string | number;
  title: string;
  message: string;
  type?: 'order' | 'auction' | 'chat' | 'system' | 'wallet' | string;
  referenceId?: string | number;
}

interface NotificationContextType {
  unreadCount: number;
  showBanner: (data: NotificationBannerData) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  showBanner: () => {},
  refreshNotifications: async () => {},
});

export const useInAppNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentBanner, setCurrentBanner] = useState<NotificationBannerData | null>(null);
  
  const lastSeenNotifIdRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const hideTimerRef = useRef<any>(null);

  // Animation values
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Swipe up to dismiss PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20 || gestureState.vy < -0.5) {
          hideBanner();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  const hideBanner = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentBanner(null);
    });
  }, [translateY, opacity]);

  const showBanner = useCallback((data: NotificationBannerData) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    setCurrentBanner(data);
    translateY.setValue(-150);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after 5 seconds
    hideTimerRef.current = setTimeout(() => {
      hideBanner();
    }, 5000);
  }, [hideBanner, translateY, opacity]);

  const handleBannerPress = () => {
    if (!currentBanner) return;
    const banner = currentBanner;
    hideBanner();

    if (banner.type === 'order' && banner.referenceId) {
      router.push(`/tracking?id=${banner.referenceId}` as any);
    } else {
      router.push('/notifications');
    }
  };

  const fetchLatestNotifications = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      let userId = 2;
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u?.user_id) userId = u.user_id;
      }

      const res = await axios.get(`${BASE_URL}/notifications/${userId}`);
      if (res.data?.success && Array.isArray(res.data.notifications)) {
        const notifs = res.data.notifications;
        const unread = notifs.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);

        if (notifs.length > 0) {
          const latest = notifs[0];
          const latestId = latest.notification_id || latest.id;

          if (isInitialLoadRef.current) {
            lastSeenNotifIdRef.current = latestId;
            isInitialLoadRef.current = false;
          } else if (lastSeenNotifIdRef.current !== null && latestId > lastSeenNotifIdRef.current) {
            // New notification detected!
            lastSeenNotifIdRef.current = latestId;
            showBanner({
              id: latestId,
              title: latest.title,
              message: latest.message || latest.body || '',
              type: latest.type || 'order',
              referenceId: latest.reference_id,
            });
          }
        }
      }
    } catch (e) {
      // Ignore network errors in background poll
    }
  };

  useEffect(() => {
    fetchLatestNotifications();
    const interval = setInterval(fetchLatestNotifications, 3500);
    return () => {
      clearInterval(interval);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showBanner]);

  const getIconForType = (type?: string, title: string = '') => {
    if (title.includes('ไรเดอร์') || type === 'rider') {
      return (
        <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
          <MaterialIcons name="two-wheeler" size={24} color="#16a34a" />
        </View>
      );
    }
    if (title.includes('ร้านค้า') || title.includes('เตรียม') || title.includes('👨‍🍳')) {
      return (
        <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
          <MaterialIcons name="restaurant" size={24} color="#ea580c" />
        </View>
      );
    }
    if (title.includes('สำเร็จ') || title.includes('เสร็จ') || title.includes('🎉') || title.includes('✅')) {
      return (
        <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
          <MaterialIcons name="check-circle" size={24} color="#2563eb" />
        </View>
      );
    }
    if (title.includes('ยกเลิก') || title.includes('❌')) {
      return (
        <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
          <MaterialIcons name="cancel" size={24} color="#ef4444" />
        </View>
      );
    }
    if (type === 'auction' || title.includes('ประมูล')) {
      return (
        <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
          <MaterialIcons name="gavel" size={24} color="#d97706" />
        </View>
      );
    }
    return (
      <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
        <MaterialIcons name="local-mall" size={24} color="#16a34a" />
      </View>
    );
  };

  const topOffset = Platform.OS === 'ios' ? Math.max(insets.top, 44) + 6 : 16;

  return (
    <NotificationContext.Provider value={{ unreadCount, showBanner, refreshNotifications: fetchLatestNotifications }}>
      {children}

      {/* Floating In-App Push Notification Banner */}
      {currentBanner && (
        <Animated.View
          style={[
            styles.bannerWrapper,
            {
              top: topOffset,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            style={styles.bannerContainer}
            activeOpacity={0.9}
            onPress={handleBannerPress}
          >
            {/* Header info */}
            <View style={styles.bannerHeader}>
              <View style={styles.appBrand}>
                <View style={styles.appIconCircle}>
                  <MaterialIcons name="bolt" size={14} color="#fff" />
                </View>
                <Text style={styles.appName}>SmartDeal</Text>
                <Text style={styles.dotSeparator}>•</Text>
                <Text style={styles.timeAgo}>เมื่อสักครู่</Text>
              </View>
              <TouchableOpacity onPress={hideBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Content Row */}
            <View style={styles.bannerBody}>
              {getIconForType(currentBanner.type, currentBanner.title)}
              <View style={styles.textContainer}>
                <Text style={styles.bannerTitle} numberOfLines={1}>
                  {currentBanner.title}
                </Text>
                <Text style={styles.bannerMessage} numberOfLines={2}>
                  {currentBanner.message}
                </Text>
              </View>
            </View>

            {/* Grab indicator line */}
            <View style={styles.grabHandle} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  bannerWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 999999,
  },
  bannerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  appName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  dotSeparator: {
    fontSize: 12,
    color: '#94a3b8',
    marginHorizontal: 6,
  },
  timeAgo: {
    fontSize: 11,
    color: '#64748b',
  },
  bannerBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  bannerMessage: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 8,
  },
});
