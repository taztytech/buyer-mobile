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
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { ordersService } from '@/services/orders.service';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface OrderItem {
  id?: number;
  item_id?: number;
  name?: string;
  item_name?: string;
  image?: string;
  quantity: number;
}

interface RateOrderScreenProps {
  orderId: number;
  orderItems?: OrderItem[];
  onBack?: () => void;
  onSubmit?: () => void;
}

export const RateOrderScreen: React.FC<RateOrderScreenProps> = ({
  orderId,
  orderItems = [],
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<Array<{ url: string; type: string }>>([]);

  // Dynamic food item ratings - Map of item_id to { rating, comment }
  const [itemRatings, setItemRatings] = useState<Record<number, { rating: number; comment: string }>>({});

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

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos(prev => [...prev, { url: result.assets[0].uri, type: 'photo' }]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Validate orderId
    if (!orderId) {
      Alert.alert('Error', 'Order ID is missing');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('orderItems', orderItems);
      console.log('foodRating:', foodRating);
      console.log('itemRatings:', itemRatings);

      // Prepare food ratings array with comments only if they exist
      const food_ratings = orderItems.map((item) => {
        const itemId = item.item_id || 0;
        const itemRating = itemRatings[itemId];

        // For single item: use foodRating if itemRatings is empty
        // For multiple items: use itemRatings[itemId]?.rating, fallback to foodRating
        let rating = itemRating?.rating || 0;
        if (rating === 0 && foodRating > 0) {
          // If no item-specific rating but foodRating is set, use foodRating
          rating = foodRating;
        }

        const foodItem: any = {
          item_id: itemId,
          rating: rating,
        };

        // Only include comment if it exists and is not empty
        if (itemRating?.comment && itemRating.comment.trim()) {
          foodItem.comment = itemRating.comment.trim();
        }

        return foodItem;
      });

      // Prepare review data matching API structure
      const reviewData: any = {
        order_id: orderId,
        overall_rating: overallRating,
        restaurant_rating: restaurantRating,
        delivery_partner_rating: deliveryPartnerRating,
        food_ratings,
      };

      // Only include restaurant_comment if it exists and is not empty
      if (restaurantComment && restaurantComment.trim()) {
        reviewData.restaurant_comment = restaurantComment.trim();
      }

      // Only include photos if they exist
      if (photos.length > 0) {
        reviewData.photos = photos;
      }

      // Log the payload for debugging
      console.log('📦 Rate Order Payload:', JSON.stringify(reviewData, null, 2));

      // Submit review to API
      const response = await ordersService.submitReview(reviewData);

      setIsSubmitting(false);

      if (response.success) {
        // Show success modal after submission
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to submit review');
      }
    } catch (error: any) {
      setIsSubmitting(false);
      Alert.alert('Error', error.message || 'Failed to submit review');
    }
  };

  const handleFoodRatingModalClose = async () => {
    // Calculate and set average rating before closing
    if (orderItems.length > 1) {
      const avgRating = calculateAverageRating();
      if (avgRating > 0) {
        setFoodRating(avgRating);
      }
    }
    setShowFoodRatingModal(false);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);

    // Call the onSubmit and onBack callbacks after success modal is closed
    if (onSubmit) {
      onSubmit();
    }
    if (onBack) {
      onBack();
    }
  };

  const handleItemRatingChange = (itemId: number, rating: number) => {
    setItemRatings(prev => ({
      ...prev,
      [itemId]: {
        rating,
        comment: prev[itemId]?.comment || '',
      },
    }));
  };

  const handleItemCommentChange = (itemId: number, comment: string) => {
    setItemRatings(prev => ({
      ...prev,
      [itemId]: {
        rating: prev[itemId]?.rating || 0,
        comment,
      },
    }));
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
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="star"
              size={28}
              color={star <= rating ? '#FFB800' : '#E5E7EB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Calculate average rating from item ratings
  const calculateAverageRating = React.useCallback(() => {
    if (!orderItems || orderItems.length === 0) return 0;
    const ratings = orderItems
      .map((item: OrderItem, index: number) => {
        const itemId = item.id || item.item_id || index;
        return itemRatings[itemId]?.rating || 0;
      })
      .filter((rating: number) => rating > 0);
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc: number, rating: number) => acc + rating, 0);
    return Math.round(sum / ratings.length);
  }, [orderItems, itemRatings]);

  // Auto-open modal for multiple items on screen load
  useEffect(() => {
    if (orderItems && orderItems.length > 1) {
      setShowFoodRatingModal(true);
    }
  }, [orderItems]);

  // Update foodRating when itemRatings change (for multiple items)
  useEffect(() => {
    if (orderItems && orderItems.length > 1) {
      const avgRating = calculateAverageRating();
      if (avgRating > 0) {
        setFoodRating(avgRating);
      }
    }
  }, [itemRatings, calculateAverageRating, orderItems]);

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Overall Rating */}
            <View style={styles.overallRatingSection}>
              <Text style={styles.overallRatingTitle}>Overall Rating</Text>
              {renderStars(overallRating, setOverallRating, true)}
            </View>

            {/* Rate Food */}
            <View style={styles.ratingSectionContainer}>
              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Rate Food</Text>
                {renderStars(foodRating, setFoodRating)}
              </View>
              <TextInput autoCorrect={false}
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

            {/* Rate Restaurant */}
            <View style={[styles.ratingSection, styles.rateRestaurantSection]}>
              <Text style={styles.ratingLabel}>Rate Restaurant</Text>
              {renderStars(restaurantRating, setRestaurantRating)}
            </View>

            {/* Rate Delivery Partner */}
            <View style={[styles.ratingSection, styles.rateDeliveryPartnerSection]}>
              <Text style={styles.ratingLabel}>Rate Delivery Partner</Text>
              {renderStars(deliveryPartnerRating, setDeliveryPartnerRating)}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Submit Button - Fixed at bottom */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </>
            ) : (
              <>
                <Text style={styles.submitButtonText}>Submit</Text>
                <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
              </>
            )}
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
                <Text style={styles.foodModalSubtitle}>For a better future experience</Text>
              </View>

              {/* Scrollable Food Items */}
              <ScrollView
                style={styles.foodItemsScrollView}
                contentContainerStyle={styles.foodItemsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {orderItems.map((item, index) => {
                  const itemId = item.id || item.item_id || index;
                  const itemName = item.name || item.item_name || 'Unknown Item';
                  const itemRating = itemRatings[itemId]?.rating || 0;
                  const isLastItem = index === orderItems.length - 1;

                  return (
                    <View key={itemId}>
                      <View style={styles.foodItemCard}>
                        <View style={styles.foodItemInfo}>
                          <Text style={styles.foodItemName} numberOfLines={2}>
                            {itemName}
                          </Text>
                          {item.quantity > 1 && (
                            <Text style={styles.foodItemQuantity}>Qty: {item.quantity}</Text>
                          )}
                        </View>
                        <View style={styles.foodItemRatingContainer}>
                          {renderModalStars(
                            itemRating,
                            (rating) => handleItemRatingChange(itemId, rating)
                          )}
                          {itemRating > 0 && (
                            <Text style={styles.ratingText}>{itemRating}/5</Text>
                          )}
                        </View>
                      </View>
                      {!isLastItem && <View style={styles.foodItemDivider} />}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Done Button */}
              <TouchableOpacity
                style={styles.foodModalOkayButton}
                onPress={handleFoodRatingModalClose}
                activeOpacity={0.8}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.foodModalOkayText}>Done</Text>
                    <MaterialIcons name="check" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Success Feedback Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        title="Review Submitted Successfully!"
        message="Thank you for your valuable feedback. Your review helps us improve our service."
        confirmText="OK"
        cancelText=""
        onConfirm={handleSuccessModalClose}
        onCancel={handleSuccessModalClose}
        confirmButtonColor="#00B14F"
        showRibbon={false}
      />
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
  keyboardAvoidingView: {
    flex: 1,
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
    marginBottom: 16,
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
  ratingSectionContainer: {
    gap: 6,
    marginTop: 16,
  },
  ratingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  rateRestaurantSection: {
    marginTop: 25,
  },
  rateDeliveryPartnerSection: {
    marginTop: 25,
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
    minHeight: 80,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 16,
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
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    position: 'relative',
    width: 85,
    height: 85,
  },
  photoPreview: {
    width: 85,
    height: 85,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
  submitButtonDisabled: {
    opacity: 0.6,
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
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
  foodModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  foodModalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    lineHeight: 36,
    textAlign: 'center',
    color: '#001E1F',
    letterSpacing: -0.5,
  },
  foodModalSubtitle: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: 'rgba(0, 30, 31, 0.6)',
  },
  foodItemsScrollView: {
    maxHeight: 400,
    marginBottom: 20,
  },
  foodItemsScrollContent: {
    gap: 0,
  },
  foodItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  foodItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  foodItemName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    lineHeight: 22,
    color: '#001E1F',
    marginBottom: 4,
  },
  foodItemQuantity: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 30, 31, 0.5)',
  },
  foodItemRatingContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  ratingText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
    marginTop: 2,
  },
  foodItemDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 30, 31, 0.08)',
    marginLeft: 4,
  },
  modalStarsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  foodModalOkayButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: '#00B14F',
    borderRadius: 12,
    shadowColor: '#00B14F',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  foodModalOkayText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
