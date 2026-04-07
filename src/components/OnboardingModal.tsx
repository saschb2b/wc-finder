import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { mediumImpact, successNotification } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
  onRequestLocation: () => void;
}

const slides = [
  {
    icon: '🚽',
    title: 'Willkommen bei WC Finder',
    description: 'Finde schnell und einfach öffentliche Toiletten in deiner Nähe – mit über 13.000 Standorten in ganz Deutschland.',
  },
  {
    icon: '🕐',
    title: 'Öffnungszeiten in Echtzeit',
    description: 'Sehe auf einen Blick, welche Toiletten gerade geöffnet haben. 91% unserer Standorte haben aktuelle Öffnungszeiten.',
  },
  {
    icon: '♿',
    title: 'Barrierefrei & Kostenlos',
    description: 'Filtere nach Eurokey-Zugang, barrierefreien Einrichtungen und kostenlosen Toiletten.',
  },
  {
    icon: '📍',
    title: 'Navigation eingebaut',
    description: 'Mit einem Tipp zur Toilette navigieren – kompatibel mit Google Maps, Apple Maps und mehr.',
  },
];

export function OnboardingModal({
  visible,
  onComplete,
  onRequestLocation,
}: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = useCallback(() => {
    mediumImpact();
    if (currentSlide < slides.length - 1) {
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
          <Text style={styles.skipText}>Überspringen</Text>
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
            {isLastSlide ? 'Los geht\'s!' : 'Weiter'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#666',
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
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#ddd',
  },
  dotActive: {
    backgroundColor: '#1a73e8',
    width: 24,
  },
  button: {
    backgroundColor: '#1a73e8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
