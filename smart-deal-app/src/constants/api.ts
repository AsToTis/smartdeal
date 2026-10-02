import { Platform } from 'react-native';

const IP_ADDRESS = __DEV__ ? '172.20.10.2' : '202.28.34.205';
export const BASE_URL = `http://${IP_ADDRESS}:5000/api`;
export const SERVER_URL = `http://${IP_ADDRESS}:5000`;
