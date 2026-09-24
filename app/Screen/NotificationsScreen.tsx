import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import AppBackground from '../components/AppBackground';
import AppHeader from '../components/AppHeader';
import { getNotifications } from '../services/api';
import { ingestNotifications, isNotificationUnread, markNotificationsRead, notificationKey, notificationListFrom } from '../services/notificationCenter';

import { friendlyError } from '../services/errors';
type Item = { key: string; title: string; body: string; time: Date | null; unread: boolean; icon: keyof typeof Feather.glyphMap; tint: string };

const KIND_STYLES: Record<string, { icon: keyof typeof Feather.glyphMap; tint: string }> = {
  payment: { icon: 'credit-card', tint: '#34C759' },
  order: { icon: 'package', tint: '#FF9F0A' },
  wallet: { icon: 'briefcase', tint: '#0A84FF' },
  security: { icon: 'shield', tint: '#FF453A' },
  message: { icon: 'message-circle', tint: '#5E5CE6' },
};
const DEFAULT_KIND = { icon: 'bell' as const, tint: '#0A84FF' };

// The API's field names vary, so read the common ones and fall back to sensible text.
const toItem = (raw: any, index: number): Item => {
  const kindText = String(raw.type ?? raw.category ?? raw.kind ?? '').toLowerCase();
  const kind = Object.keys(KIND_STYLES).find((key) => kindText.includes(key));
  const created = raw.created_at ?? raw.timestamp ?? raw.date ?? raw.time;
  const date = created ? new Date(created) : null;
  return {
    key: notificationKey(raw, index),
    title: String(raw.title ?? raw.subject ?? raw.type ?? 'Apsuni'),
    body: String(raw.message ?? raw.body ?? raw.text ?? raw.description ?? '').replace(/<[^>]*>/g, '').trim(),
    time: date && !Number.isNaN(date.getTime()) ? date : null,
    unread: isNotificationUnread(notificationKey(raw, index)),
    ...(kind ? KIND_STYLES[kind] : DEFAULT_KIND),
  };
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const sectionOf = (time: Date | null) => {
  if (!time) return 'Earlier';
  const days = Math.round((startOfDay(new Date()) - startOfDay(time)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return days < 7 ? 'Previous 7 Days' : 'Earlier';
};

const relative = (time: Date | null) => {
  if (!time) return '';
  const minutes = Math.floor((Date.now() - time.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Earlier'];

export default function NotificationsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const raw = notificationListFrom(await getNotifications());
      await ingestNotifications(raw);
      const parsed = raw.map((entry, index) => toItem(entry, index));
      parsed.sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0));
      setItems(parsed);
    } catch (requestError) {
      setError(friendlyError(requestError, 'Could not load notifications.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => ORDER
    .map((title) => ({ title, data: items.filter((item) => sectionOf(item.time) === title) }))
    .filter((section) => section.data.length > 0), [items]);

  const unreadCount = items.filter((item) => item.unread).length;
  const markRead = (key: string) => { markNotificationsRead([key]); setItems((current) => current.map((item) => item.key === key ? { ...item, unread: false } : item)); };
  const dismiss = (key: string) => { markNotificationsRead([key]); setItems((current) => current.filter((item) => item.key !== key)); };

  return <View style={styles.screen}>
    <AppBackground />
    <View style={styles.overlay} />
    <SafeAreaView style={styles.safe}>
    <AppHeader />
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#FFFFFF" /></View> : <SectionList
      sections={sections}
      keyExtractor={(item) => item.key}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#FFFFFF" />}
      ListHeaderComponent={<View style={styles.titleBlock}>
        <View style={{ flex: 1 }}>
          {unreadCount > 0 ? <Text style={styles.subtitle}>{unreadCount} unread</Text> : null}
        </View>
        <TouchableOpacity accessibilityLabel="Mark all as read" disabled={unreadCount === 0} style={[styles.pill, unreadCount === 0 && { opacity: 0.4 }]} onPress={() => { markNotificationsRead(items.filter((item) => item.unread).map((item) => item.key)); setItems((current) => current.map((item) => ({ ...item, unread: false }))); }}>
          <Feather name="check-circle" size={14} color="#FFFFFF" /><Text style={styles.pillText}>Read all</Text>
        </TouchableOpacity>
      </View>}
      ListEmptyComponent={<View style={styles.center}>
        <View style={styles.emptyIcon}><Feather name={error ? 'wifi-off' : 'bell-off'} size={30} color="#FFFFFF" /></View>
        <Text style={styles.emptyTitle}>{error ? 'Couldn’t load notifications' : 'No Notifications'}</Text>
        <Text style={styles.emptyText}>{error ?? 'You’re all caught up. New activity will show up here.'}</Text>
        {error ? <TouchableOpacity style={styles.retry} onPress={() => load()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity> : null}
      </View>}
      renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
      renderItem={({ item }) => <TouchableOpacity activeOpacity={0.85} style={styles.card} onPress={() => markRead(item.key)} onLongPress={() => dismiss(item.key)}>
        <View style={[styles.appIcon, { backgroundColor: item.tint }]}><Feather name={item.icon} size={20} color="#FFFFFF" /></View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTime}>{relative(item.time)}</Text>
          </View>
          {item.body ? <Text numberOfLines={3} style={styles.cardText}>{item.body}</Text> : null}
        </View>
        {item.unread ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>}
    />}
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(120, 120, 128, 0.36)' },
  pillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 60, flexGrow: 1 },
  safe: { flex: 1 },
  titleBlock: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10 },
  title: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { color: 'rgba(235, 235, 245, 0.6)', fontSize: 15, marginTop: 2 },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', paddingHorizontal: 6, paddingTop: 18, paddingBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, marginBottom: 8, borderRadius: 22, backgroundColor: 'rgba(44, 44, 46, 0.82)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.14)' },
  appIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cardTime: { color: 'rgba(235, 235, 245, 0.55)', fontSize: 13 },
  cardText: { color: 'rgba(235, 235, 245, 0.85)', fontSize: 14, lineHeight: 19, marginTop: 2 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#0A84FF', marginTop: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(120, 120, 128, 0.36)', marginBottom: 16 },
  emptyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  emptyText: { color: 'rgba(235, 235, 245, 0.6)', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  retry: { marginTop: 18, paddingHorizontal: 22, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A84FF' },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
