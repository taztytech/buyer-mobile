/**
 * Cart Service
 * Handles cart operations with backend API
 */

import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';

// Type definitions for cart
export interface CartCustomization {
  customization_group_id: number;
  customization_group_name?: string;
  selected_options: Array<{
    id: number;
    name?: string;
    price?: number;
  }>;
}

export interface CartVariant {
  variant_group_id: number;
  variant_group_name?: string;
  selected_variant: number;
  variant_name?: string;
  price?: number;
}

export interface AddToCartRequest {
  restaurant_id: number;
  item_id: number;
  quantity: number;
  customizations?: CartCustomization[];
  variants?: CartVariant[];
  special_instructions?: string;
}

export interface CartItemResponse {
  id: number;
  item_id: number;
  item_name: string;
  item_description?: string;
  item_images?: string[];
  dietary_preference?: 'veg' | 'non-veg' | 'vegetarian' | 'egg';
  has_customizations?: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
  customizations?: CartCustomization[];
  variants?: CartVariant[];
  special_instructions?: string | null;
  is_available: boolean;
}

export interface CartSummary {
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  applied_offer?: {
    id: number;
    name: string;
    offer_code: string;
    discount_amount: number;
  };
}

export interface CartResponse {
  id: number;
  restaurant_id: number;
  restaurant_name: string;
  restaurant_logo?: string;
  items: CartItemResponse[];
  summary: CartSummary;
  total_items: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddToCartResponse {
  success: boolean;
  message: string;
  cart_item_id: number;
  cart_summary: CartSummary;
}

export interface GetCartResponse {
  success: boolean;
  message: string;
  data: CartResponse;
}

class CartService {
  /**
   * Add item to cart
   */
  async addToCart(data: AddToCartRequest): Promise<AddToCartResponse> {
    if (data.quantity > MAX_ITEM_QUANTITY) {
      throw new Error(`Maximum quantity per item is ${MAX_ITEM_QUANTITY}`);
    }
    try {
      const response = await apiService.post<AddToCartResponse>(
        API_CONFIG.ENDPOINTS.BUYER.CART_ADD,
        data
      );

      // Handle potential double-nested response structure
      let responseData: any = response.data || response;

      // Check if data is double-nested
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        responseData = responseData.data;
      }

      // Return the unwrapped data with success flag
      return {
        success: response.success,
        message: responseData.message || response.message,
        cart_item_id: responseData.cart_item_id,
        cart_summary: responseData.cart_summary,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current cart
   */
  async getCart(): Promise<CartResponse | null> {
    try {
      const response = await apiService.get<GetCartResponse>(
        API_CONFIG.ENDPOINTS.BUYER.CART_GET
      );

      // Handle double-nested response structure
      // Backend returns: { success: true, data: { success: true, data: { actual cart } } }
      let cartData = response.data;

      // Check if data is double-nested
      if (cartData && typeof cartData === 'object' && 'data' in cartData) {
        cartData = (cartData as any).data;
      }

      return response.success && cartData ? cartData : null;
    } catch (error) {
      // Return null if cart doesn't exist or error occurs
      return null;
    }
  }

  /**
   * Update cart item
   */
  async updateCartItem(
    cartItemId: number,
    updates: {
      restaurant_id?: number;
      quantity?: number;
      customizations?: CartCustomization[];
      variants?: CartVariant[];
      special_instructions?: string;
    }
  ): Promise<{ success: boolean; cart_summary?: CartSummary }> {
    if (updates.quantity && updates.quantity > MAX_ITEM_QUANTITY) {
      throw new Error(`Maximum quantity per item is ${MAX_ITEM_QUANTITY}`);
    }
    try {
      const response = await apiService.put(
        API_CONFIG.ENDPOINTS.BUYER.CART_UPDATE,
        {
          cart_item_id: cartItemId,
          ...updates,
        }
      );

      // Handle potential double-nested response structure
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        responseData = responseData.data;
      }

      return {
        success: response.success,
        cart_summary: responseData.cart_summary,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove cart item
   */
  async removeCartItem(cartItemId: number): Promise<{ success: boolean; cart_summary?: CartSummary }> {
    try {
      const response = await apiService.delete(
        API_CONFIG.ENDPOINTS.BUYER.CART_REMOVE,
        {
          cart_item_id: cartItemId,
        }
      );

      // Handle potential double-nested response structure
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        responseData = responseData.data;
      }

      return {
        success: response.success,
        cart_summary: responseData.cart_summary,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiService.delete(
        API_CONFIG.ENDPOINTS.BUYER.CART_CLEAR
      );

      // Handle potential double-nested response structure
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        responseData = responseData.data;
      }

      return {
        success: response.success,
        message: responseData.message || response.message,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update tip amount in cart
   */
  async createTip(tipAmount: number): Promise<{ success: boolean; cart_summary?: CartSummary; message?: string }> {
    try {
      const response = await apiService.put(
        API_CONFIG.ENDPOINTS.BUYER.CART_TIP,
        {
          tip_amount: tipAmount,
        }
      );

      // Handle potential double-nested response structure
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        responseData = responseData.data;
      }

      return {
        success: response.success,
        cart_summary: responseData.cart_summary,
        message: responseData.message || response.message,
      };
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const cartService = new CartService();
export default cartService;
