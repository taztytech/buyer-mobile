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
  is_preorder?: boolean;
  campaign_id?: string;
  /**
   * Promo offer being claimed. The API holds one of the offer's limited slots,
   * prices the line from the offer rather than the item, forces quantity 1,
   * and rejects anything else in the cart.
   */
  promo_offer_id?: number;
  /**
   * 99 Store deal being taken. The API prices the line at the deal price,
   * caps the quantity by the deal's limits, rejects anything else in the
   * cart, and refuses coupons on it.
   */
  store_deal_id?: number;
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
  is_preorder?: boolean;
  preorder_campaign?: {
    id: string;
    title: string;
    delivery_date: string;
    available_slots: number;
    free_delivery: boolean;
  };
  /** Set when the line is a ₹99 Store deal. */
  store_deal_id?: number;
  store_deal?: {
    id: number;
    deal_price: number;
    menu_price: number;
    /** (menu price − deal price) × quantity, for the "You saved" line. */
    savings: number;
  };
}

export interface CartSummary {
  subtotal: number;
  delivery_fee: number;
  delivery_fee_tax: number;
  platform_fee_tax: number;
  total_tax_amount: number;
  tax_amount: number;
  discount_amount: number;
  tip_amount?: number;
  max_tip_amount?: number;
  platform_fee?: number;
  include_platform_fee?: boolean;
  estimated_delivery_time?: string | null;
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

/** Thrown when GET /cart fails so callers can keep local state (e.g. offline). */
export class CartFetchError extends Error {
  constructor(
    message?: string,
    public readonly statusCode?: number
  ) {
    super(message || 'Failed to fetch cart');
    this.name = 'CartFetchError';
  }
}

const EMPTY_CART_RESPONSE: CartResponse = {
  id: 0,
  restaurant_id: 0,
  restaurant_name: '',
  items: [],
  summary: {
    subtotal: 0,
    delivery_fee: 0,
    delivery_fee_tax: 0,
    platform_fee_tax: 0,
    total_tax_amount: 0,
    tax_amount: 0,
    discount_amount: 0,
    final_amount: 0,
  },
  total_items: 0,
  is_active: false,
  created_at: '',
  updated_at: '',
};

export interface ApplyCouponResponse {
  success: boolean;
  message?: string;
  cart_summary?: CartSummary;
}

export interface RemoveCouponResponse {
  success: boolean;
  message?: string;
  cart_summary?: CartSummary;
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
      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
        responseData = responseData.data;
      }

      // Return the unwrapped data with success flag
      const result: AddToCartResponse & { statusCode?: number } = {
        success: response.success,
        message: responseData.message || response.message,
        cart_item_id: responseData.cart_item_id,
        cart_summary: responseData.cart_summary,
      };

      // Preserve status code if response failed
      if (!response.success && (response as any).statusCode) {
        result.statusCode = (response as any).statusCode;
      } else if (!response.success && (response as any).status) {
        result.statusCode = (response as any).status;
      }

