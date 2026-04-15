import React, { useState, useEffect } from 'react';
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
import { colors } from '@/theme/colors';
import { useOrders } from '@/context/OrdersContext';
import { ordersService } from '@/services/orders.service';

// Fallback image for restaurant logo
const DEFAULT_RESTAURANT_IMAGE = require('@/assets/dummy-restaurent.png');

interface OrderHelpScreenProps {
  visible?: boolean;
  onBack?: () => void;
  onSelectHelpOption?: (optionId: string, optionTitle: string) => void;
  orderId?: string;
}

interface HelpOption {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  type: 'accordion';
  subOptions?: SubOption[];
}

interface SubOption {
  id: string;
  title: string;
}

interface PastConversation {
  id: string;
  queryType: string;
  orderId: string;
  openedOn: string;
  closedOn: string;
}

export const OrderHelpScreen: React.FC<OrderHelpScreenProps> = ({
  visible = false,
  onBack,
  onSelectHelpOption,
  orderId,
}) => {
  const { getOrderById } = useOrders();
  const [expandedOptions, setExpandedOptions] = useState<string[]>([]);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  // Fetch order data
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) return;
      
      try {
        // Try to get from context first
        const contextOrder = getOrderById(orderId);
        if (contextOrder) {
          setOrderInfo(contextOrder);
        }
        
        // Also fetch full order details for complete info
        const response = await ordersService.getOrderById(Number(orderId));
        if (response.success && response.data) {
          if (!contextOrder) {
            setOrderInfo({
              restaurant: response.data.restaurant,
              order_number: response.data.order_number,
              created_at: response.data.created_at,
              total_amount: response.data.total_amount || response.data.summary?.total_amount,
            });
          }
        }
      } catch (error) {
        // Silent fail - use context order if available
        const contextOrder = getOrderById(orderId);
        if (contextOrder) {
          setOrderInfo(contextOrder);
        }
      }
    };

    if (visible && orderId) {
      fetchOrderData();
    }
  }, [visible, orderId, getOrderById]);

  const helpOptions: HelpOption[] = [
    {
      id: 'order_not_received',
      title: 'I did not receive this order',
      icon: 'local-shipping',
      type: 'accordion',
      subOptions: [
        { id: 'marked_delivered_not_received', title: 'Order marked as delivered but not received' },
        { id: 'driver_not_reachable', title: 'Driver not reachable' },
        { id: 'wrong_location', title: 'Wrong location delivery' },
      ],
    },
    {
      id: 'missing_items',
      title: 'Items missing in my order',
      icon: 'restaurant',
      type: 'accordion',
      subOptions: [
        { id: 'few_items_missing', title: 'Few item(s) are missing in my order' },
        { id: 'all_items_missing', title: 'All items are missing' },
      ],
    },
    {
      id: 'portion_size',
      title: 'Item(s) portion size is not adequate',
      icon: 'restaurant',
      type: 'accordion',
    },
    {
      id: 'safety_incident',
      title: 'Report a safety incident',
      icon: 'security',
      type: 'accordion',
    },
    {
      id: 'incorrect_items',
      title: 'Item(s) delivered are incorrect or wrong',
      icon: 'error-outline',
      type: 'accordion',
    },
    {
      id: 'poor_quality',
      title: 'Item(s) quality is poor',
      icon: 'thumb-down',
      type: 'accordion',
    },
    {
      id: 'spillage',
      title: 'Item(s) has spillage issue',
      icon: 'water-drop',
      type: 'accordion',
    },
    {
      id: 'delivery_fraud',
      title: 'Report a Delivery Partner fraud incident',
      icon: 'report-problem',
      type: 'accordion',
    },
    {
      id: 'coupon_query',
      title: 'I have coupon related query for this order',
      icon: 'local-offer',
      type: 'accordion',
    },
    {
      id: 'payment_billing',
      title: 'Payment and billing related query',
      icon: 'payment',
      type: 'accordion',
    },
  ];

  // Mock past conversations - in real app, this would come from API
  const pastConversations: PastConversation[] = [
    {
      id: '1',
      queryType: 'Payment and billing related query',
      orderId: orderId || '#224082979676467',
      openedOn: 'Dec 18, 2025 at 12:19 PM',
      closedOn: 'Dec 18, 2025 at 12:24 PM',
    },
  ];

  const toggleAccordion = (optionId: string) => {
    setExpandedOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSubOptionPress = (subOption: SubOption) => {
    if (onSelectHelpOption) {
      onSelectHelpOption(subOption.id, subOption.title);
    }
  };

  const handleMainOptionPress = (option: HelpOption) => {
    if (option.subOptions && option.subOptions.length > 0) {
      // Toggle accordion
      toggleAccordion(option.id);
    } else {
      // Navigate directly if no sub-options
      if (onSelectHelpOption) {
        onSelectHelpOption(option.id, option.title);
      }
    }
  };

  const handlePastConversationPress = (conversation: PastConversation) => {
    if (onSelectHelpOption) {
      onSelectHelpOption(conversation.id, conversation.queryType);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatOrderNumber = (orderNumber?: string) => {
    if (!orderNumber) return orderId ? `#${orderId}` : '—';
    return orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <SafeAreaView style={styles.contentContainer} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Order Info Card */}
          {orderInfo && (
            <View style={styles.orderInfoCard}>
              <View style={styles.orderInfoHeader}>
                {orderInfo.restaurant?.logo_url && (
                  <Image
                    source={{ uri: orderInfo.restaurant.logo_url }}
                    style={styles.restaurantLogo}
                    defaultSource={DEFAULT_RESTAURANT_IMAGE}
                  />
                )}
                <View style={styles.orderInfoContent}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {orderInfo.restaurant?.name || 'Restaurant'}
                  </Text>
                  <Text style={styles.orderNumber}>
                    {formatOrderNumber(orderInfo.order_number || orderInfo.id?.toString())}
                  </Text>
                  {orderInfo.created_at && (
                    <Text style={styles.orderDate}>
                      {formatDate(orderInfo.created_at)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Help Options */}
          <View style={styles.section}>
            <View style={styles.optionsContainer}>
              {helpOptions.map((option, index) => {
                const isExpanded = expandedOptions.includes(option.id);
                const hasSubOptions = option.subOptions && option.subOptions.length > 0;

                return (
                  <View key={option.id}>
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        index === helpOptions.length - 1 && !isExpanded && styles.lastOptionItem,
                      ]}
                      onPress={() => handleMainOptionPress(option)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionContent}>
                        <MaterialIcons
                          name={option.icon}
                          size={20}
                          color={colors.primary}
                          style={styles.optionIcon}
                        />
                        <Text style={styles.optionText}>{option.title}</Text>
                      </View>
                      <MaterialIcons
                        name={hasSubOptions ? (isExpanded ? 'expand-less' : 'expand-more') : 'chevron-right'}
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {isExpanded && hasSubOptions && (
                      <View style={styles.subOptionsContainer}>
                        {option.subOptions!.map((subOption, subIndex) => (
                          <TouchableOpacity
                            key={subOption.id}
                            style={[
                              styles.subOptionItem,
                              subIndex === option.subOptions!.length - 1 && styles.lastSubOptionItem,
                            ]}
                            onPress={() => handleSubOptionPress(subOption)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.subOptionText}>{subOption.title}</Text>
                            <MaterialIcons
                              name="chevron-right"
                              size={20}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Past Conversations */}
          {pastConversations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PAST CONVERSATIONS</Text>
              <View style={styles.conversationsContainer}>
                {pastConversations.map((conversation, index) => (
                  <TouchableOpacity
                    key={conversation.id}
                    style={[
                      styles.conversationItem,
                      index === pastConversations.length - 1 && styles.lastConversationItem,
                    ]}
                    onPress={() => handlePastConversationPress(conversation)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.conversationContent}>
                      <View style={styles.conversationHeader}>
                        <Text style={styles.conversationQuery}>
                          {conversation.queryType}
                        </Text>
                        <MaterialIcons
                          name="chevron-right"
                          size={24}
                          color={colors.textSecondary}
                        />
                      </View>
                      <Text style={styles.conversationOrderId}>
                        Order ID: {conversation.orderId}
                      </Text>
                      <View style={styles.conversationDates}>
                        <Text style={styles.conversationDate}>
                          Opened on: {conversation.openedOn}
                        </Text>
                        <Text style={styles.conversationDate}>
                          Closed on: {conversation.closedOn}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
    flex: 1,
    marginLeft: 12,
  },
  headerSpacer: {
    width: 40,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#000000',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  lastOptionItem: {
    borderBottomWidth: 0,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    lineHeight: 21,
    flex: 1,
  },
  conversationsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  lastConversationItem: {
    borderBottomWidth: 0,
  },
  conversationContent: {
    padding: 16,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conversationQuery: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    lineHeight: 21,
    flex: 1,
  },
  conversationOrderId: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  conversationDates: {
    gap: 4,
  },
  conversationDate: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  orderInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantLogo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  orderInfoContent: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    marginBottom: 4,
  },
  orderNumber: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 2,
  },
  orderDate: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  subOptionsContainer: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  subOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingLeft: 52,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  lastSubOptionItem: {
    borderBottomWidth: 0,
  },
  subOptionText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    lineHeight: 21,
    flex: 1,
  },
});

