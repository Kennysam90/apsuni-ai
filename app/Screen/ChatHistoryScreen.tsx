import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getConversationHistory, type ConversationHistoryItem } from '../services/api';
import AppBackground from '../components/AppBackground';
import { useAppAlert } from '../components/AppAlert';
import AppHeader from '../components/AppHeader';

export default function ChatHistoryScreen() {
  const router = useRouter();
  const { showAlert } = useAppAlert();
  const [items, setItems] = useState<ConversationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      setItems(await getConversationHistory() as ConversationHistoryItem[]);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Could not load chat history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <AppBackground />
      <AppHeader />
      {loading ? <ActivityIndicator color="#60A5FA" style={styles.loader} /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length ? styles.list : styles.empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#60A5FA" />}
          ListEmptyComponent={<Text style={styles.emptyText}>No conversations yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/Screen/VoiceAssessmentScreen/VoiceAssessmentScreen', params: { conversationId: item.id } })}>
              <View style={styles.icon}><Feather name="message-circle" size={20} color="#60A5FA" /></View>
              <View style={styles.copy}><Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.preview} numberOfLines={2}>{item.preview || 'Continue this conversation'}</Text><Text style={styles.meta}>{item.message_count} messages</Text></View>
              <Feather name="chevron-right" size={20} color="#64748B" />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C11' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 62, paddingHorizontal: 20, paddingBottom: 24 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#172235', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#94A3B8', marginTop: 4 },
  loader: { marginTop: 40 },
  list: { padding: 20, paddingTop: 0, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 16 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#111A28', borderWidth: 1, borderColor: '#24334A' },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#172A47', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  copy: { flex: 1 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  preview: { color: '#CBD5E1', marginTop: 5, lineHeight: 19 },
  meta: { color: '#64748B', marginTop: 7, fontSize: 12 },
});
