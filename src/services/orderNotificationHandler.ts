/**
 * Order Notification Handler
 * Handles FCM notifications for order status updates
 */

import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { ordersService } from './orders.service';
import { OrderListItem } from './orders.service';

// Action type for dispatching to orders store
export type OrdersDispatch = (action: {
  type: 'BULK_SET_ORDERS' | 'UPSERT_ORDER_FROM_FCM' | 'CLEAR_ORDERS';
  payload: any;
}) => void;

/**
 * Extract order ID from FCM notification data
 * Supports multiple field names: order_id, orderId, orderID, order-id
 * Falls back to looking up by order_number if order_id not found
 */
function extractOrderId(data: { [key: string]: string }): string | null {
  // Try direct order_id fields first
  const orderId =
    data.order_id ||
    data.orderId ||
    data.orderID ||
    data['order-id'] ||
    null;

  if (orderId) {
    return orderId;
  }

  // If no order_id, we can't proceed (order_number alone isn't enough for lookup)
  // The backend should always send order_id
  return null;
}

/**
 * Extract order number from FCM notification data
 */
function extractOrderNumber(data: { [key: string]: string }): string | null {
  return (
    data.order_number ||
    data.orderNumber ||
    data.orderNumber ||
    data['order-number'] ||
    null
  );
}

/**
 * Extract status from FCM notification data
 * Prefers 'status' field, falls back to 'new_status'
 */
function extractStatus(data: { [key: string]: string }): string | null {
  return data.status || data.new_status || null;
}

/**
 * Handle order notification from FCM
 * Updates the orders store with new status information
 *
 * @param remoteMessage - FCM remote message
 * @param dispatch - Orders store dispatch function
 * @param fetchFullOrderDetails - Optional: fetch full order details from API after quick update
 */
export async function handleOrderNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  dispatch: OrdersDispatch,
  fetchFullOrderDetails: boolean = false
): Promise<void> {
  try {
    // Check if this is an order notification
    if (!remoteMessage.data || remoteMessage.data.type !== 'order') {
      console.log('📦 Order Handler: Not an order notification, skipping');
      return;
    }

    const data = remoteMessage.data;
    console.log('📦 Order Handler: Processing order notification', {
      notificationId: remoteMessage.messageId,
      data,
    });

    // Extract order ID
    const orderId = extractOrderId(data);
    if (!orderId) {
      console.warn('⚠️  Order Handler: No order_id found in notification data');
      return;
    }

    // Extract status (prefer 'status', fallback to 'new_status')
    const status = extractStatus(data);
    if (!status) {
      console.warn('⚠️  Order Handler: No status found in notification data');
      return;
    }

    // Extract other fields
    const orderNumber = extractOrderNumber(data);
    const restaurantName = data.restaurant_name || null;
    const estimatedTime = data.estimated_time || null;
    const notificationId = data.notification_id || remoteMessage.messageId || null;

    // Build order update payload
    const orderUpdate: Partial<OrderListItem> & { id: number | string } = {
      id: orderId,
      status: status,
      updated_at: new Date().toISOString(),
    };

    // Add optional fields if present
    if (orderNumber) {
      orderUpdate.order_number = orderNumber;
    }

    if (restaurantName) {
      orderUpdate.restaurant = {
        id: 0, // Will be updated from API if fetchFullOrderDetails is true
        name: restaurantName,
        logo_url: '',
        location: '',
      };
    }

    if (estimatedTime) {
      // Store estimated_time in a custom field if needed
      // For now, we'll just update the status
    }

    if (notificationId) {
      // Store notification_id if needed for tracking
    }

    // Quick update: Dispatch to store immediately
    console.log('📦 Order Handler: Dispatching quick update to store', {
      orderId,
      status,
    });
    dispatch({
      type: 'UPSERT_ORDER_FROM_FCM',
      payload: orderUpdate,
    });

    // Optional: Fetch full order details from API
    if (fetchFullOrderDetails) {
      try {
        console.log('📦 Order Handler: Fetching full order details from API', orderId);
        const response = await ordersService.getOrderById(Number(orderId));

        if (response.success && response.data) {
          const fullOrder = response.data as any;
          // Update with full order data
          dispatch({
            type: 'UPSERT_ORDER_FROM_FCM',
            payload: {
              id: orderId,
              ...fullOrder,
            },
          });
          console.log('✅ Order Handler: Full order details updated');
        }
      } catch (error) {
        console.warn('⚠️  Order Handler: Failed to fetch full order details', error);
        // Don't throw - we already did the quick update
      }
    }
  } catch (error) {
    console.error('❌ Order Handler: Error processing order notification', error);
    // Don't throw - allow app to continue
  }
}

