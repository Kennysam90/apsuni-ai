import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from '../../../theme/native';
import { Ionicons, MaterialIcons } from '../../../theme/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AnimatedAuroraBackground from '../../components/AnimatedAuroraBackground';
import LoadingButton from '../../components/LoadingButton';
import { useAppAlert } from '../../components/AppAlert';
import { register, sendSignupOtp } from '../../services/api';

import { friendlyError } from '../../services/errors';
const { width } = Dimensions.get('window');

const OTP_LENGTH = 6;
/** Seconds the user must wait before asking for another code. */
const RESEND_SECONDS = 60;

const emptyOtp = () => Array.from({ length: OTP_LENGTH }, () => '');

/** Errors that mean the code itself was rejected, so the boxes should shake. */
const isOtpError = (message: string) => /\botp\b|verification code|invalid code|incorrect code|wrong code|code (?:is )?(?:invalid|incorrect|expired)|expired/i.test(message);

export default function OtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; fullName?: string; phone?: string; password?: string; country?: string; acceptedTerms?: string }>();
  const email = params.email || '';
  const { showAlert } = useAppAlert();

  const [otp, setOtp] = useState<string[]>(emptyOtp);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [otpError, setOtpError] = useState<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shake = useRef(new Animated.Value(0)).current;

  /* Resend cooldown. */
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const canResend = secondsLeft <= 0 && !isResending;

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleOtpChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');
    if (otpError) setOtpError(null);

    // Pasted or autofilled code: spread it across the boxes from here on.
    if (digits.length > 1) {
      const next = [...otp];
      digits.slice(0, OTP_LENGTH - index).split('').forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      setOtp(next);
      const lastFilled = Math.min(index + digits.length, OTP_LENGTH) - 1;
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (event: any, index: number) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const failVerification = (message: string) => {
    setOtpError(message);
    runShake();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      failVerification(`Enter all ${OTP_LENGTH} digits of the code.`);
      return;
    }
    if (!params.password || !params.fullName || !params.phone || !params.country) {
      showAlert({ title: 'Details missing', message: 'Go back and fill in your name, phone number, country, and password again.' });
      return;
    }
    if (params.acceptedTerms !== 'true') {
      showAlert({ title: 'Terms not accepted', message: 'Go back and accept the Terms and Conditions to create your account.' });
      return;
    }

    // The backend reads last_name unconditionally, so always send one.
    const [firstName, ...otherNames] = params.fullName.trim().split(/\s+/);
    const lastName = otherNames.join(' ');

    setIsSubmitting(true);
    try {
      await register({
        email,
        username: email.split('@')[0],
        password: params.password,
        password2: params.password,
        first_name: firstName,
        last_name: lastName,
        phone: params.phone,
        country: params.country,
        accept_terms: true,
        otp: code,
      });
      router.replace('/Screen/Auth/SignInScreen');
    } catch (requestError) {
      const message = friendlyError(requestError, 'The code could not be verified.');
      if (isOtpError(message)) {
        failVerification(message);
      } else {
        showAlert({ title: 'Verification failed', message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !email) return;
    setIsResending(true);
    try {
      await sendSignupOtp(email);
      setOtp(emptyOtp());
      setOtpError(null);
      setSecondsLeft(RESEND_SECONDS);
      inputRefs.current[0]?.focus();
      showAlert({ title: 'Code sent', message: `A new code is on its way to ${email}.` });
    } catch (requestError) {
      showAlert({ title: 'Could not resend', message: friendlyError(requestError, 'Try again in a moment.') });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.background}>
      <AnimatedAuroraBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>

            <Text style={styles.otpHeaderTitle}>Verify OTP</Text>

            <View style={{ width: 36 }} />
          </View>

          {/* Hero Artwork */}
          <View style={styles.otpHero}>
            <MaterialIcons name="verified-user" size={92} color="rgba(96, 165, 250, 0.22)" style={styles.otpHeroPlane} />
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
              <Text style={styles.userEmailText}>{email || 'your email'}</Text> below
            </Text>

            {/* 6 Digit OTP Boxes */}
            <Animated.View style={[styles.otpRow, { transform: [{ translateX: shake }] }]}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(ref) => {
                    inputRefs.current[idx] = ref;
                  }}
                  style={[styles.otpBox, digit !== '' && styles.otpBoxFilled, otpError && styles.otpBoxError]}
                  keyboardType="number-pad"
                  // No maxLength: a length of 1 silently blocks pasting the whole code.
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, idx)}
                  onKeyPress={(event) => handleKeyPress(event, idx)}
                  selectTextOnFocus
                  textContentType={idx === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={idx === 0 ? 'sms-otp' : 'off'}
                  importantForAutofill={idx === 0 ? 'yes' : 'no'}
                />
              ))}
            </Animated.View>

            {otpError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#F87171" />
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            ) : null}

            {/* Resend Timer Block */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendNotice}>
                {canResend ? "Didn't receive the code?" : 'You can request a new code in'}
              </Text>
              <View style={styles.timerRow}>
                {!canResend && (
                  <>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{minutes}</Text>
                      <Text style={styles.timeBadgeSub}>minutes</Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{seconds}</Text>
                      <Text style={styles.timeBadgeSub}>seconds</Text>
                    </View>
                  </>
                )}
                <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={!canResend} activeOpacity={0.7}>
                  {isResending ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <Text style={[styles.resendBtnText, !canResend && styles.resendBtnTextDisabled]}>Resend code</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Verify & Continue Button */}
            <LoadingButton
              label="Verify & Continue"
              loading={isSubmitting}
              style={styles.primaryBtn}
              onPress={handleVerify}
            />

            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>Already verified? </Text>
              <TouchableOpacity onPress={() => router.replace('/Screen/Auth/SignInScreen')}>
                <Text style={styles.bottomLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
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
  otpBoxError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    color: '#FCA5A5',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -12,
    marginBottom: 18,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
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
  resendBtnTextDisabled: {
    color: '#475569',
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  bottomText: { fontSize: 13, color: '#94A3B8' },
  bottomLink: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
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
