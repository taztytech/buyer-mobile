import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { OptimizedImage } from '@/components/OptimizedImage';
import { searchService, SearchSuggestion } from '@/services/search.service';
import { SearchBar } from '@/components/SearchBar';
import { BrandedLoader } from '@/components/BrandedLoader';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GUEST_SELECTED_LOCATION_KEY } from '@/services/storage.service';
import { useVegMode } from '@/context/VegModeContext';

// Default location fallback (same as HomeScreen)
const DEFAULT_LOCATION = {
  latitude: 9.9352300,
  longitude: 78.1304040,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const RECENT_SEARCHES_KEY = 'tazty_recent_searches';
const MAX_RECENT = 8;
const POPULAR_SEARCHES = ['Chicken Biryani', 'Dosa', 'Meals', 'Parotta', 'Idly', 'Ice Cream'];

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
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
  searchQuery?: string;
  searchResults?: SearchSuggestion[];
  onSearchQueryChange?: (query: string) => void;
  onSearchResultsChange?: (results: SearchSuggestion[]) => void;
  onClearSearch?: () => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onBack,
  onSelectResult,
  onSelectItem,
  onSelectRestaurant,
  selectedLocation,
  searchQuery: propSearchQuery = '',
  searchResults: propSearchResults = [],
  onSearchQueryChange,
  onSearchResultsChange,
  onClearSearch,
}) => {
  // Use props if provided, otherwise fall back to local state for backward compatibility
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localSearchResults, setLocalSearchResults] = useState<SearchSuggestion[]>([]);

  const searchQuery = onSearchQueryChange ? propSearchQuery : localSearchQuery;
  const searchResults = onSearchResultsChange ? propSearchResults : localSearchResults;

  const setSearchQuery = onSearchQueryChange || setLocalSearchQuery;
  const setSearchResults = onSearchResultsChange || setLocalSearchResults;

  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Recent searches — persisted per device so every visit to search shows them.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setRecentSearches(parsed.filter((x) => typeof x === 'string'));
        }
      })
      .catch(() => {});
  }, []);

  const saveRecentSearch = (termRaw: string) => {
    const term = (termRaw || '').trim();
    if (term.length < 2) return;
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
  };
  const { vegMode } = useVegMode();

  // Get user location on mount or when selectedLocation changes
  useEffect(() => {
    getUserLocation();
  }, [selectedLocation]);

  const getUserLocation = async () => {
    // Priority 1: Use location from props (passed from App.tsx - same as HomeScreen)
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      setUserLocation({
        lat: selectedLocation.latitude,
        lng: selectedLocation.longitude,
      });
      return;
    }

    // Priority 2: Try AsyncStorage (saved location)
    try {
      const savedLocationStr = await AsyncStorage.getItem(GUEST_SELECTED_LOCATION_KEY);
      if (savedLocationStr) {
        const savedLocation = JSON.parse(savedLocationStr);
        if (savedLocation.latitude && savedLocation.longitude) {
          setUserLocation({
            lat: savedLocation.latitude,
            lng: savedLocation.longitude,
          });
          return;
        }
      }
    } catch (error) {
      // AsyncStorage unavailable
    }

    // Priority 3: Use default location (no device location attempt - too slow)
    setUserLocation({
      lat: DEFAULT_LOCATION.latitude,
      lng: DEFAULT_LOCATION.longitude,
    });
  };

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

    // Wait for location to be set before searching
    if (!userLocation) {
      // Location is still loading, wait a bit
      setIsLoading(true);
      return;
    }

    // Set loading state
    setIsLoading(true);

    // Debounce the search
    debounceTimer.current = setTimeout(async () => {
      try {
        // Pass location if available, otherwise search without location filter
        const response = await searchService.getSearchSuggestions(
          searchQuery,
          userLocation?.lat,
          userLocation?.lng,
          vegMode
        );

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
  }, [searchQuery, userLocation, vegMode]);

  const renderSearchResult = ({ item, index }: { item: SearchSuggestion; index?: number }) => {
    // Get image URL
    const imageUrl = item.type === 'restaurant'
      ? item.logo_url
      : (item.images && item.images.length > 0 ? item.images[0] : item.image);

    // Handle item click
    const handlePress = () => {
      saveRecentSearch(searchQuery);
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
            <OptimizedImage
              source={imageUrl}
              style={styles.resultIcon}
              contentFit="cover"
              shimmerWidth={40}
              shimmerHeight={40}
              shimmerBorderRadius={8}
              transition={200}
              priority="normal"
              cachePolicy="memory-disk"
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

  const isTyping = searchQuery.trim().length >= 2;
  return (
    <View style={styles.overlayRoot}>
      {/* The sheet: compact (recent + popular over dimmed home) when empty,
          full-screen results while typing. */}
      <View style={[styles.sheet, isTyping ? styles.sheetFull : styles.sheetCompact]}>
        <SafeAreaView style={styles.sheetTop} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        </SafeAreaView>
        {/* Header with Back Button and Search Input */}
        <SearchBar
          onBack={onBack}
          value={searchQuery}
          onChangeText={setSearchQuery}
          showClearButton={true}
          onClear={onClearSearch}
          backButtonColor="#14181B"
          autoFocus={true}
          cursorColor="#00B14F"
        />

        {/* Content Area */}
        <View style={[styles.contentArea, isTyping && styles.contentAreaFull]}>
          {/* Loading State */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <BrandedLoader fullScreen={false} />
            </View>
          )}

          {/* Search Results */}
          {!isLoading && searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={searchResults}
                renderItem={({ item, index }) => renderSearchResult({ item, index })}
                keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                contentContainerStyle={styles.flatListContent}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
                updateCellsBatchingPeriod={50}
              />
            </View>
          )}

          {/* Empty State */}
          {!isLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={64} color="rgba(0, 0, 0, 0.2)" />
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>
                Try searching for something else
              </Text>
            </View>
          )}

          {/* Initial State — recent + popular searches */}
          {!isLoading && searchQuery.trim().length < 2 && (
            <ScrollView
              style={styles.discoverScroll}
              contentContainerStyle={styles.discoverContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {recentSearches.length > 0 && (
                <>
                  <View style={styles.discoverHeader}>
                    <Text style={styles.discoverTitle}>RECENT SEARCHES</Text>
                    <TouchableOpacity onPress={clearRecentSearches} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.clearRecent}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.chipWrap}>
                    {recentSearches.map((term) => (
                      <TouchableOpacity
                        key={`recent-${term}`}
                        style={styles.chip}
                        onPress={() => setSearchQuery(term)}
                        activeOpacity={0.75}
                        testID={`recent-search-${term}`}
                      >
                        <MaterialIcons name="history" size={15} color="#8A939B" />
                        <Text style={styles.chipText}>{term}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.discoverTitle, recentSearches.length > 0 && { marginTop: 22 }]}>
                POPULAR SEARCHES
              </Text>
              <View style={styles.chipWrap}>
                {POPULAR_SEARCHES.map((term) => (
                  <TouchableOpacity
                    key={`popular-${term}`}
                    style={styles.chip}
                    onPress={() => setSearchQuery(term)}
                    activeOpacity={0.75}
                    testID={`popular-search-${term}`}
                  >
                    <Text style={styles.chipText}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
      {/* Dimmed home shows below the compact sheet; tap to close. */}
      {!isTyping && (
        <Pressable style={styles.backdrop} onPress={onBack} testID="search-backdrop" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sheetCompact: {
    maxHeight: '74%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  sheetFull: {
    flex: 1,
  },
  sheetTop: {
    backgroundColor: '#FFFFFF',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  contentArea: {
    // wraps content when compact (recent + popular)
  },
  contentAreaFull: {
    flex: 1,
  },
  discoverScroll: {
    flexGrow: 0,
  },
  discoverContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  discoverTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 1.2,
    color: '#8A939B',
    marginBottom: 12,
  },
  clearRecent: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    color: '#0A6B36',
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD3',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  chipText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  flatListContent: {
    flexGrow: 0,
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
