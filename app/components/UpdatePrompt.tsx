import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from '../../theme/native';
import { Feather } from '../../theme/vector-icons';
import { LinearGradient } from '../../theme/linear-gradient';

import { checkForUpdate, type AppUpdate } from '../services/appUpdate';

/**
 * Tells people a newer version of the app is out. Checks once when the app opens (Android only,
 * since the update is an APK download) and shows a popup with what changed and an Update button.
 * "Later" hides it for this session; a release marked [required] cannot be dismissed.
 */
export default function UpdatePrompt() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(0.9)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    let active = true;
    // The opening animation has just finished, so give the first screen a moment before a popup.
    const timer = setTimeout(() => {
      checkForUpdate().then((found) => {
        if (active && found) { setUpdate(found); setVisible(true); }
      });
    }, 800);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.9);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
    ]).start();
  }, [visible, scale, fade]);

  if (!update) return null;

  const later = () => {
    if (update.required) return;
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setVisible(false));
  };

  const install = async () => {
    setBusy(true);
    try {
      await Linking.openURL(update.url);
    } catch {
      // No browser to hand the link to; the popup stays so they can try again.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={later}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={later} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <LinearGradient colors={['#1D4ED8', '#2563EB', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <View style={[styles.orb, styles.orbOne]} />
            <View style={[styles.orb, styles.orbTwo]} />
            <View style={styles.logoTile}>
              <Image source={require('../../assets/images/AL3.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.badge}><Feather name="arrow-up-circle" size={22} color="#FFFFFF" /></View>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.title}>{update.required ? 'Update required' : 'A new version is available'}</Text>
            <Text style={styles.subtitle}>
              {update.required
                ? 'This version is no longer supported. Please update to keep using Apsuni.'
                : 'Update to get the latest features, fixes and improvements.'}
            </Text>

            <View style={styles.versions}>
              <View style={styles.versionPill}><Text style={styles.versionLabel}>Installed</Text><Text style={styles.versionValue}>v{update.current}</Text></View>
              <Feather name="arrow-right" size={16} color="#64748B" />
              <View style={[styles.versionPill, styles.versionNew]}><Text style={[styles.versionLabel, { color: '#86EFAC' }]}>Latest</Text><Text style={[styles.versionValue, { color: '#BBF7D0' }]}>v{update.latest}</Text></View>
            </View>

            {update.notes.length > 0 && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>What&apos;s new</Text>
                <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                  {update.notes.map((note) => (
                    <View key={note} style={styles.noteRow}>
                      <View style={styles.noteDot} />
                      <Text style={styles.noteText}>{note}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={install} style={styles.primary}>
              <LinearGradient colors={['#2563EB', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryFill}>
                <Feather name="download" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Update now</Text>
              </LinearGradient>
            </TouchableOpacity>

            {!update.required && (
              <TouchableOpacity onPress={later} style={styles.secondary} hitSlop={8}>
                <Text style={styles.secondaryText}>Maybe later</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.hint}>Your projects and account stay exactly as they are. After the download, open the file and tap Install.</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(2, 6, 23, 0.78)' },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#0B1626',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  banner: { height: 118, alignItems: 'center', justifyContent: 'flex-end' },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  orbOne: { width: 150, height: 150, top: -70, right: -30 },
  orbTwo: { width: 90, height: 90, bottom: -40, left: 18 },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.28)',
  },
  logoTile: {
    position: 'absolute',
    bottom: -44,
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 5,
    borderColor: '#0B1626',
    elevation: 8,
  },
  logo: { width: 62, height: 62 },
  body: { paddingTop: 58, paddingHorizontal: 22, paddingBottom: 20, alignItems: 'center' },
  title: { fontSize: 21, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 19, color: '#94A3B8', textAlign: 'center' },
  versions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  versionPill: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(30,41,59,0.7)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.16)' },
  versionNew: { backgroundColor: 'rgba(22,163,74,0.14)', borderColor: 'rgba(74,222,128,0.35)' },
  versionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: '#94A3B8' },
  versionValue: { marginTop: 1, fontSize: 15, fontWeight: '800', color: '#E2E8F0' },
  notesBox: { alignSelf: 'stretch', marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: 'rgba(30,41,59,0.55)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)' },
  notesTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: '#60A5FA', marginBottom: 8 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 6 },
  noteDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: '#38BDF8' },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#CBD5E1' },
  primary: { alignSelf: 'stretch', marginTop: 20, borderRadius: 16, overflow: 'hidden', elevation: 6, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14 },
  primaryFill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 52 },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  secondary: { marginTop: 12, paddingVertical: 6 },
  secondaryText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  hint: { marginTop: 8, fontSize: 11.5, lineHeight: 17, color: '#64748B', textAlign: 'center' },
});
