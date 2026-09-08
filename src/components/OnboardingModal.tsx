import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { mediumImpact, successNotification } from '../utils/haptics';
import { totalCount } from '../data/tile-index.json';
import { t, formatNumber } from '../i18n';
import { useThemedStyles, type Colors } from "../theme";

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
  onRequestLocation: () => void;
}

const SLIDE_ICONS = ['🚽', '🕐', '♿', '📍'] as const;
// Built per render: the locale is resolved after module evaluation and can change on Android.
const SLIDE_COUNT = SLIDE_ICONS.length;
const buildSlides = () => SLIDE_ICONS.map((icon, i) => {
  const n = (i + 1) as 1 | 2 | 3 | 4;
  return { icon, title: t(`onboarding.${n}.title`), description: t(`onboarding.${n}.description`, { count: formatNumber(totalCount) }) };
});

export function OnboardingModal({
  visible,
  onComplete,
  onRequestLocation,
}: OnboardingModalProps) {
  const styles = useThemedStyles(makeStyles);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = buildSlides();

  const handleNext = useCallback(() => {
    mediumImpact();
    if (currentSlide < SLIDE_COUNT - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      successNotification();
      onRequestLocation();
      onComplete();
    }
  }, [currentSlide, onComplete, onRequestLocation]);

  const handleSkip = useCallback(() => {
    mediumImpact();
    onComplete();
  }, [onComplete]);

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.icon}>{slide.icon}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        {/* Pagination dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Next button */}
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {isLastSlide ? t('onboarding.start') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: c.textSecondary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 80,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.border,
  },
  dotActive: {
    backgroundColor: c.primary,
    width: 24,
  },
  button: {
    backgroundColor: c.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: 'center',
  },
  buttonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
