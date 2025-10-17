import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface Address {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  fullAddress: string;
  isDefault: boolean;
}

interface MyAddressesScreenProps {
  onBack?: () => void;
  onAddNew?: () => void;
  onEdit?: (addressId: string) => void;
  onDelete?: (addressId: string) => void;
}

export const MyAddressesScreen: React.FC<MyAddressesScreenProps> = ({
  onBack,
  onAddNew,
  onEdit,
  onDelete,
}) => {
  // Mock data - replace with actual data from API
  const addresses: Address[] = [
    {
      id: '1',
      type: 'Home',
      fullAddress: 'Vigneshwar Nagar, Nanganallur, Tamilnadu, India',
      isDefault: true,
    },
    {
      id: '2',
      type: 'Work',
      fullAddress: 'Vigneshwar Nagar, Nanganallur, Tamilnadu, India',
      isDefault: false,
    },
  ];

  const getIconForType = (type: 'Home' | 'Work' | 'Other') => {
    switch (type) {
      case 'Home':
        return 'home';
      case 'Work':
        return 'work';
      case 'Other':
        return 'location-on';
      default:
        return 'location-on';
    }
  };

  const renderAddressCard = (address: Address) => (
    <View key={address.id} style={styles.addressCard}>
      {address.isDefault && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      )}

      {/* Address Info Row */}
      <View style={styles.addressInfoRow}>
        <View style={styles.iconContainer}>
          <MaterialIcons
            name={getIconForType(address.type)}
            size={24}
            color="#00B14F"
          />
        </View>
        <View style={styles.addressTextContainer}>
          <Text style={styles.addressType}>{address.type}</Text>
          <Text style={styles.addressText}>{address.fullAddress}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => onEdit && onEdit(address.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>EDIT</Text>
        </TouchableOpacity>
        <View style={styles.verticalDivider} />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete && onDelete(address.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {addresses.map((address) => renderAddressCard(address))}

          {/* Add New Button */}
          <TouchableOpacity
            style={styles.addNewButton}
            onPress={onAddNew}
            activeOpacity={0.8}
          >
            <Text style={styles.addNewText}>Add New</Text>
            <MaterialIcons name="add" size={24} color="#000000" />
          </TouchableOpacity>
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
    backgroundColor: '#F5F5F5',
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
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 24,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    position: 'relative',
  },
  defaultBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#00B14F',
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 20,
    zIndex: 3,
  },
  defaultBadgeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  addressInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 128, 74, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressTextContainer: {
    flex: 1,
    gap: 2,
  },
  addressType: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  addressText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 21,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  verticalDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  addNewButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#CBFFC2',
    borderRadius: 10,
    marginTop: 6,
  },
  addNewText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
});
