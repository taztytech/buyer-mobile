import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface SearchResult {
  id: string;
  name: string;
  type: 'Dish' | 'Restaurant';
  icon: any;
}

interface SearchScreenProps {
  onBack?: () => void;
  onSelectResult?: (result: SearchResult) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onBack,
  onSelectResult,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Mock search results - replace with actual search logic
  const mockResults: SearchResult[] = [
    {
      id: '1',
      name: 'Burger',
      type: 'Dish',
      icon: require('@/assets/icon.png'),
    },
    {
      id: '2',
      name: 'Veg Burger',
      type: 'Dish',
      icon: require('@/assets/icon.png'),
    },
    {
      id: '3',
      name: 'Burger King',
      type: 'Restaurant',
      icon: require('@/assets/icon.png'),
    },
  ];

  const filteredResults = searchQuery
    ? mockResults.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => onSelectResult && onSelectResult(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultLeft}>
        <Image source={item.icon} style={styles.resultIcon} />
        <Text style={styles.resultName}>{item.name}</Text>
      </View>
      <View style={styles.resultRight}>
        <Text style={styles.resultType}>{item.type}</Text>
        <MaterialIcons name="arrow-forward" size={24} color="#000000" />
      </View>
    </TouchableOpacity>
  );

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
          <MaterialIcons name="chevron-left" size={28} color="#000000" />
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
            placeholderTextColor="rgba(0, 0, 0, 0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            cursorColor="#000000"
          />
        </View>
      </View>

      {/* Search Results */}
      {filteredResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={filteredResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Empty State */}
      {searchQuery && filteredResults.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results found</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 15,
    color: '#000000',
    paddingVertical: 0,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 20,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    height: 46,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultIcon: {
    width: 26,
    height: 26,
    borderRadius: 20,
  },
  resultName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  resultRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultType: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
  },
});
