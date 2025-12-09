/**
 * Orders Context
 * Global state management for orders with live FCM updates
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { OrderListItem } from '@/services/orders.service';

// Order state shape
interface OrdersState {
  byId: {
    [orderId: string]: OrderListItem;
  };
  orderList: string[]; // Array of order IDs in display order
}

// Action types
type OrdersAction =
  | { type: 'BULK_SET_ORDERS'; payload: OrderListItem[] }
  | { type: 'UPSERT_ORDER_FROM_FCM'; payload: Partial<OrderListItem> & { id: number | string } }
  | { type: 'CLEAR_ORDERS' };

// Initial state
const initialState: OrdersState = {
  byId: {},
  orderList: [],
};

// Reducer
function ordersReducer(state: OrdersState, action: OrdersAction): OrdersState {
  switch (action.type) {
    case 'BULK_SET_ORDERS': {
      const orders = action.payload;
      const byId: { [orderId: string]: OrderListItem } = {};
      const orderList: string[] = [];

      // Process orders and maintain order
      orders.forEach((order) => {
        const orderId = order.id.toString();
        byId[orderId] = order;
        orderList.push(orderId);
      });

      return {
        byId,
        orderList,
      };
    }

    case 'UPSERT_ORDER_FROM_FCM': {
      const orderData = action.payload;
      
      // Try to find existing order by id first
      let orderId = orderData.id ? orderData.id.toString() : null;
      let existingOrder = orderId ? state.byId[orderId] : undefined;
      
      // If no existing order found by id, try to find by order_number
      if (!existingOrder && orderData.order_number) {
        for (const id of state.orderList) {
          const order = state.byId[id];
          if (order && order.order_number === orderData.order_number) {
            existingOrder = order;
            orderId = id;
            console.log('📦 OrdersContext: Found existing order by order_number:', orderData.order_number, '-> id:', orderId);
            break;
          }
        }
      }
      
      // If still no orderId, we need to create a new one
      // Use order_number as a temporary id if no id is provided
      if (!orderId) {
        if (orderData.order_number) {
          // Try to extract numeric id from order_number (e.g., "ORD-20251209-888" -> use as string id)
          orderId = orderData.order_number;
        } else {
          // Fallback: generate a temporary id
          orderId = `temp-${Date.now()}`;
        }
        console.log('📦 OrdersContext: Creating new order entry with id:', orderId);
      }

      // If order exists, merge updates; otherwise create new entry
      const updatedOrder: OrderListItem = existingOrder
        ? {
            ...existingOrder,
            ...orderData,
            // Preserve nested objects if not provided
            restaurant: orderData.restaurant || existingOrder.restaurant,
            items: orderData.items || existingOrder.items,
            summary: orderData.summary || existingOrder.summary,
            // Ensure status is updated
            status: orderData.status || existingOrder.status,
            // Ensure updated_at is set
            updated_at: orderData.updated_at || new Date().toISOString(),
          }
        : ({
            id: orderData.id || parseInt(orderId) || 0,
            order_number: orderData.order_number || `ORD-${orderData.id || orderId}`,
            status: orderData.status || 'confirmed',
            restaurant: orderData.restaurant || {
              id: 0,
              name: orderData.restaurant_name || 'Unknown Restaurant',
              logo_url: '',
              location: '',
            },
            items: orderData.items || [],
            total_amount: orderData.total_amount || 0,
            payment_status: orderData.payment_status || 'pending',
            created_at: orderData.created_at || new Date().toISOString(),
            updated_at: orderData.updated_at || new Date().toISOString(),
            ...orderData,
          } as OrderListItem);

      // Update byId
      const newById = {
        ...state.byId,
        [orderId]: updatedOrder,
      };

      // Add to orderList if not already present (prepend for new orders)
      const newOrderList = state.orderList.includes(orderId)
        ? state.orderList
        : [orderId, ...state.orderList];

      return {
        byId: newById,
        orderList: newOrderList,
      };
    }

    case 'CLEAR_ORDERS':
      return initialState;

    default:
      return state;
  }
}

// Context type
interface OrdersContextType {
  state: OrdersState;
  dispatch: React.Dispatch<OrdersAction>;
  // Helper methods
  getOrderById: (orderId: string) => OrderListItem | undefined;
  getOrderByOrderNumber: (orderNumber: string) => OrderListItem | undefined;
  getOrdersList: () => OrderListItem[];
}

// Create context
const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Provider component
export function OrdersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(ordersReducer, initialState);

  // Helper to get order by ID
  const getOrderById = (orderId: string): OrderListItem | undefined => {
    return state.byId[orderId];
  };

  // Helper to get order by order_number
  const getOrderByOrderNumber = (orderNumber: string): OrderListItem | undefined => {
    // Search through all orders to find by order_number
    for (const orderId of state.orderList) {
      const order = state.byId[orderId];
      if (order && order.order_number === orderNumber) {
        return order;
      }
    }
    return undefined;
  };

  // Helper to get orders as array (in display order)
  const getOrdersList = (): OrderListItem[] => {
    return state.orderList.map((orderId) => state.byId[orderId]).filter(Boolean);
  };

  const value: OrdersContextType = {
    state,
    dispatch,
    getOrderById,
    getOrderByOrderNumber,
    getOrdersList,
  };

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

// Hook to use orders context
export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}

