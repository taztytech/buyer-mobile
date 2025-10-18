import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface RateOrderScreenProps {
  onBack?: () => void;
  onSubmit?: (data: {
    overallRating: number;
    deliveryPartnerRating: number;
    foodRating: number;
    foodComment: string;
    restaurantRating: number;
    restaurantComment: string;
  }) => void;
}

export const RateOrderScreen: React.FC<RateOrderScreenProps> = ({
  onBack,
  onSubmit,
}) => {
  const [overallRating, setOverallRating] = useState(3);
  const [deliveryPartnerRating, setDeliveryPartnerRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [foodComment, setFoodComment] = useState('');
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');
  const [showFoodRatingModal, setShowFoodRatingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Individual food item ratings
  const [chickenBriyaniRating, setChickenBriyaniRating] = useState(0);
  const [muttonBriyaniRating, setMuttonBriyaniRating] = useState(0);
  const [chickenCurryRating, setChickenCurryRating] = useState(0);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const animateStar = () => {
    // Reset animations
    scaleAnim.setValue(1);
    rotateAnim.setValue(0);

    // Run animations
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.3,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleSubmit = () => {
    // Show the food rating modal instead of immediately submitting
    setShowFoodRatingModal(true);
  };

  const handleFoodRatingModalClose = () => {
    setShowFoodRatingModal(false);
    // Show success modal after food rating modal closes
    setTimeout(() => {
      setShowSuccessModal(true);
    }, 200);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);

    // Call the onSubmit and onBack callbacks after success modal is closed
    if (onSubmit) {
      onSubmit({
        overallRating,
        deliveryPartnerRating,
        foodRating,
        foodComment,
        restaurantRating,
        restaurantComment,
      });
    }
    if (onBack) {
      onBack();
    }
  };

  const renderFace = (rating: number) => {
    switch (rating) {
      case 1:
        // Very sad face
        return (
          <View style={styles.faceContentContainer}>
            <View style={styles.eyesContainer}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <View style={[styles.sadFrown, { marginTop: 1 }]} />
          </View>
        );
      case 2:
        // Sad face
        return (
          <View style={styles.faceContentContainer}>
            <View style={styles.eyesContainer}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <View style={[styles.frown, { marginTop: 1 }]} />
          </View>
        );
      case 3:
        // Neutral face
        return (
          <View style={styles.faceContentContainer}>
            <View style={styles.eyesContainer}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <View style={styles.neutral} />
          </View>
        );
      case 4:
        // Happy face
        return (
          <View style={styles.faceContentContainer}>
            <View style={styles.eyesContainer}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <View style={[styles.smile, { marginTop: 1 }]} />
          </View>
        );
      case 5:
        // Very happy face
        return (
          <View style={styles.faceContentContainer}>
            <View style={styles.eyesContainer}>
              <View style={styles.happyEye} />
              <View style={styles.happyEye} />
            </View>
            <View style={[styles.bigSmile, { marginTop: 1 }]} />
          </View>
        );
      default:
        return null;
    }
  };

  const renderStars = (
    rating: number,
    onRate: (value: number) => void,
    isOverall: boolean = false
  ) => {
    const spin = rotateAnim.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: ['-15deg', '0deg', '15deg'],
    });

    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => {
              onRate(star);
              if (isOverall) {
                animateStar();
              }
            }}
            activeOpacity={0.7}
          >
            {isOverall && star === rating ? (
              // Face star for overall rating with animation
              <Animated.View
                style={[
                  styles.happyStarContainer,
                  {
                    transform: [
                      { scale: scaleAnim },
                      { rotate: spin },
                    ],
                  },
                ]}
              >
                <MaterialIcons name="star" size={60} color="#FFB800" />
                <View style={styles.faceContainer}>
                  {renderFace(star)}
                </View>
              </Animated.View>
            ) : (
              <MaterialIcons
                name="star"
                size={isOverall ? 40 : 26}
                color={star <= rating ? '#FFB800' : '#D1D5DB'}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderModalStars = (rating: number, onRate: (value: number) => void) => {
    return (
      <View style={styles.modalStarsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onRate(star)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="star"
              size={24}
              color={star <= rating ? '#D1D5DB' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Order</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Overall Rating */}
          <View style={styles.overallRatingSection}>
            <Text style={styles.overallRatingTitle}>Overall Rating</Text>
            {renderStars(overallRating, setOverallRating, true)}
          </View>

          {/* Rate Delivery Partner */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Rate Delivery Partner</Text>
            {renderStars(deliveryPartnerRating, setDeliveryPartnerRating)}
          </View>

          <View style={styles.divider} />

          {/* Rate Food */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Rate Food</Text>
            {renderStars(foodRating, setFoodRating)}
            <TextInput
              style={styles.commentInput}
              value={foodComment}
              onChangeText={setFoodComment}
              placeholder="Type Here..."
              placeholderTextColor="rgba(0, 0, 0, 0.3)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.divider} />

          {/* Rate Restaurant */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Rate Restaurant</Text>
            {renderStars(restaurantRating, setRestaurantRating)}
            <TextInput
              style={styles.commentInput}
              value={restaurantComment}
              onChangeText={setRestaurantComment}
              placeholder="Type Here..."
              placeholderTextColor="rgba(0, 0, 0, 0.3)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Add Photo or Video */}
          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>Add Photo or Video</Text>
            <TouchableOpacity style={styles.photoBox} activeOpacity={0.7}>
              <MaterialIcons name="image" size={32} color="#00B14F" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Submit Button - Fixed at bottom */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Food Rating Modal */}
      <Modal
        visible={showFoodRatingModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={handleFoodRatingModalClose}
      >
        <View style={styles.modalBackground}>
          <BlurView intensity={100} tint="dark" style={styles.modalOverlay}>
          <View style={styles.foodModalContent}>
            {/* Title and Subtitle */}
            <View style={styles.foodModalHeader}>
              <Text style={styles.foodModalTitle}>Rate Food</Text>
              <Text style={styles.foodModalSubtitle}>For Future better Experience</Text>
            </View>

            {/* Chicken Briyani */}
            <View style={styles.foodItemRow}>
              <Text style={styles.foodItemName}>Chicken Briyani</Text>
              {renderModalStars(chickenBriyaniRating, setChickenBriyaniRating)}
            </View>

            {/* Mutton Briyani */}
            <View style={styles.foodItemRow}>
              <Text style={styles.foodItemName}>Mutton Briyani</Text>
              {renderModalStars(muttonBriyaniRating, setMuttonBriyaniRating)}
            </View>

            {/* Chicken Curry */}
            <View style={styles.foodItemRow}>
              <Text style={styles.foodItemName}>Chicken Curry</Text>
              {renderModalStars(chickenCurryRating, setChickenCurryRating)}
            </View>

            {/* Okay Button */}
            <TouchableOpacity
              style={styles.foodModalOkayButton}
              onPress={handleFoodRatingModalClose}
              activeOpacity={0.8}
            >
              <Text style={styles.foodModalOkayText}>Okay</Text>
            </TouchableOpacity>
          </View>
          </BlurView>
        </View>
      </Modal>

      {/* Success Feedback Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={handleSuccessModalClose}
      >
        <View style={styles.successModalBackground}>
          <BlurView intensity={100} tint="dark" style={styles.successModalOverlay}>
            <View style={styles.successModalContent}>
              {/* Review Submitted Image */}
              <View style={styles.successIconContainer}>
                <Image
                  source={require('@/assets/review-submitted.png')}
                  style={styles.reviewSubmittedImage}
                  resizeMode="contain"
                />
              </View>

              {/* Title */}
              <Text style={styles.successTitle}>Feedback Successfull..!</Text>

              {/* Subtitle */}
              <Text style={styles.successSubtitle}>Thanks fro your valuable feedback</Text>

              {/* Go to Home Button */}
              <TouchableOpacity
                style={styles.goToHomeButton}
                onPress={handleSuccessModalClose}
                activeOpacity={0.8}
              >
                <Text style={styles.goToHomeText}>Go to Home</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 6,
    paddingBottom: 16,
  },
  overallRatingSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  overallRatingTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  happyStarContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  faceContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  eye: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#000000',
  },
  smile: {
    width: 14,
    height: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderTopWidth: 0,
  },
  bigSmile: {
    width: 16,
    height: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderTopWidth: 0,
  },
  neutral: {
    width: 12,
    height: 1.5,
    backgroundColor: '#000000',
  },
  frown: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderBottomWidth: 0,
  },
  sadFrown: {
    width: 16,
    height: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderBottomWidth: 0,
  },
  happyEye: {
    width: 7,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderTopWidth: 0,
  },
  ratingSection: {
    gap: 6,
  },
  ratingLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  commentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    minHeight: 60,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 2,
  },
  photoSection: {
    gap: 6,
  },
  photoLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  photoBox: {
    width: 85,
    height: 85,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00B14F',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomButtonContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#001E1F',
    borderRadius: 10,
  },
  submitButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  // Food Rating Modal Styles
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  foodModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
    maxWidth: 400,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -9,
    },
    shadowOpacity: 0.25,
    shadowRadius: 60,
    elevation: 21,
  },
  foodModalHeader: {
    alignItems: 'center',
    gap: 6,
  },
  foodModalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    lineHeight: 33,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  foodModalSubtitle: {
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  foodItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  foodItemName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
    opacity: 0.85,
    flex: 0,
  },
  modalStarsContainer: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  foodModalOkayButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#001E1F',
    borderRadius: 10,
  },
  foodModalOkayText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  // Success Feedback Modal Styles
  successModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  successModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -9,
    },
    shadowOpacity: 0.25,
    shadowRadius: 60,
    elevation: 21,
    overflow: 'visible',
    marginTop: 66,
  },
  successIconContainer: {
    width: 310,
    height: 200,
    marginTop: -133,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  reviewSubmittedImage: {
    width: 310,
    height: 310,
  },
  successTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    lineHeight: 33,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  successSubtitle: {
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  goToHomeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    width: '100%',
    maxWidth: 310,
    height: 40,
    backgroundColor: '#00B14F',
    borderRadius: 6,
  },
  goToHomeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
