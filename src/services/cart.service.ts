/**
 * Cart Service
 * Handles cart operations with backend API
 */

import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';

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
    try {
      if (__DEV__) {
        console.log('Adding item to cart:', data);
      }

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

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Item added to cart. Cart item ID:', responseData.cart_item_id);
          console.log('Cart summary:', responseData.cart_summary);
        } else {
          console.warn('⚠️  Backend returned success=false for add to cart');
        }
      }

      // Return the unwrapped data with success flag
      return {
        success: response.success,
        message: responseData.message || response.message,
        cart_item_id: responseData.cart_item_id,
        cart_summary: responseData.cart_summary,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to add item to cart:', error);
      }
      throw error;
    }
  }

  /**
   * Get current cart
   */
  async getCart(): Promise<CartResponse | null> {
    try {
      if (__DEV__) {
        console.log('Fetching cart from backend...');
      }

      const response = await apiService.get<GetCartResponse>(
        API_CONFIG.ENDPOINTS.BUYER.CART_GET
      );

      if (__DEV__) {
        console.log('Raw cart response:', JSON.stringify(response, null, 2));
      }

      // Handle double-nested response structure
      // Backend returns: { success: true, data: { success: true, data: { actual cart } } }
      let cartData = response.data;

      // Check if data is double-nested
      if (cartData && typeof cartData === 'object' && 'data' in cartData) {
        cartData = (cartData as any).data;
      }

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Cart fetched successfully');
          if (cartData) {
            console.log(`Total items: ${cartData.total_items || 0}`);
            console.log(`Restaurant: ${cartData.restaurant_name || 'N/A'}`);
            console.log(`Items array exists: ${!!cartData.items}`);
            console.log(`Items count: ${cartData.items?.length || 0}`);
          } else {
            console.warn('⚠️  cartData is null or undefined');
          }
        } else {
          console.warn('⚠️  Backend returned success=false for get cart');
        }
      }

      return response.success && cartData ? cartData : null;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to fetch cart:', error);
      }
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
    try {
      if (__DEV__) {
        console.log(`Updating cart item ${cartItemId}:`, updates);
      }

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

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Cart item updated successfully');
          if (responseData.cart_summary) {
            console.log('Updated cart summary:', responseData.cart_summary);
          }
        } else {
          console.warn('⚠️  Backend returned success=false for update cart item');
        }
      }

      return {
        success: response.success,
        cart_summary: responseData.cart_summary,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to update cart item:', error);
      }
      throw error;
    }
  }

  /**
   * Remove cart item
   */
  async removeCartItem(cartItemId: number): Promise<{ success: boolean; cart_summary?: CartSummary }> {
    try {
      if (__DEV__) {
        console.log(`Removing cart item ${cartItemId}`);
      }

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

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Cart item removed successfully');
          if (responseData.cart_summary) {
            console.log('Updated cart summary:', responseData.cart_summary);
          }
        } else {
          console.warn('⚠️  Backend returned success=false for remove cart item');
        }
      }

      return {
        success: response.success,
        cart_summary: responseData.cart_summary,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to remove cart item:', error);
      }
      throw error;
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(): Promise<{ success: boolean; message?: string }> {
    try {
      if (__DEV__) {
        console.log('Clearing cart...');
      }

      const response = await apiService.delete(
        API_CONFIG.ENDPOINTS.BUYER.CART_CLEAR
      );

      // Handle potential double-nested response structure
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        responseData = responseData.data;
      }

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Cart cleared successfully');
        } else {
          console.warn('⚠️  Backend returned success=false for clear cart');
        }
      }

      return {
        success: response.success,
        message: responseData.message || response.message,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to clear cart:', error);
      }
      throw error;
    }
  }
}

// Export singleton instance
export const cartService = new CartService();
export default cartService;
