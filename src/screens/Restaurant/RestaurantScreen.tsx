import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RestaurantScreenProps {
  restaurantName: string;
  onBack?: () => void;
}

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
  title: string;
  items: MenuItem[];
  isExpanded: boolean;
}

const CATEGORIES = ['Briyani', 'Idly', 'Dosa', 'Pongal', 'Fried Rice', 'Noodles'];

const MENU_DATA: MenuSection[] = [
  {
    id: '1',
    title: 'Snacks',
    isExpanded: false,
    items: [],
  },
  {
    id: '2',
    title: 'Morning Tiffin',
    isExpanded: false,
    items: [],
  },
  {
    id: '3',
    title: 'Restaurants Near You',
    isExpanded: true,
    items: [
      {
        id: '1',
        name: 'Rava Kichadi',
        price: 120,
        description: 'Spicy Coriander leaves in the top and Freshly Cooked Rav with ghee in the top..More',
        image: require('@/assets/biriyani.png'),
        isVeg: true,
        isSpicy: true,
        isBestSeller: true,
        isCustomizable: true,
      },
      {
        id: '2',
        name: 'Idly',
        price: 120,
        description: 'Spicy Coriander leaves in the top and Freshly Cooked Rav with ghee in the top..More',
        image: require('@/assets/idlies.png'),
        isVeg: true,
        isSpicy: true,
        isBestSeller: true,
        isCustomizable: true,
      },
      {
        id: '3',
        name: 'Pongal',
        price: 120,
        description: 'Spicy Coriander leaves in the top and Freshly Cooked Rav with ghee in the top..More',
        image: require('@/assets/biriyani.png'),
        isVeg: true,
        isSpicy: true,
        isBestSeller: true,
        isCustomizable: true,
      },
    ],
  },
];

