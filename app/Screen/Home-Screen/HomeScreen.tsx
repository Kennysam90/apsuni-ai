import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ImageBackground,
  useWindowDimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Ionicons,
  Feather,
  FontAwesome5,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

export default function AuroraHomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const isCompactScreen = height < 760;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Full-screen app background */}
      <ImageBackground
        source={require('@/assets/images/tabs-icon/app_background_full.png')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header Bar */}
        <View style={[styles.header, isCompactScreen && styles.compactHeader]}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Image
                 source={{
                  uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
                   }}
                  style={styles.profileImage}
              />
            </View>
            <Text style={styles.brandTitle}>Apsuni AI</Text>
          </View>

          {/* Pro Pill Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/Screen/Premium-Screen/PremiumScreen')}
          >
            <LinearGradient
              colors={['#2563EB', '#3B82F6', '#60A5FA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.proPill}
            >
              <FontAwesome5 name="crown" size={12} color="#FBBF24" style={{ marginRight: 6 }} />
              <Text style={styles.proText}>Pro</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.scrollContent,
            isCompactScreen && styles.compactScrollContent,
          ]}
        >
          {/* Glowing Orb Hero Visual */}
          <View
            style={[
              styles.orbContainer,
              isCompactScreen && styles.compactOrbContainer,
            ]}
          >
            {/* Outer Glow Ring */}

            {/* Glowing Orb Sphere */}
            <LinearGradient
              colors={['#1E40AF', '#3B82F6', '#1D4ED8', '#000000']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={[
                styles.orbSphere,
                isCompactScreen && styles.compactOrbSphere,
              ]}
            >
              {/* Inner Wave Pattern Accents */}
              <View style={styles.orbInnerRing} />
              <View style={[styles.orbInnerRing, styles.ringRotation]} />
            </LinearGradient>
          </View>

          {/* Title & Subtitle */}
          <View
            style={[
              styles.heroTextSection,
              isCompactScreen && styles.compactHeroTextSection,
            ]}
          >
            <Text style={styles.mainTitle}>Hello I’m Apsuni Ai</Text>
            <Text style={styles.mainSubtitle}>Your AI digital partners</Text>
          </View>

          {/* Featured Large Action Card */}
          <TouchableOpacity activeOpacity={0.9} style={styles.largeCardContainer}>
            <ImageBackground
              source={require('@/assets/images/tabs-icon/card_background_final.png')}
              style={[
                styles.largeCardGradient,
                isCompactScreen && styles.compactLargeCardGradient,
              ]}
              resizeMode="cover"
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.largeCardTitle}>How to create Application</Text>
                <View style={styles.arrowCircleGlass}>
                  <Feather name="arrow-up-right" size={18} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.cardSubtitle}>
                Your application has been successfully submitted to Mangcoding.
              </Text>
            </ImageBackground>
          </TouchableOpacity>

          {/* Grid Cards Row */}
          <View style={styles.gridRow}>
            {/* Grid Card 1 */}
            <TouchableOpacity activeOpacity={0.9} style={styles.gridCard}>
              <View style={styles.gridCardContent}>
                <View style={styles.gridCardTitleRow}>
                  <View style={styles.gridCardText}>
                    <Text style={styles.gridCardTitle}>Create prompt{'\n'}For Generate AI</Text>
                    <Text style={styles.gridCardSubtitle}>
                      Your application has been successfully submitted to Mangcoding.
                    </Text>
                  </View>
                  <View style={styles.blueArrowCircle}>
                    <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Grid Card 2 */}
            <TouchableOpacity activeOpacity={0.9} style={styles.gridCard}>
              <View style={styles.gridCardContent}>
                <View style={styles.gridCardTitleRow}>
                  <View style={styles.gridCardText}>
                    <Text style={styles.gridCardTitle}>Create Video for{'\n'}Motion</Text>
                    <Text style={styles.gridCardSubtitle}>
                      Your application has been successfully  submitted to Mangcoding.
                    </Text>
                  </View>
                  <View style={styles.blueArrowCircle}>
                    <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
          {/* Chat input scrolls with the rest of the home content. */}
          <View
            style={[
              styles.bottomTray,
              isCompactScreen && styles.compactBottomTray,
            ]}
          >
            <Text style={styles.trayHeaderTitle}>Message Chatbot AI</Text>

            <View style={styles.trayActionRow}>
              <TouchableOpacity style={styles.trayCircleBtn} activeOpacity={0.7}>
                <Feather name="plus" size={20} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.webSearchPill} activeOpacity={0.8}>
                <Ionicons name="globe-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={styles.webSearchText}>Web Search</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity style={styles.trayCircleBtn} activeOpacity={0.7}>
                <Feather name="mic" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.85}>
                <LinearGradient
                  colors={['#2563EB', '#3B82F6']}
                  style={styles.waveformBtn}
                >
                  <MaterialCommunityIcons name="waveform" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C11',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 12,
  },
  compactHeader: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FCE7F3',
    
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  proText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 5,
    // Keep the last content clear of the fixed tab bar.
    paddingBottom: 100,
  },
  compactScrollContent: {
    paddingTop: 4,
    paddingBottom: 72,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    marginTop: -25,
  },
  compactOrbContainer: {
    height: 130,
    marginTop: -12,
  },
  orbSphere: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(96, 165, 250, 0.6)',
    overflow: 'hidden',
  },
  compactOrbSphere: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  orbInnerRing: {
    position: 'absolute',
    width: 140,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ rotate: '-30deg' }],
  },
  ringRotation: {
    transform: [{ rotate: '45deg' }],
    borderColor: 'rgba(96, 165, 250, 0.5)',
  },
  heroTextSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  compactHeroTextSection: {
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: -10,
  },
  largeCardContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  largeCardGradient: {
    padding: 20,
    borderRadius: 22,
  },
  compactLargeCardGradient: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  largeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    paddingRight: 10,
  },
  arrowCircleGlass: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    width: '80%',
    marginTop: -20,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#111720',
    borderRadius: 15,
    padding: 15,
    justifyContent: 'space-between',
    display: 'flex',
    minHeight: 125,
    marginBottom: -10,
    marginTop: -5,
    borderWidth: 1,
  },
  compactGridCard: {
    minHeight: 120,
  },
  gridCardContent: {
    flex: 1,
    marginTop: -10,
  },
  gridCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridCardText: {
    flex: 1,
  },
  gridCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gridCardSubtitle: {
    fontSize: 11,
    color: '#fff',
    lineHeight: 16,
  },
  blueArrowCircle: {
    width: 32,
    height: 32,
    top: 30,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTray: {
    backgroundColor: '#0F151D',
    borderRadius: 20,
    height: 130,
    paddingHorizontal: 20,
    paddingTop: 20,
    marginTop: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
  },
  compactBottomTray: {
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 20,
  },
  trayHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  trayActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trayCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
  },
  webSearchText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  waveformBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
