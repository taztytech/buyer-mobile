import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { MaterialIcons } from '@/shims/rn-vector-icons';

interface FoodAddCardProps {
  image: ImageSourcePropType;
  name: string;
  subtitle?: string;
  priceLabel?: string;
  showAddButton?: boolean;
  isClosed?: boolean;
  onAddPress?: () => void;
  onPress?: () => void;
  disabled?: boolean;
  cardWidth?: number | string;
  showWishlistIcon?: boolean;
  isWishlisted?: boolean;
  onWishlistPress?: () => void;
  unavailableLabel?: string;
  closedOverlayLabel?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageBorderRadius?: number;
}

export const FoodAddCard: React.FC<FoodAddCardProps> = ({
  image,
  name,
  subtitle,
  priceLabel,
  showAddButton = true,
  isClosed = false,
  onAddPress,
  onPress,
  disabled = false,
  cardWidth = 170,
  showWishlistIcon = false,
  isWishlisted = false,
  onWishlistPress,
  unavailableLabel = 'Closed',
  closedOverlayLabel = 'Currently closed',
  imageWidth = 155,
  imageHeight = 137,
  imageBorderRadius = 16,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.8}
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={[styles.imageWrapper, { width: imageWidth, height: imageHeight, borderRadius: imageBorderRadius }]}>
        <Image source={image} style={[styles.image, isClosed && styles.imageClosed]} resizeMode="cover" />
        {isClosed ? <View pointerEvents="none" style={styles.disabledImageOverlay} /> : null}
        {showWishlistIcon ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.wishlistButton}
            onPress={(event) => {
              event.stopPropagation();
              onWishlistPress?.();
            }}
          >
            <MaterialIcons
              name={isWishlisted ? 'favorite' : 'favorite-border'}
              size={24}
              color={isWishlisted ? '#FF0000' : '#FFFFFF'}
            />
          </TouchableOpacity>
        ) : null}
        {!showAddButton && isClosed ? (
          <View style={styles.closedOverlayRow}>
            <MaterialIcons name="access-time" size={14} color="#FFFFFF" />
            <Text style={styles.closedOverlayText} numberOfLines={1}>
              {closedOverlayLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {showAddButton ? (
        isClosed ? (
          <View style={styles.closedPill}>
            <Text style={styles.closedPillText}>{unavailableLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.8} style={styles.addButton} onPress={onAddPress} disabled={!onAddPress}>
            <Text style={styles.addButtonPlus}>+</Text>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )
      ) : null}

      <View style={[styles.textContent, { width: imageWidth }]}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {priceLabel ? (
          <Text style={styles.price} numberOfLines={1}>
            {priceLabel}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingBottom: 0,
  },
  imageWrapper: {
    width: 155,
    height: 137,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    position: 'relative',
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageClosed: {
    opacity: 1,
  },
  disabledImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(55, 65, 81, 0.45)',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: -22,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#00B14F',
    width: 76,
    height: 37,
    zIndex: 3,
    elevation: 3,
  },
  addButtonPlus: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 27,
    color: '#00B14F',
    opacity: 0.85,
  },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 26,
    color: '#00B14F',
    opacity: 0.85,
  },
  closedPill: {
    alignSelf: 'center',
    marginTop: -22,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    width: 76,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    elevation: 3,
  },
  closedPillText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: '#6B7280',
  },
  closedOverlayRow: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '86%',
  },
  closedOverlayText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  textContent: {
    marginTop: 10,
    width: 155,
    alignSelf: 'center',
  },
  name: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
  },
  price: {
    marginTop: 4,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
  },
});
