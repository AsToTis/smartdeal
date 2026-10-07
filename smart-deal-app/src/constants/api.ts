import { Platform } from 'react-native';

// เดิม
// const IP_ADDRESS = __DEV__ ? '172.20.10.2' : '202.28.34.205';
// export const BASE_URL = `http://${IP_ADDRESS}:5000/api`;
// export const SERVER_URL = `http://${IP_ADDRESS}:5000`;

// ใหม่ (Render)
export const SERVER_URL = 'https://smartdeal-backend-vhjo.onrender.com';
export const BASE_URL = `${SERVER_URL}/api`;
