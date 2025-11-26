import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Shimmer } from '@/components/Shimmer';
import { SearchBar } from '@/components/SearchBar';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: any;
  isVeg: boolean;
  isSpicy: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
}

interface MenuSection {
  id: string;
  items: MenuItem[];
}

interface CustomizationVariant {
  id: string;
  addOns: string[];
  addOnNames?: string[];
  price: number;
  quantity: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  isCustomizable?: boolean;
  // For non-customizable items
  quantity?: number;
  // For customizable items
  variants?: CustomizationVariant[];
}

interface SearchScreenProps {
  onBack?: () => void;
  menuItems?: MenuSection[];
  cart?: { [key: string]: CartItem };
  onAddToCart?: (item: MenuItem) => void;
  onIncrementItem?: (itemId: string) => void;
  onDecrementItem?: (itemId: string) => void;
  onCustomizableItemClick?: (item: MenuItem) => void;
  onImageClick?: (item: MenuItem) => void;
  loadedImages?: Set<string>;
  onImageLoad?: (itemId: string) => void;
  isRestaurantClosed?: boolean;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onBack,
  menuItems = [],
  cart = {},
  onAddToCart,
  onIncrementItem,
  onDecrementItem,
  onCustomizableItemClick,
  onImageClick,
  loadedImages = new Set(),
  onImageLoad,
  isRestaurantClosed = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);

  // Get total quantity for an item (works for both customizable and non-customizable)
  const getItemQuantity = (itemId: string): number => {
    const cartItem = cart[itemId];
    if (!cartItem) return 0;

    if (cartItem.isCustomizable && cartItem.variants) {
      return cartItem.variants.reduce((sum, variant) => sum + variant.quantity, 0);
    }

    return cartItem.quantity || 0;
  };

  // Handle search text updates
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Re-compute search results whenever the query or menu items change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    const results: MenuItem[] = [];

    menuItems.forEach((section) => {
      section?.items?.forEach((item: MenuItem) => {
        if (
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery)
        ) {
          results.push(item);
        }
      });
    });

    setSearchResults(results);
  }, [searchQuery, menuItems]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <SearchBar
          onBack={onBack}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search for dishes..."
          showClearButton={true}
          autoFocus={true}
        />

        {/* Search Results */}
        <ScrollView
          style={styles.resultsContainer}
          showsVerticalScrollIndicator={false}
        >
          {searchQuery.trim() !== '' && searchResults.length > 0 && (
            <View style={styles.menuContent}>
              {searchResults.map((item) => {
                const currentQuantity = getItemQuantity(item.id);
                const isAtQuantityLimit = currentQuantity >= MAX_ITEM_QUANTITY;

                return (
                <View key={item.id} style={styles.menuItem}>
                  <View style={styles.itemLeft}>
                    {/* Veg/Non-Veg Icon and Spicy Badge */}
                    <View style={styles.itemBadges}>
                      <View style={[
                        styles.vegIconLarge,
                        !item.isVeg && styles.nonVegIconLarge
                      ]}>
                        <View style={[
                          styles.vegDotLarge,
                          !item.isVeg && styles.nonVegDotLarge
                        ]} />
                      </View>
                      {item.isSpicy && (
                        <View style={styles.spicyBadge}>
                          <MaterialIcons name="local-fire-department" size={9} color="#FF0000" />
                          <Text style={styles.spicyText}>Spicy</Text>
                        </View>
                      )}
                    </View>

                    {/* Item Name */}
                    <Text style={styles.itemName}>{item.name}</Text>

                    {/* Best Seller Badge */}
                    {item.isBestSeller && (
                      <View style={styles.bestSellerBadge}>
                        <MaterialIcons name="star" size={8} color="#FFC529" />
                        <Text style={styles.bestSellerText}>Best Seller</Text>
                      </View>
                    )}

                    {/* Price */}
                    <Text style={styles.itemPrice}>₹ {item.price}</Text>

                    {/* Description */}
                    <View style={styles.descriptionContainer}>
                      <Text style={styles.itemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>

                    {/* Extra spacing removed now that action icons are hidden */}
                  </View>

                  <View style={styles.itemRight}>
                    {/* Item Image with Shimmer */}
                    <TouchableOpacity
                      style={styles.itemImageContainer}
                      onPress={() => {
                        if (!isRestaurantClosed && onImageClick) {
                          onImageClick(item);
                        }
                      }}
                      disabled={isRestaurantClosed}
                      activeOpacity={isRestaurantClosed ? 1 : 0.9}
                    >
                      {!loadedImages.has(item.id) && (
                        <Shimmer
                          width={166}
                          height={137}
                          borderRadius={16}
                          backgroundColor="#E8E8E8"
                          style={styles.imageShimmer}
                        />
                      )}
                      <Image
                        source={item.image}
                        style={styles.itemImage}
                        resizeMode="cover"
                        onLoad={() => onImageLoad && onImageLoad(item.id)}
                      />
                    </TouchableOpacity>

                    {/* Add Button or Increment/Decrement Controls */}
                    {loadedImages.has(item.id) && !isRestaurantClosed && (
                      <>
                        {cart[item.id] ? (
                          // Show increment/decrement controls if item is in cart
                          <View style={styles.quantityControl}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => onDecrementItem && onDecrementItem(item.id)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.quantityButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{currentQuantity}</Text>
                            <TouchableOpacity
                              style={[
                                styles.quantityButton,
                                isAtQuantityLimit && styles.quantityButtonDisabled,
                              ]}
                              onPress={() => onIncrementItem && onIncrementItem(item.id)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              disabled={isAtQuantityLimit}
                            >
                              <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          // Show Add button
                          <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => {
                              if (item.isCustomizable && onCustomizableItemClick) {
                                onCustomizableItemClick(item);
                              } else if (onAddToCart) {
                                onAddToCart(item);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.addButtonPlus}>+</Text>
                            <Text style={styles.addButtonText}>Add</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {/* Customizable Text */}
                    {loadedImages.has(item.id) && item.isCustomizable && (
                      <Text style={styles.customizableText}>Customisable</Text>
                    )}
                  </View>
                </View>
              );
              })}
            </View>
          )}

          {searchQuery.trim() !== '' && searchResults.length === 0 && (
            <View style={styles.noResultsContainer}>
              <MaterialIcons name="search-off" size={48} color="rgba(0, 0, 0, 0.3)" />
              <Text style={styles.noResultsTitle}>No results found</Text>
              <Text style={styles.noResultsMessage}>
                Try searching for something else
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
  },
  menuContent: {
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 9,
  },
  menuItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    height: 192,
  },
  itemLeft: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
    gap: 3,
  },
  itemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 13,
  },
  vegIconLarge: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDotLarge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B14F',
  },
  nonVegIconLarge: {
    borderColor: '#FF0000',
  },
  nonVegDotLarge: {
    backgroundColor: '#FF0000',
  },
  spicyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 1,
    height: 13,
    backgroundColor: 'rgba(213, 0, 0, 0.13)',
    borderWidth: 0.5,
    borderColor: '#FF0000',
    borderRadius: 13,
  },
  spicyText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 7,
    lineHeight: 10,
    color: '#FF0000',
    opacity: 0.85,
  },
  itemName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'left',
    color: '#000000',
    opacity: 0.85,
  },
  bestSellerBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 1,
    width: 55,
    height: 16,
    backgroundColor: 'linear-gradient(90deg, #FFF2CF 0%, rgba(255, 255, 255, 0) 100%)',
    borderRadius: 2,
  },
  bestSellerText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 8,
    lineHeight: 12,
    color: '#000000',
    opacity: 0.85,
  },
  itemPrice: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  descriptionContainer: {
    width: 165,
  },
  itemDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
  },
  itemRight: {
    width: 166,
    alignItems: 'flex-start',
    gap: 26,
  },
  itemImageContainer: {
    width: 166,
    height: 137,
    borderRadius: 16,
    position: 'relative',
  },
  imageShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  itemImage: {
    width: 166,
    height: 137,
    borderRadius: 16,
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 13,
    gap: 2,
    width: 76,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 9,
    position: 'absolute',
    top: 115,
    left: 53,
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
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    width: 76,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 9,
    position: 'absolute',
    top: 115,
    left: 53,
  },
  quantityButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 20,
    color: '#00B14F',
    opacity: 0.85,
    marginTop: -2,
  },
  quantityText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#00B14F',
    minWidth: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  customizableText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    width: 181,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noResultsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    textAlign: 'center',
  },
});
