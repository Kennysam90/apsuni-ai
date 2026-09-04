import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import {
  Feather,
  Octicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { logout } from '../services/api';

interface SideMenuCardProps {
  visible?: boolean;
  onClose?: () => void;
}

export default function FloatingSideCardsScreen({ visible = true, onClose }: SideMenuCardProps) {
  const router = useRouter();
  const [selectedWorkspace, setSelectedWorkspace] = useState('widelab');
  const [mounted, setMounted] = useState(visible);
  const slideX = React.useRef(new Animated.Value(-390)).current;

  React.useEffect(() => {
    slideX.stopAnimation();

    if (visible) {
      setMounted(true);
      Animated.timing(slideX, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return () => slideX.stopAnimation();
    }

    Animated.timing(slideX, {
      toValue: -390,
      duration: 720,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });

    return () => slideX.stopAnimation();
  }, [slideX, visible]);

  if (!mounted) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideX }] }]}>
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.screenCanvas}>
        {/* TOP FLOATING CARD: Workspace Switcher */}
        <View style={styles.workspaceCard}>
          {/* Mercedes */}
          <TouchableOpacity
            style={[
              styles.workspaceRow,
              selectedWorkspace === 'mercedes' && styles.selectedRow,
            ]}
            activeOpacity={0.75}
            onPress={() => setSelectedWorkspace('mercedes')}
          >
            
            <View style={[styles.iconBox, { backgroundColor: '#000000' }]}>
              <MaterialCommunityIcons name="car-sports" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Mercedes</Text>
              <Text style={styles.itemSubtitle}>Team Plan • 4.5k members</Text>
            </View>
          </TouchableOpacity>

          {/* Sandra */}
          <TouchableOpacity
            style={[
              styles.workspaceRow,
              selectedWorkspace === 'sandra' && styles.selectedRow,
            ]}
            activeOpacity={0.75}
            onPress={() => setSelectedWorkspace('sandra')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E2E8F0' }]}>
              <Text style={styles.avatarLetter}>S</Text>
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Sandra</Text>
              <Text style={styles.itemSubtitle}>Personal Plan • 1 member</Text>
            </View>
          </TouchableOpacity>

          {/* widelab (Selected Active Item) */}
          <TouchableOpacity
            style={[
              styles.workspaceRow,
              selectedWorkspace === 'widelab' && styles.selectedRow,
            ]}
            activeOpacity={0.75}
            onPress={() => setSelectedWorkspace('widelab')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#4F46E5' }]}>
              <Text style={styles.logoText}>w=</Text>
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>widelab</Text>
              <Text style={styles.itemSubtitle}>Team Plan • 40 members</Text>
            </View>
            {selectedWorkspace === 'widelab' && (
              <Feather name="check" size={18} color="#818CF8" />
            )}
          </TouchableOpacity>

          {/* Figma */}
          <TouchableOpacity
            style={[
              styles.workspaceRow,
              selectedWorkspace === 'figma' && styles.selectedRow,
            ]}
            activeOpacity={0.75}
            onPress={() => setSelectedWorkspace('figma')}
          >
            <View style={[styles.iconBox, styles.figmaBox]}>
              <MaterialCommunityIcons name="vector-square" size={18} color="#F24E1E" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Figma</Text>
              <Text style={styles.itemSubtitle}>Team Plan • 556 members</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* BOTTOM FLOATING CARD: Profile Menu */}
        <View style={styles.profileCard}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
              }}
              style={styles.profileImage}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Sandra Marx</Text>
              <Text style={styles.profileEmail}>sandra@gmail.com</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Menu Items */}
          <View style={styles.menuGroup}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { onClose?.(); router.push('/Screen/ApiDiagnosticsScreen'); }}>
              <Feather name="activity" size={18} color="#2563EB" />
              <Text style={styles.menuLabel}>API Diagnostics</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <Feather name="folder" size={18} color="#475569" />
              <Text style={styles.menuLabel}>Integrations</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { onClose?.(); router.push('/Screen/ChatHistoryScreen'); }}>
              <Feather name="clock" size={18} color="#475569" />
              <Text style={styles.menuLabel}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <Feather name="star" size={18} color="#F59E0B" />
              <Text style={styles.menuLabel}>Upgrade to Pro</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.updateAppHighlight]} activeOpacity={0.8}>
              <Octicons name="dot-fill" size={16} color="#10B981" />
              <Text style={styles.updateAppLabel}>Update App</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { logout(); onClose?.(); router.replace('/Screen/Auth/SignInScreen'); }}>
              <Feather name="log-out" size={18} color="#475569" />
              <Text style={styles.menuLabel}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Info */}
          <View style={styles.cardFooter}>
            <Text style={styles.footerText}>
              v1.5.69 <Text style={styles.dot}>•</Text> Terms & Conditions
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  drawer: {
    width: '90%',
    paddingTop: 20,
    maxWidth: 380,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 20,
  },
  screenCanvas: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Anchors cards to the left side
  },

  /* --- Top Workspace Switcher Card --- */
  workspaceCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 8,
  },
  selectedRow: {
    backgroundColor: '#F3F0FF',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figmaBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },

  /* --- Documents Floating Tooltip --- */
  tooltipPill: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: -4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* --- Bottom Profile Menu Card --- */
  profileCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FCE7F3',
  },
  profileInfo: {
    marginLeft: 12,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: -16,
    marginBottom: 8,
  },
  menuGroup: {
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  updateAppHighlight: {
    backgroundColor: '#ECFDF5',
    marginVertical: 4,
  },
  updateAppLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#047857',
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 6,
    paddingHorizontal: 10,
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dot: {
    fontSize: 10,
  },
});
