import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import BackButton from './BackButton';
import CartDrawer from './CartDrawer';
import WalletPicker from './WalletPicker';
import { subscribeToCartCount, viewCart } from '../services/api';

type AppHeaderProps = { onBack?: () => void; onCart?: () => void; onNotification?: () => void; title?: string };

export default function AppHeader({ onBack, onCart, onNotification, title }: AppHeaderProps) {
  const router = useRouter();
  const [cartVisible, setCartVisible] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const openCart = () => onCart ? onCart() : setCartVisible(true);

  useEffect(() => {
    viewCart().then((result) => setCartCount(result.total_items || 0)).catch(() => setCartCount(0));
    return subscribeToCartCount(setCartCount);
  }, []);

  return <>
    <View style={styles.header}>
      <View style={styles.headerLeftActions}>
        <BackButton onBack={onBack} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Notifications" activeOpacity={0.75} style={styles.headerIconButton} onPress={onNotification}><Feather name="bell" size={20} color="#FFFFFF" /></TouchableOpacity>
      </View>
      <View style={styles.headerRightActions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open cart" activeOpacity={0.75} style={styles.headerIconButton} onPress={openCart}>
          <Feather name="shopping-cart" size={21} color="#FFFFFF" />
          {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View>}
        </TouchableOpacity>
        <WalletPicker />
      </View>
    </View>
    {!onCart && <CartDrawer visible={cartVisible} onClose={() => setCartVisible(false)} />}
  </>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 12, zIndex: 10 },
  headerLeftActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' }, headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', right: -10, backgroundColor: 'rgba(255, 255, 255, 0.1)' }, proPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }, crown: { marginRight: 6 }, proText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cartBadge: { position: 'absolute', top: -3, right: -4, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#0F1B2D' },
  cartBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