export const RestaurantScreen: React.FC<RestaurantScreenProps> = ({
  restaurantName,
  onBack,
}) => {
  const [menuSections, setMenuSections] = useState(MENU_DATA);
  const [selectedCategory, setSelectedCategory] = useState('Idly');
  const [cartCount, setCartCount] = useState(1);

  const toggleSection = (sectionId: string) => {
    setMenuSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, isExpanded: !section.isExpanded }
          : section
      )
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header Image with Overlay */}
      <ImageBackground
        source={require('@/assets/biriyani.png')}
        style={styles.headerImage}
        resizeMode="cover"
      >
        <View style={styles.headerOverlay}>
          {/* Status Bar Placeholder */}
          <View style={styles.statusBar}>
            <Text style={styles.time}>9:41</Text>
            <View style={styles.statusIcons} />
          </View>

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
          </TouchableOpacity>

          {/* Restaurant Info Card */}
          <View style={styles.restaurantCard}>
            <View style={styles.restaurantTopRow}>
              <View style={styles.restaurantNameRow}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {restaurantName}
                </Text>
                <MaterialIcons name="info-outline" size={19} color="#00B14F" />
              </View>
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={14} color="#00B14F" />
                <Text style={styles.ratingText}>4.5</Text>
              </View>
            </View>

            {/* Dotted Divider */}
            <View style={styles.dividerContainer}>
              {Array.from({ length: 30 }).map((_, index) => (
                <View key={index} style={styles.dash} />
              ))}
            </View>

            <View style={styles.restaurantBottomRow}>
              <Text style={styles.locationText}>Keelkattalai</Text>
              <Text style={styles.deliveryText}>10-15 mins</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* Filter Buttons with Search */}
      <View style={styles.filterSectionContainer}>
        <View style={styles.filterSection}>
          <TouchableOpacity style={styles.filterButton}>
            <MaterialIcons name="filter-list" size={16} color="#000000" />
            <Text style={styles.filterText}>Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButtonActive}>
            <View style={styles.vegIcon}>
              <View style={styles.vegDot} />
            </View>
            <Text style={styles.filterTextActive}>Veg</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <View style={styles.nonVegIcon}>
              <View style={styles.nonVegDot} />
            </View>
            <Text style={styles.filterText}>Non - Veg</Text>
          </TouchableOpacity>
        </View>

        {/* Search Button */}
        <TouchableOpacity style={styles.searchButton}>
          <MaterialIcons name="search" size={24} color="#00B14F" />
        </TouchableOpacity>
      </View>

      {/* Menu Sections */}
      <ScrollView
        style={styles.menuContainer}
        contentContainerStyle={styles.menuContent}
        showsVerticalScrollIndicator={false}
      >
        {menuSections.map((section) => (
          <View key={section.id} style={styles.menuSection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={24}
                color="#000000"
                style={[
                  styles.arrowIcon,
                  section.isExpanded && styles.arrowIconExpanded,
                ]}
              />
            </TouchableOpacity>

            <View style={styles.sectionDivider} />

            {section.isExpanded && section.items.map((item) => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.itemLeft}>
                  {/* Veg Icon and Spicy Badge */}
                  <View style={styles.itemBadges}>
                    <View style={styles.vegIconLarge} />
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
                  <Text style={styles.itemDescription} numberOfLines={3}>
                    {item.description}
                  </Text>

                  {/* Like and Share Buttons */}
                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.actionButton}>
                      <MaterialIcons name="favorite-border" size={17} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                      <MaterialIcons name="share" size={17} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.itemRight}>
                  {/* Item Image */}
                  <Image source={item.image} style={styles.itemImage} resizeMode="cover" />

                  {/* Add Button */}
                  <TouchableOpacity style={styles.addButton}>
                    <Text style={styles.addButtonPlus}>+</Text>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>

                  {/* Customizable Text */}
                  {item.isCustomizable && (
                    <Text style={styles.customizableText}>Customisable</Text>
                  )}
                </View>
              </View>
            ))}

            {section.id !== menuSections[menuSections.length - 1].id && (
              <View style={styles.sectionSeparator} />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Cart Bar */}
      <View style={styles.cartBar}>
        <View style={styles.cartButton}>
          <Text style={styles.cartItemCount}>{cartCount} Item Added</Text>
          <View style={styles.viewCartButton}>
            <Text style={styles.viewCartText}>View Cart</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#181C2E" />
          </View>
        </View>
      </View>

      {/* Floating Menu Button */}
      <TouchableOpacity style={styles.floatingMenuButton}>
        <MaterialIcons name="restaurant-menu" size={14} color="#000000" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerImage: {
    width: SCREEN_WIDTH,
    height: 252,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
    paddingTop: 10,
  },
  time: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
  },
  statusIcons: {
    width: 80,
    height: 13,
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
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  restaurantTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  restaurantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: 'rgba(0, 128, 74, 0.1)',
    borderRadius: 13,
  },
  ratingText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
    opacity: 0.85,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    height: 1,
  },
  dash: {
    width: 8,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  restaurantBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  deliveryText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: '#00B14F',
    opacity: 0.85,
  },
  filterSectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 9,
    marginTop: 19,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
    height: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
  },
  filterButtonActive: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
    height: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
  },
  filterText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  filterTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  vegIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B14F',
  },
  nonVegIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonVegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF0000',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    flex: 1,
    marginTop: 10,
  },
  menuContent: {
    paddingHorizontal: 0,
    paddingBottom: 120,
  },
  menuSection: {
    gap: 9,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginHorizontal: 20,
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
    textAlign: 'center',
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
  itemDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    width: 181,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
    width: 53,
    height: 25,
  },
  actionButton: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRight: {
    width: 166,
    alignItems: 'flex-start',
    gap: 26,
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
  sectionSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cartButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    height: 60,
    backgroundColor: '#181C2E',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 29,
    elevation: 5,
  },
  cartItemCount: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  viewCartButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  viewCartText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#181C2E',
    opacity: 0.85,
  },
  floatingMenuButton: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#FFC529',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 29,
    elevation: 10,
  },
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  arrowIconExpanded: {
    transform: [{ rotate: '180deg' }],
  },
});
