import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { homeService, DishItem } from '@/services/home.service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CategoryItem {
  id: number | string;
  name: string;
  description: string;
  icon: any;
  food_type?: string;
}

interface CategoryModalProps {
  visible: boolean;
  categories: CategoryItem[];
  onClose: () => void;
  onCategorySelect: (categoryName: string) => void;
  vegMode?: 'off' | 'pure' | 'all';
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  visible,
  categories,
  onClose,
  onCategorySelect,
  vegMode = 'off',
}) => {
  const slideAnim = useRef(new Animated.Value(1000)).current;
  const [allDishes, setAllDishes] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      // Fetch all dishes when modal opens
      fetchAllDishes();
    } else {
      slideAnim.setValue(1000);
    }
  }, [visible, vegMode]);

  const fetchAllDishes = async () => {
    setIsLoading(true);
    try {
      // Determine food_type parameter based on vegMode
      let foodTypeParam: string | undefined;
      if (vegMode === 'pure') {
        foodTypeParam = 'Veg';
      } else if (vegMode === 'all') {
        foodTypeParam = undefined; // Fetch all dishes
      } else {
        foodTypeParam = undefined; // vegMode is 'off', fetch all
      }

      const dishResponse = await homeService.getDishes(foodTypeParam, 30, 1); // Fetch up to 30 dishes

      // The API returns dishes in data.data, not data.dishes
      const dishesArray = dishResponse.data?.data || dishResponse.data?.dishes || [];

      if (dishResponse.success && dishesArray.length > 0) {
        // Transform dishes to category format
        const dishCategories: CategoryItem[] = dishesArray.map((dish: any) => ({
          id: dish.id,
          name: dish.name || dish.dish_name,
          description: dish.description,
          icon: dish.icon || dish.image || dish.image_url || dish.dish_image || dish.images?.[0],
          food_type: dish.food_type || dish.foodType || dish.type,
        }));

        setAllDishes(dishCategories);
      } else {
        // If API fails, use categories from props
        const filteredCategories = categories.filter(
          (cat) => cat.id !== 'view-all' && cat.name !== 'View All'
        );
        setAllDishes(filteredCategories);
      }
    } catch (error) {
      // On error, use categories from props
      const filteredCategories = categories.filter(
        (cat) => cat.id !== 'view-all' && cat.name !== 'View All'
      );
      setAllDishes(filteredCategories);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out the "View All" item from the modal display
  const filteredCategories = categories.filter(
    (cat) => cat.id !== 'view-all' && cat.name !== 'View All'
  );

  // Use dishes from API if loaded, otherwise use categories from props
  const displayData = allDishes.length > 0 ? allDishes : filteredCategories;

  const renderCategoryItem = ({ item }: { item: CategoryItem }) => {
    const imageSource = typeof item.icon === 'string' ? { uri: item.icon } : item.icon;

    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => {
          onCategorySelect(item.name);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.categoryImage} resizeMode="cover" />
        </View>
        <Text style={styles.categoryName} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <MaterialIcons name="close" size={14} color="#000000" />
            </TouchableOpacity>

            {/* Category Grid */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00B14F" />
                <Text style={styles.loadingText}>Loading dishes...</Text>
              </View>
            ) : (
              <FlatList
                data={displayData}
                renderItem={renderCategoryItem}
                keyExtractor={(item) => item.id.toString()}
                numColumns={4}
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.row}
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '85%',
  },
  closeButton: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    top: -36,
    left: '50%',
    marginLeft: -13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  gridContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  row: {
    justifyContent: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 80) / 4,
    alignItems: 'center',
  },
  imageContainer: {
    width: (SCREEN_WIDTH - 80) / 4,
    height: (SCREEN_WIDTH - 80) / 4,
    borderRadius: ((SCREEN_WIDTH - 80) / 4) / 2,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 60,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
  },
});
