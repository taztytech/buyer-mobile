import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface HelpScreenProps {
  onBack?: () => void;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const HelpScreen: React.FC<HelpScreenProps> = ({ onBack }) => {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>('1'); // First item expanded by default

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How do I cancel my order?',
      answer: 'You can cancel your order within 30 minutes of placing it. To cancel, go to your order history and select the order you wish to cancel. If the order is already being prepared, you may not be able to cancel it.',
    },
    {
      id: '2',
      question: 'How do I change my order?',
      answer: 'Order modifications can be made within 5 minutes of placing your order. Go to your active orders and select the order you wish to modify. Please note that changes may not be possible if the restaurant has already started preparing your order.',
    },
    {
      id: '3',
      question: 'How do I track my order?',
      answer: 'You can track your order in real-time from the Orders tab. Once your order is confirmed, you\'ll see live updates including preparation status, delivery partner assignment, and estimated delivery time.',
    },
  ];

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Recent Orders Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>

              <View style={styles.orderCard}>
                <View style={styles.orderLeft}>
                  <Text style={styles.orderDate}>Order placed on 12/12/2023</Text>
                  <Text style={styles.orderNumber}>Order #123456789</Text>
                  <Text style={styles.orderStatus}>Delivered</Text>

                  <TouchableOpacity style={styles.viewOrderButton} activeOpacity={0.8}>
                    <Text style={styles.viewOrderText}>View Order</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.orderRight}>
                  <Image
                    source={{ uri: 'https://via.placeholder.com/155x137' }}
                    style={styles.orderImage}
                  />
                </View>
              </View>
            </View>

            {/* FAQ Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

              <View style={styles.faqContainer}>
                {faqs.map((faq, index) => (
                  <View key={faq.id}>
                    <TouchableOpacity
                      style={styles.faqItem}
                      onPress={() => toggleFAQ(faq.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                      <MaterialIcons
                        name={expandedFAQ === faq.id ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={24}
                        color="#000000"
                      />
                    </TouchableOpacity>

                    {expandedFAQ === faq.id && (
                      <View style={styles.faqAnswer}>
                        <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                      </View>
                    )}

                    {index < faqs.length - 1 && <View style={styles.faqDivider} />}
                  </View>
                ))}
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
  // Header
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
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    lineHeight: 30,
    color: '#FFFFFF',
    flex: 1,
  },
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#F5F5F5',
  },
  // Section
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    marginBottom: 15,
  },
  // Order Card
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    gap: 15,
  },
  orderLeft: {
    flex: 1,
    justifyContent: 'space-between',
  },
  orderDate: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.6,
    marginBottom: 5,
  },
  orderNumber: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    marginBottom: 5,
  },
  orderStatus: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
    marginBottom: 15,
  },
  viewOrderButton: {
    backgroundColor: '#00B14F',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  viewOrderText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  orderRight: {
    width: 155,
    height: 137,
  },
  orderImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
  },
  // FAQ
  faqContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    overflow: 'hidden',
  },
  faqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    marginRight: 10,
  },
  faqAnswer: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 0,
  },
  faqAnswerText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#333333',
  },
  faqDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 20,
  },
});
