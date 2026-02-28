import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface SearchBarProps extends TextInputProps {
  onBack?: () => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  showBackButton?: boolean;
  showClearButton?: boolean;
  onClear?: () => void;
  backButtonColor?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onBack,
  value,
  onChangeText,
  placeholder = 'Search for restaurants & foods',
  showBackButton = true,
  showClearButton = false,
  onClear,
  backButtonColor = '#000000',
  ...textInputProps
}) => {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChangeText('');
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (onBack) {
      onBack();
    }
  };

  return (
    <View style={styles.container}>
      {showBackButton && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <MaterialIcons name="chevron-left" size={24} color={backButtonColor} />
        </TouchableOpacity>
      )}

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color="#00B14F" />
        <TextInput autoCorrect={false}
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          value={value}
          onChangeText={onChangeText}
          {...textInputProps}
        />
        {showClearButton && value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.4)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 14,
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
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    color: '#000000',
    padding: 0,
    margin: 0,
    paddingTop: 1,
    textAlignVertical: 'center',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});
