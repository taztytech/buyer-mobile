/**
 * Payment Service
 * Handles Razorpay payment integration and payment-related API calls
 */

import RazorpayCheckout from 'react-native-razorpay';
import { apiService, ApiResponse } from './api.service';

// Payment Interfaces
export interface CreateRazorpayOrderRequest {
  order_id: number; // Our internal order ID
  amount: number; // Amount in rupees
}

export interface RazorpayOrderResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface VerifyPaymentRequest {
  order_id: number; // Our internal order ID
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  description: string;
  image?: string;
  currency: string;
  key: string;
  amount: number;
  name: string;
  order_id: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
}

export interface PaymentResult {
  success: boolean;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  error?: string;
}

class PaymentService {
  private razorpayKeyId: string;

  constructor() {
    // Get Razorpay key from environment
    this.razorpayKeyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

    if (!this.razorpayKeyId) {
      console.warn('⚠️ Razorpay Key ID not configured in environment variables');
    }
  }

  /**
   * Create Razorpay order on backend
   */
  async createRazorpayOrder(request: CreateRazorpayOrderRequest): Promise<ApiResponse<RazorpayOrderResponse>> {
    try {
      const response = await apiService.post<RazorpayOrderResponse>(
        '/api/buyer/payments/create-razorpay-order',
        request
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create Razorpay order',
      };
    }
  }

  /**
   * Open Razorpay checkout
   */
  async openCheckout(options: RazorpayOptions): Promise<PaymentResult> {
    try {
      if (!this.razorpayKeyId) {
        return {
          success: false,
          error: 'Razorpay configuration is missing. Please contact support.',
        };
      }

      // Ensure amount is in paise (smallest currency unit)
      const amountInPaise = Math.round(options.amount * 100);

      const razorpayOptions = {
        ...options,
        key: this.razorpayKeyId,
        amount: amountInPaise,
      };

      const data = await RazorpayCheckout.open(razorpayOptions);

      return {
        success: true,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_order_id: data.razorpay_order_id,
        razorpay_signature: data.razorpay_signature,
      };
    } catch (error: any) {
      // User cancelled or payment failed
      return {
        success: false,
        error: error.description || error.error?.description || 'Payment was cancelled or failed',
      };
    }
  }

  /**
   * Verify payment on backend
   */
  async verifyPayment(request: VerifyPaymentRequest): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.post<any>(
        '/api/buyer/payments/verify-payment',
        request
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to verify payment',
      };
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(orderId: number, reason: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.post<any>(
        `/api/buyer/orders/${orderId}/payment-failed`,
        { reason }
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update payment status',
      };
    }
  }

  /**
   * Complete payment flow for an order
   * This is a convenience method that handles the entire payment process
   */
  async processPayment(
    orderId: number,
    amount: number,
    orderDetails: {
      restaurantName: string;
      restaurantLogo?: string;
      userEmail?: string;
      userPhone?: string;
      userName?: string;
    }
  ): Promise<PaymentResult> {
    try {
      // Step 1: Create Razorpay order on backend
      const createOrderResponse = await this.createRazorpayOrder({
        order_id: orderId,
        amount: amount,
      });

      if (!createOrderResponse.success || !createOrderResponse.data) {
        return {
          success: false,
          error: createOrderResponse.error || 'Failed to create payment order',
        };
      }

      const { razorpay_order_id, amount: orderAmount, currency, key_id } = createOrderResponse.data;

      // Step 2: Open Razorpay checkout
      const checkoutOptions: RazorpayOptions = {
        description: `Order #${orderId} from ${orderDetails.restaurantName}`,
        image: orderDetails.restaurantLogo,
        currency: currency,
        key: key_id || this.razorpayKeyId,
        amount: orderAmount,
        name: 'Tazty',
        order_id: razorpay_order_id,
        prefill: {
          email: orderDetails.userEmail,
          contact: orderDetails.userPhone,
          name: orderDetails.userName,
        },
        theme: {
          color: '#00B14F',
        },
      };

      const paymentResult = await this.openCheckout(checkoutOptions);

      if (!paymentResult.success) {
        // Payment failed or cancelled
        await this.handlePaymentFailure(orderId, paymentResult.error || 'Payment cancelled');
        return paymentResult;
      }

      // Step 3: Verify payment on backend
      const verifyResponse = await this.verifyPayment({
        order_id: orderId,
        razorpay_order_id: paymentResult.razorpay_order_id!,
        razorpay_payment_id: paymentResult.razorpay_payment_id!,
        razorpay_signature: paymentResult.razorpay_signature!,
      });

      if (!verifyResponse.success) {
        return {
          success: false,
          error: verifyResponse.error || 'Payment verification failed',
        };
      }

      return {
        success: true,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_signature: paymentResult.razorpay_signature,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment processing failed',
      };
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
