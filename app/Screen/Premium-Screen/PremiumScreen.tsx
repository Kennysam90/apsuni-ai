import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from '../../../theme/native';
import { LinearGradient } from '../../../theme/linear-gradient';
import { Feather } from '../../../theme/vector-icons';
import BackButton from '../../components/BackButton';
import { useAppAlert } from '../../components/AppAlert';

import { friendlyError } from '../../services/errors';
interface Plan {
  id: string;
  title: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'weekly',
    title: 'Weekly Pass',
    price: '$3.99/',
    period: 'Week',
    description: 'Perfect for quick projects and testing out full capabilities.',
    features: [
      'Full access to all AI models',
      'Fast response times',
      'Cancel anytime',
    ],
  },
  {
    id: 'monthly',
    title: 'Monthly Pro',
    price: '$11.99/',
    period: 'Month',
    badge: 'MOST POPULAR',
    description: 'Reach your goals quicker with AI-powered planning and tracking.',
    features: [
      'Chat without limits — anytime, anywhere.',
      'Get instant answers, powered by AI.',
      'Create stories, blogs, and so much more.',
    ],
  },
  {
    id: 'annual',
    title: 'Annual Saver',
    price: '$79.99/',
    period: 'Year',
    badge: 'SAVE 45%',
    description: 'Best long-term value for everyday power users.',
    features: [
      'Includes 3 days free trial',
      'Priority access to new AI features',
      'Unlimited high-speed responses',
      'Save $63 compared to monthly',
    ],
  },
  {
    id: 'lifetime',
    title: 'Lifetime Pass',
    price: '$199.99/',
    period: 'One-time',
    badge: 'BEST VALUE',
    description: 'Pay once, unlock unlimited AI access forever.',
    features: [
      'Lifetime unlimited AI access',
      'All future updates included',
      'VIP priority server speed',
      'No subscription renewal fees',
    ],
  },
];

interface PremiumScreenProps {
  onBack?: () => void;
  onSubscribe?: (planId: string) => void | Promise<void>;
  onPressPrivacy?: () => void;
  onPressTerms?: () => void;
  onPressRestore?: () => void;
}

export default function PremiumScreen({
  onBack,
  onSubscribe,
  onPressPrivacy,
  onPressTerms,
  onPressRestore,
}: PremiumScreenProps) {
  const [isFreeTrialEnabled, setIsFreeTrialEnabled] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useAppAlert();

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[1];

  const handleSubscribe = async () => {
    if (!onSubscribe) {
      showAlert('Subscription checkout is not connected yet.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubscribe(selectedPlan.id);
    } catch (error) {
      showAlert(friendlyError(error, 'Subscription could not be started.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Aurora Ambient Background */}
      <LinearGradient
        colors={['#060B11', '#0B1B2B', '#070C12']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <BackButton onBack={onBack} />

          <Text style={styles.headerTitle}>Premium</Text>

          {/* Spacer to balance title alignment */}
          <View style={styles.headerSpacer} />
        </View>

        {/* Fixed Content */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Hero Header Section */}
          <View style={styles.heroSection}>
            <Text style={styles.mainHeadline}>
              Unlock Smarter{'\n'}AI Chats
            </Text>
            <Text style={styles.subHeadline}>
              Smarter AI, stronger conversations
            </Text>
          </View>

          {/* Free Trial Switch Control */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Free Trial Enabled</Text>
            <Switch
              value={isFreeTrialEnabled}
              onValueChange={setIsFreeTrialEnabled}
              trackColor={{ false: '#1E293B', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#1E293B"
            />
          </View>

          {/* Vertically Stacked Plan Cards */}
          <View style={styles.plansContainer}>
            {PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;

              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.9}
                  onPress={() => setSelectedPlanId(plan.id)}
                  style={[
                    styles.cardWrapper,
                    isSelected && styles.selectedCardBorder,
                  ]}
                >
                  <LinearGradient
                    colors={
                      isSelected
                        ? ['rgba(30, 58, 138, 0.95)', 'rgba(15, 23, 42, 0.95)']
                        : ['rgba(15, 23, 42, 0.85)', 'rgba(15, 32, 59, 0.85)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    {/* Header Row */}
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      {plan.badge && (
                        <View
                          style={[
                            styles.badgeContainer,
                            isSelected && styles.badgeSelected,
                          ]}
                        >
                          <Text style={styles.badgeText}>{plan.badge}</Text>
                        </View>
                      )}
                    </View>

                    {/* Price Row */}
                    <View style={styles.priceRow}>
                      <Text style={styles.priceAmount}>{plan.price}</Text>
                      <Text style={styles.pricePeriod}>{plan.period}</Text>
                    </View>

                    <Text style={styles.cardDescription}>{plan.description}</Text>

                    {/* Features Badge Divider */}
                    <View style={styles.dividerContainer}>
                      <View style={styles.dividerLine} />
                      <View style={styles.featuresBadge}>
                        <Text style={styles.featuresBadgeText}>Features</Text>
                      </View>
                    </View>

                    {/* Features List */}
                    <View style={styles.featureList}>
                      {plan.features.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                          <View
                            style={[
                              styles.blueDot,
                              isSelected && { backgroundColor: '#60A5FA' },
                            ]}
                          />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Fixed Bottom Bar */}
        <View style={styles.fixedBottomContainer}>
          {/* Renewal Disclaimer */}
          <Text style={styles.disclaimerText}>
            Auto-renewable, Cancel anytime
          </Text>

          {/* Primary CTA Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubscribe}
            disabled={isSubmitting}
            style={styles.ctaButtonWrapper}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <>
                <Text style={styles.ctaText}>{isFreeTrialEnabled ? `Try ${selectedPlan.title} Free` : `Get ${selectedPlan.title}`}</Text>
                <Feather name="chevron-right" size={20} color="#FFFFFF" style={styles.ctaIcon} />
              </>}
            </LinearGradient>
          </TouchableOpacity>

          {/* Legal / Restoration Links */}
          <View style={styles.footerLinksRow}>
            <TouchableOpacity onPress={onPressPrivacy} activeOpacity={0.7}>
              <Text style={styles.footerLinkText}>Privacy</Text>
            </TouchableOpacity>

            <Text style={styles.footerDivider}>|</Text>

            <TouchableOpacity onPress={onPressTerms} activeOpacity={0.7}>
              <Text style={styles.footerLinkText}>Terms</Text>
            </TouchableOpacity>

            <Text style={styles.footerDivider}>|</Text>

            <TouchableOpacity onPress={onPressRestore} activeOpacity={0.7}>
              <Text style={styles.footerLinkText}>Restore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060B11',
    paddingBottom: 20, // Ensure no extra padding at the bottom
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  mainHeadline: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subHeadline: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  plansContainer: {
    gap: 18,
  },
  cardWrapper: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectedCardBorder: {
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  cardGradient: {
    padding: 22,
    borderRadius: 24,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSelected: {
    backgroundColor: '#2563EB',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  pricePeriod: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 4,
    fontWeight: '500',
  },
  cardDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  dividerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  featuresBadge: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 14,
  },
  featuresBadgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  featureList: {
    marginTop: 8,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  blueDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3B82F6',
    marginRight: 10,
    marginTop: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 18,
  },
  fixedBottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#060B11',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  ctaButtonWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaGradient: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaIcon: {
    position: 'absolute',
    right: 20,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  footerLinkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  footerDivider: {
    fontSize: 12,
    color: '#334155',
  },
});
