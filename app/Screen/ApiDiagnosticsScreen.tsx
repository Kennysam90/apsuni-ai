import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import BackButton from '../components/BackButton';
import LoadingButton from '../components/LoadingButton';
import { useAppAlert } from '../components/AppAlert';
import { addTemplateToCart, getBusinessChecklist, getBusinessSuggestions, getGreeting, getTemplates, getWalletBalance, sendAssistantMessage, synthesizeSpeech, Template } from '../services/api';

import { friendlyError } from '../services/errors';
export default function ApiDiagnosticsScreen() {
  const router = useRouter();
  const { showAlert } = useAppAlert();
  const [idea, setIdea] = useState('A mobile app that helps local restaurants receive delivery orders');
  const [message, setMessage] = useState('I want to build a mobile app for my business');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [output, setOutput] = useState('Tap a test to see the backend response.');
  const [busy, setBusy] = useState('');

  const run = async (name: string, task: () => Promise<unknown>) => {
    setBusy(name);
    try {
      const result = await task();
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      const text = friendlyError(error, 'Request failed');
      setOutput(text);
      showAlert({ title: `${name} failed`, message: text });
    } finally {
      setBusy('');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}><BackButton onBack={() => router.back()} /><Text style={styles.title}>API Diagnostics</Text><View style={{ width: 36 }} /></View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Use this screen after signing in to verify mobile → Django → AI responses.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Assistant message</Text>
          <TextInput value={message} onChangeText={setMessage} style={styles.input} placeholderTextColor="#64748B" multiline />
          <LoadingButton label="Test Claude chat" loading={busy === 'chat'} onPress={() => run('chat', () => sendAssistantMessage(message))} />
          <LoadingButton label="Test greeting" loading={busy === 'greeting'} onPress={() => run('greeting', getGreeting)} style={styles.secondaryButton} />
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Business planning</Text>
          <TextInput value={idea} onChangeText={setIdea} style={styles.input} placeholderTextColor="#64748B" multiline />
          <LoadingButton label="Get business suggestions" loading={busy === 'suggestions'} onPress={() => run('suggestions', () => getBusinessSuggestions())} />
          <LoadingButton label="Create checklist" loading={busy === 'checklist'} onPress={() => run('checklist', () => getBusinessChecklist(idea))} style={styles.secondaryButton} />
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Design and wallet APIs</Text>
          <LoadingButton label="List mobile templates" loading={busy === 'templates'} onPress={async () => {
            setBusy('templates');
            try { const result = await getTemplates('mobile'); setTemplates(result.templates); setOutput(JSON.stringify(result, null, 2)); } catch (error) { showAlert(friendlyError(error, 'Template request failed')); } finally { setBusy(''); }
          }} />
          {templates.map((template) => <LoadingButton key={template.id} label={`Add ${template.name} to cart`} loading={busy === template.id} onPress={() => run(template.id, () => addTemplateToCart(template.id))} style={styles.secondaryButton} />)}
          <LoadingButton label="Check wallet balance" loading={busy === 'wallet'} onPress={() => run('wallet', getWalletBalance)} style={styles.secondaryButton} />
          <LoadingButton label="Test ElevenLabs TTS" loading={busy === 'tts'} onPress={() => run('tts', () => synthesizeSpeech('Your business plan is ready to review.'))} style={styles.secondaryButton} />
        </View>
        <View style={styles.response}><Text style={styles.responseTitle}>Response</Text><Text selectable style={styles.responseText}>{output}</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  subtitle: { color: '#94A3B8', lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.88)', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.16)' },
  label: { color: '#FFFFFF', fontWeight: '700', marginBottom: 10 },
  input: { minHeight: 54, backgroundColor: '#0B1B2E', color: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12, textAlignVertical: 'top' },
  secondaryButton: { marginTop: 10, backgroundColor: '#334155' },
  response: { backgroundColor: '#020617', borderRadius: 16, padding: 14 },
  responseTitle: { color: '#93C5FD', fontWeight: '700', marginBottom: 8 },
  responseText: { color: '#CBD5E1', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});

