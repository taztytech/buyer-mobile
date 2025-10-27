import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { searchService, SearchSuggestion } from '@/services/search.service';

interface SearchResult {
  id: string;
  name: string;
  type: 'Dish' | 'Restaurant';
  icon: any;
}

interface SearchScreenProps {
  onBack?: () => void;
  onSelectResult?: (result: SearchResult) => void;
  onSelectItem?: (itemId: number, itemName: string) => void;
  onSelectRestaurant?: (restaurantId: number, restaurantName: string) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onBack,
  onSelectResult,
  onSelectItem,
  onSelectRestaurant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch search suggestions with debouncing
  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Don't search for empty queries or queries less than 2 characters
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Set loading state
    setIsLoading(true);

    // Debounce the search
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await searchService.getSearchSuggestions(searchQuery);

        if (response.success && response.data) {
          // Combine items and restaurants into a single array
          const items: SearchSuggestion[] = (response.data.items || []).map(item => ({
            ...item,
            type: 'item' as const,
          }));

          const restaurants: SearchSuggestion[] = (response.data.restaurants || []).map(restaurant => ({
            ...restaurant,
            type: 'restaurant' as const,
          }));

          const combined = [...items, ...restaurants];
          setSearchResults(combined);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce delay

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  const renderSearchResult = ({ item, index }: { item: SearchSuggestion; index?: number }) => {
    // Get image URL
    const imageUrl = item.type === 'restaurant'
      ? item.logo_url
      : (item.images && item.images.length > 0 ? item.images[0] : item.image);

    // Handle item click
    const handlePress = () => {
      if (item.type === 'restaurant' && onSelectRestaurant) {
        onSelectRestaurant(item.id, item.name);
      } else if (item.type === 'item' && onSelectItem) {
        onSelectItem(item.id, item.name);
      }
    };

    const isLastItem = index !== undefined && index === searchResults.length - 1;

    return (
      <TouchableOpacity
        style={[styles.resultItem, isLastItem && { borderBottomWidth: 0 }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.resultLeft}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.resultIcon}
              defaultSource={require('@/assets/icon.png')}
            />
          ) : (
            <View style={[styles.resultIcon, styles.placeholderIcon]}>
              <MaterialIcons name="restaurant" size={20} color="#999999" />
            </View>
          )}
          <Text style={styles.resultName}>{item.name}</Text>
        </View>
        <View style={styles.resultRight}>
          <Text style={styles.resultType}>
            {item.type === 'restaurant' ? 'Restaurant' : 'Dish'}
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color="#000000" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header with Back Button and Search Input */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>

        <View style={styles.searchInputContainer}>
          <MaterialIcons
            name="search"
            size={24}
            color="rgba(0, 0, 0, 0.4)"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Restaurants & foods.."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
            cursorColor="#00B14F"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.4)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B14F" />
        </View>
      )}

      {/* Search Results */}
      {!isLoading && searchResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={searchResults}
            renderItem={({ item, index }) => renderSearchResult({ item, index })}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Empty State */}
      {!isLoading && searchQuery && searchResults.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={64} color="rgba(0, 0, 0, 0.2)" />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>
            Try searching for something else
          </Text>
        </View>
      )}

      {/* Initial State */}
      {!isLoading && searchQuery.trim().length < 2 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="search" size={64} color="rgba(0, 0, 0, 0.2)" />
          <Text style={styles.emptyText}>Search for dishes & restaurants</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery.trim().length === 0
              ? 'Type at least 2 characters to search'
              : 'Type one more character to search'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
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
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderIcon: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    flex: 1,
  },
  resultRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultType: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#666666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
    marginTop: 8,
    textAlign: 'center',
  },
});
