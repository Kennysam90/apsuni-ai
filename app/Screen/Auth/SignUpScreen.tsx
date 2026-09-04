import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, FontAwesome5, Octicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BackButton from '../../components/BackButton';
import AnimatedAuroraBackground from '../../components/AnimatedAuroraBackground';
import LoadingButton from '../../components/LoadingButton';
import { useAppAlert } from '../../components/AppAlert';
import { sendSignupOtp } from '../../services/api';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useAppAlert();

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      showAlert('Complete your name, email, and password first.');
      return;
    }
    if (!agree) {
      showAlert('Please accept the Privacy Policy and User Agreement.');
      return;
    }
    setIsSubmitting(true);
    try {
      await sendSignupOtp(email.trim());
      router.push({ pathname: '/Screen/Auth/OtpVerificationScreen', params: { email: email.trim(), fullName: fullName.trim(), password } });
    } catch (requestError) {
      showAlert({ title: 'Sign up failed', message: requestError instanceof Error ? requestError.message : 'Unable to send the verification code.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.background}>
      <AnimatedAuroraBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <BackButton />
              <View style={{ width: 36 }} />
            </View>

            {/* Logo */}
            <View style={styles.logoRow}>
              <View style={styles.logoMark}><MaterialCommunityIcons name="atom" size={20} color="#93C5FD" /></View>
              <Text style={styles.logoText}>Apsuni AI</Text>
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join the future with AI-driven.
            </Text>

            {/* Bordered form panel */}
            <View style={styles.formCard}>
              {/* Social Logins */}
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialPill} activeOpacity={0.8}>
                  <FontAwesome5 name="google" size={16} color="#FFFFFF" />
                  <Text style={styles.socialText}>Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialPill} activeOpacity={0.8}>
                  <FontAwesome5 name="apple" size={18} color="#FFFFFF" />
                  <Text style={styles.socialText}>Apple</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>Or sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Full Name */}
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#64748B"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Email */}
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Password */}
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Octicons name="key" size={18} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Agree checkbox */}
              <TouchableOpacity style={styles.agreeRow} onPress={() => setAgree(!agree)} activeOpacity={0.7}>
                <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                  {agree && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.agreeText}>
                  I agree <Text style={styles.linkText}>Privacy Policy</Text> and{' '}
                  <Text style={styles.linkText}>User Agreement</Text>
                </Text>
              </TouchableOpacity>

              <LoadingButton label="Sign Up" loading={isSubmitting} onPress={handleSignUp} style={styles.primaryBtn} />

              <View style={styles.bottomRow}>
                <Text style={styles.bottomText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/Screen/Auth/SignInScreen')}>
                  <Text style={styles.bottomLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 36 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  heroArt: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginTop: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 32,
    padding: 20,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  socialPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 8,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerLabel: {
    fontSize: 12,
    color: '#94A3B8',
    paddingHorizontal: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
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
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 24,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  agreeText: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  linkText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  bottomText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  bottomLink: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '700',
  },
});
