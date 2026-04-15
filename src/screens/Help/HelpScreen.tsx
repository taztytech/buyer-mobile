import React, { useEffect, useState } from 'react';
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
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { apiService } from '@/services/api.service';
import { OrderListItem } from '@/services/orders.service';

interface HelpScreenProps {
  visible?: boolean;
  onBack?: () => void;
  onViewOrder?: (orderId: string) => void;
  initialOrder?: Partial<OrderListItem> | null;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface RecentOrder {
  id?: number;
  externalId?: string | number;
  order_number?: string;
  created_at?: string;
  status?: string;
  payment_status?: string;
  restaurant?: {
    name?: string;
    logo_url?: string;
  };
}

const formatOrderDate = (dateString?: string) => {
  if (!dateString) {
    return '—';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusInfo = (status?: string, paymentStatus?: string) => {
  const normalizedStatus = status?.toLowerCase();
  const normalizedPayment = paymentStatus?.toLowerCase();

  if (normalizedStatus === 'payment_failed' || normalizedPayment === 'payment_failed' || normalizedPayment === 'failed') {
    return { label: 'Payment Failed', color: '#DC2626' };
  }
  if (normalizedStatus === 'delivered' || normalizedStatus === 'completed') {
    return { label: 'Delivered', color: '#00B14F' };
  }
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'rejected') {
    return { label: 'Cancelled', color: '#DC2626' };
  }
  return { label: 'On the way', color: '#F59E0B' };
};

const normalizeOrderData = (order?: Partial<OrderListItem> | null): RecentOrder | null => {
  if (!order) {
    return null;
  }

  return {
    id: typeof order.id === 'number' ? order.id : Number(order.id ?? 0) || undefined,
    order_number: order.order_number,
    created_at: order.created_at,
    status: order.status,
    payment_status: (order as any)?.payment_status,
    restaurant: order.restaurant
      ? {
          name: order.restaurant.name,
          logo_url: (order.restaurant as any)?.logo_url,
        }
      : undefined,
  };
};

export const HelpScreen: React.FC<HelpScreenProps> = ({
  visible = false,
  onBack,
  onViewOrder,
  initialOrder,
}) => {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>('1'); // First item expanded by default
  const [recentOrder, setRecentOrder] = useState<RecentOrder | null>(normalizeOrderData(initialOrder));
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(!initialOrder);

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

  useEffect(() => {
    let isMounted = true;

    if (!visible) {
      return () => {
        isMounted = false;
      };
    }

    if (initialOrder) {
      const mapped = normalizeOrderData(initialOrder);
      setRecentOrder(mapped);
      setIsLoadingOrder(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchRecentOrder = async () => {
      setIsLoadingOrder(true);
      setRecentOrder(null);
      try {
        const response = await apiService.get('/api/buyer/orders', { limit: 5, page: 1 });
        const payload = response?.data as any;
        let orders: any[] = [];

        if (Array.isArray(payload)) {
          orders = payload;
        } else if (Array.isArray(payload?.data?.data)) {
          orders = payload.data.data;
        } else if (Array.isArray(payload?.data)) {
          orders = payload.data;
        } else if (Array.isArray(payload?.orders)) {
          orders = payload.orders;
        }

        if (isMounted) {
          const latest = orders.length ? normalizeOrderData(orders[0]) : null;
          setRecentOrder(latest);
        }
      } catch (_error) {
        if (isMounted) {
          setRecentOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrder(false);
        }
      }
    };

    fetchRecentOrder();

    return () => {
      isMounted = false;
    };
  }, [visible, initialOrder]);

  const hasRecentOrder = Boolean(recentOrder);
  const orderStatusInfo = hasRecentOrder
    ? getStatusInfo(recentOrder?.status, recentOrder?.payment_status)
    : { label: isLoadingOrder ? 'Fetching latest order...' : 'No recent orders yet', color: '#00B14F' };

  const orderDateText = hasRecentOrder
    ? `Order placed on ${formatOrderDate(recentOrder?.created_at)}`
    : isLoadingOrder
      ? 'Looking for your most recent order'
      : 'No recent orders yet';

  const orderNumberText = hasRecentOrder
    ? `Order #${recentOrder?.order_number || recentOrder?.id}`
    : 'Once you place an order, it will show up here.';

  const orderImageSource = recentOrder?.restaurant?.logo_url
    ? { uri: recentOrder.restaurant.logo_url }
    : { uri: 'https://via.placeholder.com/155x137' };

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
                  <Text style={styles.orderDate}>{orderDateText}</Text>
                  <Text style={styles.orderNumber}>{orderNumberText}</Text>
                  <Text style={[styles.orderStatus, { color: orderStatusInfo.color }]}>
                    {orderStatusInfo.label}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.viewOrderButton,
                      !hasRecentOrder && styles.viewOrderButtonDisabled,
                    ]}
                    activeOpacity={0.8}
                    disabled={!hasRecentOrder || !recentOrder?.id}
                    onPress={() => {
                      if (hasRecentOrder && recentOrder?.id) {
                        onViewOrder?.(recentOrder.id.toString());
                      }
                    }}
                  >
                    <Text style={styles.viewOrderText}>
                      {hasRecentOrder ? 'View Order' : 'Browse Restaurants'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.orderRight}>
                  <Image source={orderImageSource} style={styles.orderImage} />
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
    fontFamily: 'Poppins-Bold',
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
    fontFamily: 'Poppins-Bold',
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
    fontFamily: 'Poppins-Bold',
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
  viewOrderButtonDisabled: {
    backgroundColor: '#9ADDBD',
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
