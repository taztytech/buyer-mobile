import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 20;
const CARD_GAP = 10;
const NUM_COLUMNS = 3;
// Calculate card width: total available width minus gaps, divided by number of columns
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// Debug: Log the calculations
console.log('[Favorites] Screen width:', SCREEN_WIDTH);
console.log('[Favorites] Card width:', CARD_WIDTH);
console.log('[Favorites] Total width check:', CARD_WIDTH * NUM_COLUMNS + CARD_GAP * (NUM_COLUMNS - 1));

interface DishCategory {
  id: string;
  name: string;
  image: any;
}

interface Restaurant {
  id: string;
  name: string;
  image: any;
}

interface ExploreDishesScreenProps {
  onBack?: () => void;
  onSelectCategory?: (category: DishCategory) => void;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
}

export const ExploreDishesScreen: React.FC<ExploreDishesScreenProps> = ({
  onBack,
  onSelectCategory,
  onSelectRestaurant,
}) => {
  const dishCategories: DishCategory[] = [
    {
      id: '1',
      name: 'Briyani',
      image: require('@/assets/biriyani.png'),
    },
    {
      id: '2',
      name: 'South Indian',
      image: require('@/assets/idlies.png'),
    },
    {
      id: '3',
      name: 'Pizza',
      image: require('@/assets/pizza.png'),
    },
    {
      id: '4',
      name: 'Burger',
      image: require('@/assets/burger.png'),
    },
    {
      id: '5',
      name: 'Cake',
      image: require('@/assets/cake.png'),
    },
    {
      id: '6',
      name: 'Idlies',
      image: require('@/assets/idlies.png'),
    },
  ];

  const favoriteRestaurants: Restaurant[] = [
    {
      id: '1',
      name: 'Zam Zam',
      image: require('@/assets/dummy-restaurent.png'),
    },
    {
      id: '2',
      name: 'KFC',
      image: require('@/assets/dummy-restaurent.png'),
    },
    {
      id: '3',
      name: 'Dominos',
      image: require('@/assets/dummy-restaurent.png'),
    },
    {
      id: '4',
      name: 'Burger King',
      image: require('@/assets/dummy-restaurent.png'),
    },
    {
      id: '5',
      name: 'Pizza Hut',
      image: require('@/assets/dummy-restaurent.png'),
    },
    {
      id: '6',
      name: 'Subway',
      image: require('@/assets/dummy-restaurent.png'),
    },
  ];

  const renderDishCard = (item: DishCategory) => (
    <TouchableOpacity
      key={item.id}
      style={styles.dishCard}
      onPress={() => onSelectCategory && onSelectCategory(item)}
      activeOpacity={0.7}
    >
      <View style={styles.dishImageContainer}>
        <Image source={item.image} style={styles.dishImage} />
      </View>
      <View style={styles.dishLabelContainer}>
        <Text style={styles.dishName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRestaurantCard = (item: Restaurant) => (
    <TouchableOpacity
      key={item.id}
      style={styles.dishCard}
      onPress={() => onSelectRestaurant && onSelectRestaurant(item)}
      activeOpacity={0.7}
    >
      <View style={styles.dishImageContainer}>
        <Image source={item.image} style={styles.dishImage} />
      </View>
      <View style={styles.dishLabelContainer}>
        <Text style={styles.dishName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>My Favorites</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Favorite Food Items Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorite Food Items</Text>
            <View style={styles.gridContainer}>
              {dishCategories.map((item) => renderDishCard(item))}
            </View>
          </View>

          {/* Favorite Restaurants Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorite Restaurants</Text>
            <View style={styles.gridContainer}>
              {favoriteRestaurants.map((item) => renderRestaurantCard(item))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
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
    backgroundColor: '#FFFFFF',
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
    lineHeight: 27,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.85,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: CARD_GAP,
    rowGap: 20,
    justifyContent: 'flex-start',
  },
  dishCard: {
    width: CARD_WIDTH,
    height: 103,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  dishImageContainer: {
    width: CARD_WIDTH,
    height: 79,
    backgroundColor: '#C9F5C6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginBottom: -9,
    zIndex: 2,
  },
  dishImage: {
    width: CARD_WIDTH - 30,
    height: 60,
    resizeMode: 'contain',
  },
  dishLabelContainer: {
    width: CARD_WIDTH,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 4,
    zIndex: 1,
  },
  dishName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
});
