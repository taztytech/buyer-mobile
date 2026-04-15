import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@/shims/rn-vector-icons';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  sortBy: 'lowToHigh' | 'highToLow' | null;
  dietary: 'veg' | 'nonVeg' | 'eggterian' | null;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters,
}) => {
  const [sortBy, setSortBy] = useState<'lowToHigh' | 'highToLow' | null>(initialFilters?.sortBy || null);
  const [dietary, setDietary] = useState<'veg' | 'nonVeg' | 'eggterian' | null>(initialFilters?.dietary || null);
  const slideAnim = useRef(new Animated.Value(1000)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(1000);
    }
  }, [visible]);

  const handleClear = () => {
    setSortBy(null);
    setDietary(null);
  };

  const handleApply = () => {
    onApply({
      sortBy,
      dietary,
    });
    onClose();
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
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Filters and Sorting</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={16} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Filter Sections */}
            <View style={styles.filterSections}>
              {/* Sort By Section */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Sort By</Text>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      sortBy === 'lowToHigh' && styles.optionButtonActive,
                    ]}
                    onPress={() => setSortBy(sortBy === 'lowToHigh' ? null : 'lowToHigh')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>Price - Low to High</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      sortBy === 'highToLow' && styles.optionButtonActive,
                    ]}
                    onPress={() => setSortBy(sortBy === 'highToLow' ? null : 'highToLow')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>Price - High to Low</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Veg / Non-Veg Preferences Section */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Veg / Non - Veg Preferences</Text>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      dietary === 'veg' && styles.optionButtonActive,
                    ]}
                    onPress={() => setDietary(dietary === 'veg' ? null : 'veg')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>Veg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      dietary === 'nonVeg' && styles.optionButtonActive,
                    ]}
                    onPress={() => setDietary(dietary === 'nonVeg' ? null : 'nonVeg')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>Non - Veg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      dietary === 'eggterian' && styles.optionButtonActive,
                    ]}
                    onPress={() => setDietary(dietary === 'eggterian' ? null : 'eggterian')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>Eggterian</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bottom Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApply}
                activeOpacity={0.7}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
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
    padding: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 30,
    marginBottom: 21,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    lineHeight: 30,
    color: '#000000',
  },
  closeButton: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginBottom: 21,
  },
  filterSections: {
    gap: 21,
    marginBottom: 21,
  },
  filterSection: {
    backgroundColor: '#EBFFE0',
    borderRadius: 10,
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
    paddingVertical: 4,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 26,
  },
  optionButtonActive: {
    backgroundColor: '#00B14F',
    borderColor: '#00B14F',
  },
  optionText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 21,
    height: 40,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  clearButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#001E1F',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  applyButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
