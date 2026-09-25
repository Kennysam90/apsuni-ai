import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from '../../../theme/native';
import { Ionicons, Octicons } from '../../../theme/vector-icons';
import { useRouter } from 'expo-router';

import AnimatedAuroraBackground from '../../components/AnimatedAuroraBackground';
import LoadingButton from '../../components/LoadingButton';
import { useAppAlert } from '../../components/AppAlert';
import { resetPassword, sendResetPasswordOtp, verifyResetPasswordOtp } from '../../services/api';

import { friendlyError } from '../../services/errors';
/**
 * Three steps, matching the website: ask for the email, check the code we email,
 * then choose a new password. The API hands back a one-time token after the code
 * is accepted, and that token is what authorises the password change.
 */

type Step = 1 | 2 | 3 | 'done';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const STEPS = ['Email', 'Code', 'Password'];

const strengthOf = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score += 1;
  return score;
};

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['#475569', '#EF4444', '#F59E0B', '#22C55E', '#10B981'];

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAppAlert();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [reset, setReset] = useState<{ uidb64: string; token: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const shake = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  const strength = useMemo(() => strengthOf(password), [password]);

  // Fade the card each time the step changes.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [step, fade]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const fail = (message: string, shakeBoxes = false) => {
    setError(message);
    if (shakeBoxes) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  };

  const requestCode = async () => {
    const address = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      fail('Enter the email address on your account.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendResetPasswordOtp(address);
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_SECONDS);
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (requestError) {
      const message = friendlyError(requestError, 'We could not send the code.');
      fail(message);
      showAlert({ title: 'Could not send the code', message });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    try {
      await sendResetPasswordOtp(email.trim());
      setCooldown(RESEND_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      setError('');
      otpRefs.current[0]?.focus();
      showAlert({ title: 'Code sent', message: `We sent a new code to ${email.trim()}.` });
    } catch (requestError) {
      showAlert({ title: 'Could not resend', message: friendlyError(requestError, 'Try again in a moment.') });
    } finally {
      setLoading(false);
    }
  };

  const changeDigit = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (error) setError('');
    // Pasting (or SMS autofill) drops the whole code into one box.
    if (digits.length > 1) {
      const next = Array(OTP_LENGTH).fill('');
      digits.slice(0, OTP_LENGTH).split('').forEach((digit, position) => { next[position] = digit; });
      setOtp(next);
      otpRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
      return;
    }
    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const backspace = (index: number, event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      fail('Enter the 6-digit code from your email.', true);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verifyResetPasswordOtp(email.trim(), code);
      setReset({ uidb64: result.uidb64, token: result.token });
      setStep(3);
    } catch (requestError) {
      fail(friendlyError(requestError, 'That code is not correct.'), true);
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 8) {
      fail('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      fail('Both passwords must match.');
      return;
    }
    if (!reset) return;
    setError('');
    setLoading(true);
    try {
      await resetPassword({ ...reset, password });
      setStep('done');
    } catch (requestError) {
      const message = friendlyError(requestError, 'The password could not be changed.');
      fail(message);
      showAlert({ title: 'Could not change your password', message });
    } finally {
      setLoading(false);
    }
  };

  const activeIndex = step === 'done' ? 3 : step;
  const heading = {
    1: ['Forgot your password?', 'Enter the email on your account and we will send you a 6-digit code to reset it.'],
    2: ['Check your email', `We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`],
    3: ['Choose a new password', 'Pick something strong that you do not use anywhere else.'],
    done: ['Password changed', 'Your password has been updated. Sign in with your new password.'],
  }[step];

  const shakeStyle = { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] };

  return (
    <View style={styles.background}>
      <AnimatedAuroraBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.logoRow}>
              <View style={styles.logoMark}><Image source={require('../../../assets/images/AL3.png')} style={styles.logoImage} resizeMode="contain" /></View>
              <Text style={styles.logoText}>Apsuni</Text>
            </View>

            {step !== 'done' && (
              <View style={styles.progress}>
                {STEPS.map((label, index) => {
                  const done = index + 1 < activeIndex;
                  const current = index + 1 === activeIndex;
                  return (
                    <React.Fragment key={label}>
                      <View style={styles.progressItem}>
                        <View style={[styles.progressDot, (done || current) && styles.progressDotOn]}>
                          {done ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : <Text style={[styles.progressNum, current && { color: '#FFFFFF' }]}>{index + 1}</Text>}
                        </View>
                        <Text style={[styles.progressLabel, (done || current) && { color: '#E2E8F0' }]}>{label}</Text>
                      </View>
                      {index < STEPS.length - 1 && <View style={[styles.progressLine, done && styles.progressLineOn]} />}
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            <Animated.View style={{ opacity: fade }}>
              {step === 'done' && (
                <View style={styles.successBadge}><Ionicons name="checkmark" size={38} color="#FFFFFF" /></View>
              )}
              <Text style={styles.title}>{heading[0]}</Text>
              <Text style={styles.subtitle}>{heading[1]}</Text>

              <View style={styles.formCard}>
                {step === 1 && (
                  <>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.fieldIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor="#64748B"
                        value={email}
                        onChangeText={(value) => { setEmail(value); if (error) setError(''); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="send"
                        onSubmitEditing={requestCode}
                      />
                    </View>
                    {!!error && <Text style={styles.errorText}>{error}</Text>}
                    <LoadingButton label="Send code" loading={loading} onPress={requestCode} style={styles.primaryBtn} />
                  </>
                )}

                {step === 2 && (
                  <>
                    <Animated.View style={[styles.otpRow, shakeStyle]}>
                      {otp.map((digit, index) => (
                        <TextInput
                          key={index}
                          ref={(node) => { otpRefs.current[index] = node; }}
                          style={[styles.otpBox, digit !== '' && styles.otpBoxFilled, !!error && styles.otpBoxError]}
                          value={digit}
                          onChangeText={(value) => changeDigit(index, value)}
                          onKeyPress={(event) => backspace(index, event)}
                          keyboardType="number-pad"
                          maxLength={index === 0 ? OTP_LENGTH : 1}
                          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                          autoComplete={index === 0 ? 'sms-otp' : 'off'}
                          selectionColor="#60A5FA"
                        />
                      ))}
                    </Animated.View>
                    {!!error && <Text style={[styles.errorText, { textAlign: 'center' }]}>{error}</Text>}
                    <LoadingButton label="Verify code" loading={loading} onPress={verifyCode} style={styles.primaryBtn} />
                    <View style={styles.resendRow}>
                      <Text style={styles.resendText}>Did not get it? </Text>
                      <TouchableOpacity onPress={resend} disabled={cooldown > 0 || loading}>
                        <Text style={[styles.resendLink, cooldown > 0 && { color: '#64748B' }]}>
                          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => { setStep(1); setError(''); }} style={styles.changeEmail}>
                      <Text style={styles.changeEmailText}>Use a different email</Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === 3 && (
                  <>
                    <Text style={styles.fieldLabel}>New password</Text>
                    <View style={styles.inputWrapper}>
                      <Octicons name="key" size={18} color="#94A3B8" style={styles.fieldIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="At least 8 characters"
                        placeholderTextColor="#64748B"
                        value={password}
                        onChangeText={(value) => { setPassword(value); if (error) setError(''); }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                        <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {password.length > 0 && (
                      <View style={styles.strengthWrap}>
                        <View style={styles.strengthBars}>
                          {[1, 2, 3, 4].map((bar) => (
                            <View key={bar} style={[styles.strengthBar, bar <= strength && { backgroundColor: STRENGTH_COLORS[strength] }]} />
                          ))}
                        </View>
                        <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>{STRENGTH_LABELS[strength]}</Text>
                      </View>
                    )}

                    <Text style={styles.fieldLabel}>Confirm password</Text>
                    <View style={styles.inputWrapper}>
                      <Octicons name="key" size={18} color="#94A3B8" style={styles.fieldIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Re-enter your new password"
                        placeholderTextColor="#64748B"
                        value={confirm}
                        onChangeText={(value) => { setConfirm(value); if (error) setError(''); }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={savePassword}
                      />
                      {confirm.length > 0 && (
                        <Ionicons
                          name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                          size={18}
                          color={confirm === password ? '#22C55E' : '#EF4444'}
                        />
                      )}
                    </View>
                    {!!error && <Text style={styles.errorText}>{error}</Text>}
                    <LoadingButton label="Save new password" loading={loading} onPress={savePassword} style={styles.primaryBtn} />
                  </>
                )}

                {step === 'done' && (
                  <LoadingButton label="Back to sign in" onPress={() => router.replace('/Screen/Auth/SignInScreen')} style={styles.primaryBtn} />
                )}

                {step !== 'done' && (
                  <View style={styles.bottomRow}>
                    <Text style={styles.bottomText}>Remembered it? </Text>
                    <TouchableOpacity onPress={() => router.replace('/Screen/Auth/SignInScreen')}>
                      <Text style={styles.bottomLink}>Sign In</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  logoMark: { alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 38, height: 38 },
  logoText: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontStyle: 'italic' },

  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22, marginBottom: 6 },
  progressItem: { alignItems: 'center', gap: 6 },
  progressDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  progressDotOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  progressNum: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  progressLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  progressLine: { width: 44, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 8, marginBottom: 18 },
  progressLineOn: { backgroundColor: '#2563EB' },

  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginTop: 18, marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19, paddingHorizontal: 10, marginBottom: 20 },
  successBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    backgroundColor: '#16A34A',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 32,
    padding: 20,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 18,
    height: 52,
    marginBottom: 16,
  },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  errorText: { color: '#FCA5A5', fontSize: 12, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#2563EB',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otpBoxFilled: { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.14)' },
  otpBoxError: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.14)', color: '#FCA5A5' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  resendText: { fontSize: 13, color: '#94A3B8' },
  resendLink: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
  changeEmail: { alignItems: 'center', paddingVertical: 4 },
  changeEmailText: { fontSize: 12, color: '#94A3B8', textDecorationLine: 'underline' },

  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -6, marginBottom: 16, paddingHorizontal: 6 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  strengthLabel: { fontSize: 11, fontWeight: '700', width: 58, textAlign: 'right' },

  bottomRow: { flexDirection: 'row', justifyContent: 'center' },
  bottomText: { fontSize: 13, color: '#94A3B8' },
  bottomLink: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
});
