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

// Store reference to get order by order_number (set by handler)
let getOrderByOrderNumberFn: ((orderNumber: string) => OrderListItem | undefined) | null = null;

/**
 * Set the function to lookup orders by order_number
 * This is called from App.tsx after OrdersProvider is mounted
 */
export function setOrderLookupFunction(
  lookupFn: (orderNumber: string) => OrderListItem | undefined
): void {
  getOrderByOrderNumberFn = lookupFn;
}

/**
 * Extract order ID from FCM notification data
 * Supports multiple field names: order_id, orderId, orderID, order-id
 * Falls back to looking up by order_number if order_id not found
 */
function extractOrderId(
  data: { [key: string]: string | object },
  orderNumber: string | null
): string | null {
  // Try direct order_id fields first
  const orderIdValue = data.order_id || data.orderId || data.orderID || data['order-id'];
  const orderId = typeof orderIdValue === 'string' ? orderIdValue : null;

  if (orderId) {
    return orderId;
  }

  // If no order_id but we have order_number, try to find it in the store
  if (orderNumber && getOrderByOrderNumberFn) {
    const existingOrder = getOrderByOrderNumberFn(orderNumber);
    if (existingOrder) {
      console.log('📦 Order Handler: Found order by order_number:', orderNumber, '-> id:', existingOrder.id);
      return existingOrder.id.toString();
    }
  }

  // If we have order_number but can't find it, we'll need to fetch from API
  // Return null and handle it in the main handler
  return null;
}

/**
 * Extract order number from FCM notification data
 */
function extractOrderNumber(data: { [key: string]: string | object }): string | null {
  const value = data.order_number || data.orderNumber || data['order-number'];
  return typeof value === 'string' ? value : null;
}

/**
 * Extract status from FCM notification data
 * Prefers 'status' field, falls back to 'new_status'
 */
function extractStatus(data: { [key: string]: string | object }): string | null {
  const status = data.status || data.new_status;
  return typeof status === 'string' ? status : null;
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

    // Extract order number first (needed for lookup if order_id is missing)
    const orderNumber = extractOrderNumber(data);
    
    // Extract order ID (may be null if only order_number is provided)
    let orderId = extractOrderId(data, orderNumber);
    
    // If we still don't have orderId but have orderNumber, try to fetch from API
    if (!orderId && orderNumber) {
      console.log('📦 Order Handler: No order_id found, attempting to fetch by order_number:', orderNumber);
      try {
        // Try to fetch order by order_number from API
        // Note: This assumes your API supports lookup by order_number
        // If not, you may need to fetch all orders and search
        const response = await ordersService.getOrders(100, 1); // Fetch first 100 orders (limit, page)
        if (response.success && response.data && (response.data as any).orders && Array.isArray((response.data as any).orders)) {
          const foundOrder = ((response.data as any).orders as OrderListItem[]).find(
            (order: OrderListItem) => order.order_number === orderNumber
          );
          if (foundOrder) {
            orderId = foundOrder.id.toString();
            console.log('✅ Order Handler: Found order by order_number:', orderNumber, '-> id:', orderId);
          }
        }
      } catch (error) {
        console.warn('⚠️  Order Handler: Failed to fetch order by order_number:', error);
      }
    }

    // If we still don't have orderId, we can't proceed
    if (!orderId) {
      console.warn('⚠️  Order Handler: No order_id found and cannot lookup by order_number');
      console.warn('   Notification data:', JSON.stringify(data, null, 2));
      return;
    }

    // Extract status (prefer 'status', fallback to 'new_status')
    const status = extractStatus(data);
    if (!status) {
      console.warn('⚠️  Order Handler: No status found in notification data');
      return;
    }

    // Extract other fields
    const restaurantNameValue = data.restaurant_name;
    const restaurantName = typeof restaurantNameValue === 'string' ? restaurantNameValue : null;
    const estimatedTimeValue = data.estimated_time;
    const estimatedTime = typeof estimatedTimeValue === 'string' ? estimatedTimeValue : null;
    const notificationIdValue = data.notification_id;
    const notificationId = typeof notificationIdValue === 'string' ? notificationIdValue : (remoteMessage.messageId || null);

    // Build order update payload
    // Convert orderId to number if possible
    const orderIdNum = parseInt(orderId, 10);
    if (isNaN(orderIdNum)) {
      console.warn('⚠️  Order Handler: orderId is not a valid number:', orderId);
      return; // Can't proceed without a valid numeric id
    }
    
    const orderUpdate: Partial<OrderListItem> & { id: number } = {
      id: orderIdNum,
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
      orderNumber,
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
        const response = await ordersService.getOrderById(orderIdNum);

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

