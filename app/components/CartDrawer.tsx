import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getApiAssetUrl, listWallets, payCartWithWallet, viewCart } from '../services/api';
import { formatMoney } from '../services/currency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const cartItems = (cart: Record<string, any> | null): Record<string, any>[] => [cart?.items, cart?.cart_items, cart?.products, cart?.data].find(Array.isArray) || [];
const itemName = (item: Record<string, any>, index: number) => item.title || item.name || item.product?.title || item.product?.name || `Project ${index + 1}`;
const PRICE_KEYS = ['price', 'total_product_price', 'total_price', 'total', 'unit_price', 'amount', 'sub_total', 'subtotal'];
// The cart payload nests the price differently per backend version, so take the first positive number found.
const itemPrice = (item: Record<string, any>): number => {
  for (const source of [item, item.product, item.editory, item.product_details]) {
    if (!source) continue;
    for (const key of PRICE_KEYS) { const value = Number(source[key]); if (value > 0) return value; }
  }
  return 0;
};
const itemImage = (item: Record<string, any>) => item.image || item.product?.image || item.product_image;

const DEFAULT_CURRENCY = 'USDTTRC20';
const walletFunds = (wallet: Record<string, any>) => Number(wallet.balance ?? 0) || 0;
type PayResult = { ok: boolean; title: string; message: string };

type CartDrawerProps = { visible: boolean; onClose: () => void };

