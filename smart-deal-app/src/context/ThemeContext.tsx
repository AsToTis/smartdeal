import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type ThemeType = 'light' | 'dark';

interface ThemeContextProps {
  theme: ThemeType;
  toggleTheme: () => void;
  setThemeState: (dark: boolean) => void;
  isDark: boolean;
  colors: {
    background: string;
    card: string;
    text: string;
    subText: string;
    border: string;
    primary: string;
    iconBg: string;
  };
}

const lightColors = {
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  subText: '#64748b',
  border: '#f1f5f9',
  primary: '#16a34a',
  iconBg: '#f1f5f9',
};

const darkColors = {
  background: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  subText: '#94a3b8',
  border: '#334155',
  primary: '#16a34a',
  iconBg: '#334155',
};

const ThemeContext = createContext<ThemeContextProps>({
  theme: 'light',
  toggleTheme: () => {},
  setThemeState: () => {},
  isDark: false,
  colors: lightColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedPrefs = await AsyncStorage.getItem('appSettings');
        if (storedPrefs) {
          const parsed = JSON.parse(storedPrefs);
          if (parsed.darkMode !== undefined) {
            setTheme(parsed.darkMode ? 'dark' : 'light');
          }
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      const storedPrefs = await AsyncStorage.getItem('appSettings');
      let parsed = storedPrefs ? JSON.parse(storedPrefs) : {};
      parsed.darkMode = newTheme === 'dark';
      await AsyncStorage.setItem('appSettings', JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const setThemeState = (dark: boolean) => {
    setTheme(dark ? 'dark' : 'light');
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeState, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