      return result;
    } catch (error: any) {
      // Preserve status code from error if available
      if (error?.response?.status) {
        const apiError: any = error;
        apiError.statusCode = error.response.status;
        throw apiError;
      }
      throw error;
    }
  }

  /**
   * Get current cart from the server (source of truth when online).
   * Returns an empty cart shape when the cart has no items.
   * Throws {@link CartFetchError} on network / API failure so callers can preserve local state.
   */
  async getCart(): Promise<CartResponse> {
    try {
      const response = await apiService.get<GetCartResponse>(
        API_CONFIG.ENDPOINTS.BUYER.CART_GET
      );

      if (!response.success) {
        throw new CartFetchError(
          response.message || response.error || 'Cart request failed',
          response.statusCode
        );
      }

      // Handle nested response structure
      // Backend may return: { success: true, data: { success: true, data: { actual cart } } }
      // Or: { success: true, data: { actual cart } }
      let cartData = response.data;

      // Empty carts may omit restaurant_id; non-empty carts must have it.
      const isCartResponse = (data: any): data is CartResponse => {
        if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) {
          return false;
        }
        if (data.items.length === 0) {
          return true;
        }
        return data.restaurant_id != null && data.restaurant_id !== '';
      };

      // Unwrap nested data structures
      let unwrapCount = 0;
      const maxUnwraps = 5; // Prevent infinite loops

      while (cartData && typeof cartData === 'object' && unwrapCount < maxUnwraps) {
        // Check if it's already a CartResponse
        if (isCartResponse(cartData)) {
          return cartData;
        }

        // Check if it's a wrapper with 'data' property
        if ('data' in cartData && cartData.data) {
          cartData = (cartData as any).data;
          unwrapCount++;
          continue;
        }

        // Check if it's a wrapper with 'success' property (another nested layer)
        if ('success' in cartData && cartData.success && 'data' in cartData) {
          cartData = (cartData as any).data;
          unwrapCount++;
          continue;
        }

        // No more unwrapping possible
        break;
      }

      // Final check: if cartData is a valid CartResponse
      if (isCartResponse(cartData)) {
        return cartData;
      }

      if (__DEV__) {
        console.warn('[CartService] Unexpected getCart payload after unwrap; treating as empty cart');
      }
      return { ...EMPTY_CART_RESPONSE };
    } catch (error) {
      if (error instanceof CartFetchError) {
        throw error;
      }
      console.error('[CartService] Error getting cart:', error);
      throw new CartFetchError(
        error instanceof Error ? error.message : 'Cart request failed',
        (error as any)?.statusCode ?? (error as any)?.response?.status
      );
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
      is_active?: boolean;
    }
  ): Promise<{ success: boolean; cart_summary?: CartSummary; error?: string }> {
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

      // Extract error message from response if success is false
      // Check response.message first (apiService extracts it to top level)
      let errorMessage: string | undefined;
      if (!response.success) {
        // Try to get error message from various possible locations
        // Priority: response.message (from apiService) > response.data.message > fullResponse.message
        errorMessage = response.message ||
          (response as any).error ||
          (response.data as any)?.message ||
          (response as any).fullResponse?.message ||
          'Failed to update cart item';
      }

      // Handle potential double-nested response structure for cart_summary
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
        responseData = responseData.data;
      }

      return {
        success: response.success,
        cart_summary: responseData?.cart_summary,
        error: errorMessage,
      };
    } catch (error: any) {
      // Extract error message from caught error
      const errorMessage = error?.message ||
        error?.response?.data?.message ||
        error?.fullResponse?.message ||
        'Failed to update cart item';

      // Throw error with message so it can be caught and displayed
      const apiError: any = new Error(errorMessage);
      apiError.response = error?.response;
      apiError.fullResponse = error?.fullResponse;
      throw apiError;
    }
  }

  /**
   * Update entire cart
   * PUT /api/buyer/cart/update
   */
  async updateCart(
    cartId: number,
    updates: {
      is_active?: boolean;
    }
  ): Promise<{ success: boolean; cart_summary?: CartSummary; error?: string }> {
    try {
      const response = await apiService.put(
        API_CONFIG.ENDPOINTS.BUYER.CART_UPDATE,
        {
          cart_id: cartId,
          ...updates,
        }
      );

      // Extract error message from response if success is false
      let errorMessage: string | undefined;
      if (!response.success) {
        errorMessage = response.message ||
          (response as any).error ||
          (response.data as any)?.message ||
          (response as any).fullResponse?.message ||
          'Failed to update cart';
      }

      // Handle potential double-nested response structure for cart_summary
      let responseData: any = response.data || response;
      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
        responseData = responseData.data;
      }

      return {
        success: response.success,
        cart_summary: responseData?.cart_summary,
        error: errorMessage,
      };
    } catch (error: any) {
      // Extract error message from caught error
      const errorMessage = error?.message ||
        error?.response?.data?.message ||
        error?.fullResponse?.message ||
        'Failed to update cart';

      const apiError: any = new Error(errorMessage);
      apiError.response = error?.response;
      apiError.fullResponse = error?.fullResponse;
      throw apiError;
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
      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
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
      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
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
   * Returns updated cart summary along with tip metadata from backend.
   * PUT /api/buyer/cart/tip
   */
  async createTip(
    tipAmount: number
  ): Promise<{
    success: boolean;
    cart_summary?: CartSummary;
    message?: string;
    tip_amount?: number;
    max_tip_amount?: number;
  }> {
    try {
      const response = await apiService.put(
        API_CONFIG.ENDPOINTS.BUYER.CART_TIP,
        {
          tip_amount: tipAmount,
        }
      );

      // Handle different response structures:
      // 1. { success: true, data: { cart_summary: {...} } }
      // 2. { success: true, cart_summary: {...} }
      // 3. { cart_summary: {...} } (direct)
      let responseData: any = response.data || response;

      // Unwrap nested data structure if needed
      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
        responseData = responseData.data;
      }

      // Extract cart_summary - it might be directly in responseData or nested
      let cartSummary: CartSummary | undefined;
      if (responseData) {
        // Check if cart_summary exists directly
        if (responseData.cart_summary && typeof responseData.cart_summary === 'object') {
          cartSummary = responseData.cart_summary as CartSummary;
        }
        // Check if responseData itself is the cart_summary (has final_amount, subtotal, etc.)
        else if ('final_amount' in responseData && 'subtotal' in responseData) {
          cartSummary = responseData as CartSummary;
        }
      }

      return {
        success: response.success,
        cart_summary: cartSummary,
        message: responseData?.message || response.message,
        tip_amount: responseData?.tip_amount ?? cartSummary?.tip_amount,
        max_tip_amount: responseData?.max_tip_amount ?? cartSummary?.max_tip_amount,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Apply coupon code to cart
   * POST /api/buyer/cart/apply-coupon
   */
  async applyCoupon(
    couponCode: string
  ): Promise<ApplyCouponResponse> {
    try {
      const response = await apiService.post(
        API_CONFIG.ENDPOINTS.BUYER.CART_APPLY_COUPON,
        {
          coupon_code: couponCode,
        }
      );

      // Handle possible nested response structures
      // 1. { success: true, data: { cart_summary: {...} } }
      // 2. { success: true, cart_summary: {...} }
      // 3. { cart_summary: {...} } (direct)
      let responseData: any = response.data || response;

      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
        responseData = responseData.data;
      }

      let cartSummary: CartSummary | undefined;
      if (responseData) {
        if (responseData.cart_summary && typeof responseData.cart_summary === 'object') {
          cartSummary = responseData.cart_summary as CartSummary;
        } else if ('final_amount' in responseData && 'subtotal' in responseData) {
          cartSummary = responseData as CartSummary;
        }
      }

      return {
        success: response.success,
        message: responseData?.message || response.message,
        cart_summary: cartSummary,
      };
    } catch (error: any) {
      // Surface a standardized error shape to callers
      return {
        success: false,
        message: error?.message || 'Failed to apply coupon',
        cart_summary: undefined,
      };
    }
  }

  /**
   * Remove applied coupon from cart
   * POST /api/buyer/cart/remove-coupon
   */
  async removeCoupon(): Promise<RemoveCouponResponse> {
    try {
      const response = await apiService.delete(
        API_CONFIG.ENDPOINTS.BUYER.CART_REMOVE_COUPON
      );

      // Handle possible nested response structures
      let responseData: any = response.data || response;

      if (responseData && typeof responseData === 'object' && responseData !== null && 'data' in responseData) {
        responseData = responseData.data;
      }

      let cartSummary: CartSummary | undefined;
      if (responseData) {
        if (responseData.cart_summary && typeof responseData.cart_summary === 'object') {
          cartSummary = responseData.cart_summary as CartSummary;
        } else if ('final_amount' in responseData && 'subtotal' in responseData) {
          cartSummary = responseData as CartSummary;
        }
      }

      return {
        success: response.success,
        message: responseData?.message || response.message,
        cart_summary: cartSummary,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Failed to remove coupon',
        cart_summary: undefined,
      };
    }
  }
}

// Export singleton instance
export const cartService = new CartService();
export default cartService;