export default function CartDrawer({ visible, onClose }: CartDrawerProps) {
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [cart, setCart] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [walletName, setWalletName] = useState('wallet');

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(SCREEN_WIDTH);
    setCart(null);
    setLoading(true);
    requestAnimationFrame(() => Animated.timing(translateX, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start());
    viewCart().then((result) => setCart(result.data)).catch(() => setCart(null)).finally(() => setLoading(false));
  }, [translateX, visible]);

  const close = () => Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 460, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onClose(); });

  const total = cartItems(cart).reduce((sum, item) => sum + itemPrice(item), 0);

  const pay = async () => {
    setPaying(true);
    try {
      const wallets = await listWallets().catch(() => []);
      if (Array.isArray(wallets) && !wallets.some((wallet) => walletFunds(wallet) >= total)) throw new Error('None of your wallets has enough funds for this order. Please fund a wallet and try again.');
      const response = await payCartWithWallet(DEFAULT_CURRENCY);
      if (response.status === false) throw new Error(response.message || 'The payment could not be completed.');
      setCart(null);
      setConfirmVisible(false);
      setResult({ ok: true, title: 'Payment successful', message: [response.message, response.data?.latest_receipt?.receipt_id && `Receipt: ${response.data.latest_receipt.receipt_id}`].filter(Boolean).join('\n') || 'Your projects have been purchased.' });
    } catch (error) {
      setConfirmVisible(false);
      setResult({ ok: false, title: 'Payment failed', message: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      setPaying(false);
    }
  };

  const openConfirm = async () => {
    const wallets = await listWallets().catch(() => []);
    const funded = (Array.isArray(wallets) ? wallets : []).filter((wallet) => walletFunds(wallet) >= total).sort((a, b) => walletFunds(b) - walletFunds(a))[0];
    setWalletName(funded ? `${funded.name} (${funded.account_type})` : 'wallet');
    setConfirmVisible(true);
  };

  return <Modal visible={visible} animationType="none" transparent onRequestClose={close}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <ScrollView contentContainerStyle={styles.items}>
          {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#86EFAC" /><Text style={styles.muted}>Loading your cart...</Text></View> : cartItems(cart).length === 0 ? <View style={styles.center}><Feather name="shopping-cart" size={30} color="#64748B" /><Text style={styles.muted}>Your cart is empty.</Text></View> : cartItems(cart).map((item, index) => <View key={String(item.id ?? item.product_id ?? index)} style={styles.item}>{itemImage(item) ? <Image source={{ uri: getApiAssetUrl(itemImage(item)) ?? itemImage(item) }} style={styles.itemImage} resizeMode="contain" /> : <View style={styles.itemIcon}><Feather name="file-text" size={19} color="#86EFAC" /></View>}<View style={styles.itemInfo}><Text numberOfLines={2} style={styles.itemName}>{itemName(item, index)}</Text><Text style={styles.itemMeta}></Text></View><Text style={styles.price}>{formatMoney(itemPrice(item))}</Text></View>)}
        </ScrollView>
        <View style={styles.footer}><TouchableOpacity style={[styles.checkout, cartItems(cart).length === 0 && { opacity: 0.5 }]} disabled={loading || cartItems(cart).length === 0} onPress={openConfirm}><Text style={styles.checkoutText}>Checkout</Text><Feather name="arrow-right" size={18} color="#052E16" /></TouchableOpacity></View>
      </Animated.View>
      <Modal visible={confirmVisible || !!result} transparent animationType="fade" onRequestClose={() => !paying && (setConfirmVisible(false), setResult(null))}>
        <View style={styles.popupBackdrop}>
          <View style={styles.popup}>
            {result ? <>
              <View style={[styles.badge, { backgroundColor: result.ok ? '#153526' : '#3B1820' }]}><Feather name={result.ok ? 'check' : 'x'} size={34} color={result.ok ? '#86EFAC' : '#FCA5A5'} /></View>
              <Text style={styles.popupTitle}>{result.title}</Text>
              <Text style={styles.popupText}>{result.message}</Text>
              <TouchableOpacity style={[styles.checkout, styles.popupButton, !result.ok && { backgroundColor: '#FCA5A5' }]} onPress={() => { const ok = result.ok; setResult(null); if (ok) close(); }}><Text style={[styles.checkoutText, !result.ok && { color: '#450A0A' }]}>{result.ok ? 'Done' : 'Try again'}</Text></TouchableOpacity>
            </> : <>
              <View style={[styles.badge, { backgroundColor: '#153526' }]}><Feather name="credit-card" size={30} color="#86EFAC" /></View>
              <Text style={styles.popupTitle}>Confirm payment</Text>
              <Text style={styles.popupText}>Pay {formatMoney(total)} for {cartItems(cart).length} item{cartItems(cart).length === 1 ? '' : 's'} from your {walletName} wallet.</Text>
              <TouchableOpacity style={[styles.checkout, styles.popupButton]} disabled={paying} onPress={pay}>{paying ? <ActivityIndicator color="#052E16" /> : <Text style={styles.checkoutText}>Pay now</Text>}</TouchableOpacity>
              <TouchableOpacity disabled={paying} onPress={() => setConfirmVisible(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
            </>}
          </View>
        </View>
      </Modal>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.68)', alignItems: 'flex-end' }, drawer: { width: '70%', maxWidth: 390, height: '95%', backgroundColor: '#0F1B2D', paddingTop: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#26364E' }, title: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' }, close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E2E45' },
  items: { padding: 16, gap: 10, flexGrow: 1 }, center: { flex: 1, minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 12 }, muted: { color: '#CBD5E1', fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#17263B', gap: 10 }, itemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#153526' }, itemInfo: { flex: 1 }, itemName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' }, itemMeta: { color: '#94A3B8', fontSize: 11, marginTop: 3 }, price: { color: '#86EFAC', fontSize: 13, fontWeight: '700' },
  popupBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  popup: { width: '100%', maxWidth: 340, backgroundColor: '#0F1B2D', borderRadius: 22, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#26364E' },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  popupTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' }, popupText: { color: '#CBD5E1', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  popupButton: { alignSelf: 'stretch', marginTop: 6 }, cancel: { color: '#94A3B8', fontSize: 14, fontWeight: '700', paddingVertical: 6 },
  itemImage: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#0F172A' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#26364E', backgroundColor: '#112036' }, checkout: { minHeight: 50, borderRadius: 12, backgroundColor: '#86EFAC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, checkoutText: { color: '#052E16', fontSize: 15, fontWeight: '800' },
});
