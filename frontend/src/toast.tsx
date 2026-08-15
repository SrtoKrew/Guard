import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from './theme';

type ToastCtx = { show: (message: string, icon?: string) => void };
const ToastContext = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [icon, setIcon] = useState('check-circle');
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, ic?: string) => {
    setMessage(msg);
    setIcon(ic || 'check-circle');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    timeoutRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(16, { duration: 300 });
    }, 2200);
  }, [opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }, animStyle]}>
        <View style={styles.toast}>
          <MaterialCommunityIcons name={icon as any} size={18} color={theme.color.success} />
          <Text style={styles.text} numberOfLines={2}>{message}</Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 20, right: 20, alignItems: 'center', zIndex: 999,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingVertical: 10, paddingHorizontal: 16,
    maxWidth: '100%',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: theme.color.onSurface, fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
