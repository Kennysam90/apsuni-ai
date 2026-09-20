import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { listWallets } from '../services/api';
import { formatMoney, useCurrency } from '../services/currency';

type Wallet = Record<string, any>;

const walletName = (wallet: Wallet, index: number) => wallet.name || wallet.wallet_name || wallet.currency || `Wallet ${index + 1}`;
const walletBalance = (wallet: Wallet) => formatMoney(wallet.balance ?? wallet.amount ?? wallet.available_balance ?? 0, { decimals: false });

export default function WalletPicker() {
  useCurrency(); // re-render balances if the user's currency changes
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Wallet | null>(null);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const availableWallets = await listWallets();
      setWallets(availableWallets);
      setSelected((current) => current ?? availableWallets[0] ?? null);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWallets();
  }, []);

  const toggle = async () => {
    if (visible) return setVisible(false);
    setVisible(true);
    if (wallets.length === 0) await loadWallets();
  };

  return <View style={styles.control}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="My wallets" activeOpacity={0.75} style={styles.walletButton} onPress={toggle}>
      <LinearGradient colors={['#2563EB', '#3B82F6', '#60A5FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.proPill}>
        <Ionicons name="wallet-outline" size={21} color="#FFFFFF" />
      {selected && <Text numberOfLines={1} style={styles.amount}>{walletBalance(selected)}</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show wallets" activeOpacity={0.75} style={styles.arrowButton} onPress={toggle}>
      <Feather name={visible ? 'chevron-up' : 'chevron-down'} size={17} color="#FFFFFF" />
    </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
    
    {visible && <View style={styles.menu}>
      <Text style={styles.menuTitle}>My wallets</Text>
      {loading ? <ActivityIndicator color="#60A5FA" style={styles.loader} /> : wallets.length === 0 ? <Text style={styles.empty}>No wallets found.</Text> : wallets.map((wallet, index) => {
        const isSelected = selected === wallet;
        return <TouchableOpacity key={String(wallet.id ?? wallet.wallet_id ?? index)} activeOpacity={0.75} style={[styles.row, isSelected && styles.rowSelected]} onPress={() => { setSelected(wallet); setVisible(false); }}>
          <View><Text style={styles.name}>{walletName(wallet, index)}</Text><Text style={styles.balance}>{walletBalance(wallet)}</Text></View>
          {isSelected && <Feather name="check" size={18} color="#60A5FA" />}
        </TouchableOpacity>;
      })}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  control: { position: 'relative', flexDirection: 'row', alignItems: 'center', right: -10 },
  walletButton: { minWidth: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  proPill: { minWidth: 36, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  amount: { maxWidth: 64, marginLeft: 4, color: '#BFDBFE', fontSize: 11, fontWeight: '700' },
  arrowButton: { width: 20, height: 36, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', top: 44, left: -20, width: 100, maxHeight: 260, padding: 12, borderRadius: 14, backgroundColor: '#132033', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.35)', elevation: 8, zIndex: 20 },
  menuTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  loader: { marginVertical: 14 }, empty: { color: '#94A3B8', fontSize: 13, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 }, rowSelected: { backgroundColor: 'rgba(37, 99, 235, 0.25)' },
  name: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' }, balance: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
});
