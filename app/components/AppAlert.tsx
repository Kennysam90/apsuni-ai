import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type AlertOptions = { title?: string; message: string; actionLabel?: string };
type AlertContextValue = { showAlert: (options: AlertOptions | string) => void };
const AlertContext = createContext<AlertContextValue | null>(null);

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<AlertOptions | null>(null);
  const value = useMemo(() => ({
    showAlert: (options: AlertOptions | string) =>
      setAlert(typeof options === 'string' ? { message: options } : options),
  }), []);

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Modal visible={!!alert} transparent animationType="fade" onRequestClose={() => setAlert(null)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.icon}><Feather name="info" size={20} color="#93C5FD" /></View>
            <Text style={styles.title}>{alert?.title || 'Apsuni AI'}</Text>
            <Text style={styles.message}>{alert?.message}</Text>
            <TouchableOpacity style={styles.button} onPress={() => setAlert(null)} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{alert?.actionLabel || 'Okay'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAppAlert must be used inside AppAlertProvider');
  return context;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, backgroundColor: '#0F172A', borderWidth: 1, borderColor: 'rgba(147,197,253,0.28)' },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(96,165,250,0.16)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, marginBottom: 22 },
  button: { height: 48, borderRadius: 24, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

