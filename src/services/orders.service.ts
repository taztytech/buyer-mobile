/**
 * Orders Service
 * Handles all order-related API calls including cart management and order creation
 */

import { apiService, ApiResponse } from './api.service';

// Cart Item Interfaces
export interface CartCustomization {
  customization_group_id: number;
  selected_options: number[];
}

export interface CartVariant {
  variant_group_id: number;
  selected_variant: number;
}

export interface AddToCartRequest {
  restaurant_id: number;
  item_id: number;
  quantity: number;
  customizations?: CartCustomization[];
  variants?: CartVariant[];
  special_instructions?: string;
}

export interface CartItem {
  cart_item_id: number;
  item: {
    id: number;
    name: string;
    image: string;
    price: number;
  };
  quantity: number;
  customizations: any[];
  special_instructions?: string;
  item_total: number;
}

export interface Cart {
  cart_id: number;
  restaurant: {
    id: number;
    name: string;
    logo_url: string;
  };
  items: CartItem[];
  summary: {
    subtotal: number;
    tax: number;
    delivery_fee: number;
    discount: number;
    total: number;
  };
}

// Order Interfaces
export interface CreateOrderRequest {
  delivery_address_id: number;
  payment_method: 'cod' | 'online' | 'wallet' | 'upi';
  notes?: string;
  offer_code?: string;
}

export interface Order {
  order_id: number;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
}

export interface OrderListItem {
  id: number;
  order_number: string;
  restaurant: {
    id: number;
    name: string;
    logo_url: string;
    location: string;
  };
  items: {
    id: number;
    name: string;
    image?: string;
    quantity: number;
    is_veg: boolean;
  }[];
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

class OrdersService {
  /**
   * Add item to cart
   */
  async addToCart(request: AddToCartRequest): Promise<ApiResponse<any>> {
    try {
      console.log('📦 [OrdersService] Adding item to cart:', JSON.stringify(request, null, 2));
      const response = await apiService.post('/api/buyer/cart/add', request);
      console.log('📦 [OrdersService] Add to cart response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error: any) {
      console.error('❌ [OrdersService] Error adding to cart:', error);
      return {
        success: false,
        error: error.message || 'Failed to add item to cart',
      };
    }
  }

  /**
   * Get current cart
   */
  async getCart(): Promise<ApiResponse<Cart>> {
    try {
      console.log('🛒 [OrdersService] Fetching cart...');
      const response = await apiService.get<any>('/api/buyer/cart');
      console.log('🛒 [OrdersService] Get cart response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error: any) {
      console.error('❌ [OrdersService] Error fetching cart:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch cart',
      };
    }
  }

  /**
   * Update cart item
   */
  async updateCartItem(
    cart_item_id: number,
    quantity: number,
    customizations?: CartCustomization[],
    special_instructions?: string
  ): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.put('/api/buyer/cart/update', {
        cart_item_id,
        quantity,
        customizations,
        special_instructions,
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update cart item',
      };
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(cart_item_id: number): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.delete(`/api/buyer/cart/remove/${cart_item_id}`);
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to remove item from cart',
      };
    }
  }

  /**
   * Apply offer to cart
   */
  async applyOffer(offer_code: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.post('/api/buyer/cart/apply-offer', {
        offer_code,
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to apply offer',
      };
    }
  }

  /**
   * Create order from cart
   */
  async createOrder(request: CreateOrderRequest): Promise<ApiResponse<Order>> {
    try {
      console.log('🎯 [OrdersService] Creating order with request:', JSON.stringify(request, null, 2));
      const response = await apiService.post<any>('/api/buyer/orders', request);
      console.log('🎯 [OrdersService] Create order response:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log('✅ [OrdersService] Order created successfully!');
        console.log('   - Order ID:', response.data?.order_id);
        console.log('   - Order Number:', response.data?.order_number);
        console.log('   - Status:', response.data?.status);
        console.log('   - Payment Status:', response.data?.payment_status);
        console.log('   - Total Amount:', response.data?.total_amount);
      } else {
        console.error('❌ [OrdersService] Order creation failed:', response.error);
      }

      return response;
    } catch (error: any) {
      console.error('❌ [OrdersService] Error creating order:', error);
      return {
        success: false,
        error: error.message || 'Failed to create order',
      };
    }
  }

  /**
   * Get all orders
   */
  async getOrders(
    limit: number = 10,
    offset: number = 0,
    status?: string
  ): Promise<ApiResponse<{ orders: OrderListItem[]; total: number }>> {
    try {
      const params: any = { limit, offset };
      if (status) params.status = status;

      console.log('📋 [OrdersService] Fetching orders with params:', params);
      const response = await apiService.get<any>('/api/buyer/orders', params);
      console.log('📋 [OrdersService] Get orders response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        const orderCount = response.data.orders?.length || 0;
        console.log(`✅ [OrdersService] Found ${orderCount} orders`);
        if (orderCount > 0) {
          console.log('   First order:', response.data.orders[0]);
        }
      } else {
        console.error('❌ [OrdersService] Failed to fetch orders:', response.error);
      }

      return response;
    } catch (error: any) {
      console.error('❌ [OrdersService] Error fetching orders:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch orders',
      };
    }
  }

  /**
   * Get order details by ID
   */
  async getOrderById(orderId: number): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.get<any>(`/api/buyer/orders/${orderId}`);
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch order details',
      };
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: number, reason?: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.post(`/api/buyer/orders/${orderId}/cancel`, {
        reason,
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to cancel order',
      };
    }
  }
}

// Export singleton instance
export const ordersService = new OrdersService();
export default ordersService;
