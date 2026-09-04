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
import { login } from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import { useAppAlert } from '../../components/AppAlert';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useAppAlert();

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to sign in.';
      setError(message);
      showAlert({ title: 'Sign in failed', message });
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

            <Text style={styles.title}>Welcome to Apsuni</Text>
            <Text style={styles.subtitle}>
              Sign in to continue your journey with your AI assistant
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
                <Text style={styles.dividerLabel}>Or sign in with</Text>
                <View style={styles.dividerLine} />
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

              {/* Remember me / Forgot password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <LoadingButton label="Sign In" loading={isSubmitting} onPress={handleSignIn} style={styles.primaryBtn} />

              <View style={styles.bottomRow}>
                <Text style={styles.bottomText}>Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/Screen/Auth/SignUpScreen')}>
                  <Text style={styles.bottomLink}>Sign Up</Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
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
  errorText: { color: '#FCA5A5', fontSize: 12, marginBottom: 12 },
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rememberText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  forgotText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
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
