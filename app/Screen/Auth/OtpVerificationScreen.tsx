import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BackButton from '../../components/BackButton';

const { width } = Dimensions.get('window');

export default function OtpVerificationScreen() {
  const router = useRouter();
  const userEmail = 'example@gmail.com';
  const [otp, setOtp] = useState(['1', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <LinearGradient colors={['#070E26', '#040711', '#091330']} style={styles.background}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <BackButton />

            <Text style={styles.otpHeaderTitle}>Verify OTP</Text>

            <View style={{ width: 36 }} />
          </View>

          {/* Hero Artwork */}
          <View style={styles.otpHero}>
            <FontAwesome5 name="plane" size={100} color="rgba(255, 255, 255, 0.12)" style={styles.otpHeroPlane} />
          </View>

          {/* Card Container */}
          <View style={styles.card}>
            {/* Top Mail Badge */}
            <View style={styles.badgeWrapper}>
              <View style={styles.badgeCircle}>
                <MaterialIcons name="email" size={28} color="#F59E0B" />
                <View style={styles.badgeDot}>
                  <Ionicons name="ellipsis-horizontal" size={10} color="#FFFFFF" />
                </View>
              </View>
            </View>

            <Text style={styles.checkEmailTitle}>Check your Email</Text>
            <Text style={styles.checkEmailSub}>
              Enter the unique code we sent to{'\n'}
              <Text style={styles.userEmailText}>{userEmail}</Text> below
            </Text>

            {/* 6 Digital OTP Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(ref) => {
                    inputRefs.current[idx] = ref;
                  }}
                  style={[styles.otpBox, digit !== '' && styles.otpBoxFilled]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                />
              ))}
            </View>

            {/* Resend Timer Block */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendNotice}>Didn&apos;t receive the code?</Text>
              <View style={styles.timerRow}>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>00</Text>
                  <Text style={styles.timeBadgeSub}>minutes</Text>
                </View>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>32</Text>
                  <Text style={styles.timeBadgeSub}>Second</Text>
                </View>
                <TouchableOpacity style={styles.resendBtn}>
                  <Text style={styles.resendBtnText}>Resend</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Verify & Continue Button */}
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.replace('/(tabs)')}
            >
              <View style={styles.btnContentRow}>
                <Text style={styles.primaryBtnText}>Verify & Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 8,
  },
  otpHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  otpHero: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
  },
  otpHeroPlane: {
    transform: [{ rotate: '-20deg' }],
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 20,
    paddingTop: 0,
  },
  badgeWrapper: {
    alignItems: 'center',
    marginTop: -30,
    marginBottom: 14,
  },
  badgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    backgroundColor: '#0066FF',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkEmailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  checkEmailSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  userEmailText: {
    color: '#2563EB',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  otpBox: {
    width: (width - 120) / 6,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: '#0066FF',
    backgroundColor: 'rgba(0, 102, 255, 0.12)',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendNotice: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  timeBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeBadgeSub: {
    fontSize: 7,
    color: '#64748B',
  },
  resendBtn: {
    marginLeft: 4,
  },
  resendBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#0066FF',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
