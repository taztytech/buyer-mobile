/**
 * Payment Service
 * Handles Razorpay payment integration and payment-related API calls
 */

import RazorpayCheckout from 'react-native-razorpay';
import { apiService, ApiResponse } from './api.service';

// Payment Interfaces
export interface InitiatePaymentRequest {
  name: string;
  email?: string;
  phone: string;
}

export interface PaymentDetails {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key: string;
  name: string;
  description: string;
  prefill: {
    name: string;
    email?: string;
    contact: string;
  };
}

export interface InitiatePaymentResponse {
  success: boolean;
  message: string;
  payment_details: PaymentDetails;
}

export interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface PaymentFailureRequest {
  reason: string;
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
   * Initiate payment for an order
   */
  async initiatePayment(orderId: number, request: InitiatePaymentRequest): Promise<ApiResponse<InitiatePaymentResponse>> {
    try {
      const response = await apiService.post<InitiatePaymentResponse>(
        `/api/buyer/payment/initiate/${orderId}`,
        request
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to initiate payment',
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
        '/api/buyer/payment/verify',
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
  async handlePaymentFailure(orderId: number, request: PaymentFailureRequest): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.post<any>(
        `/api/buyer/payment/failure/${orderId}`,
        request
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to record payment failure',
      };
    }
  }

  /**
   * Complete payment flow for an order
   * This is a convenience method that handles the entire payment process
   */
  async processPayment(
    orderId: number,
    userDetails: {
      name: string;
      email?: string;
      phone: string;
    }
  ): Promise<PaymentResult> {
    try {
      console.log('🔵 [Payment] Starting payment process for order:', orderId);
      console.log('🔵 [Payment] User details:', userDetails);

      // Step 1: Initiate payment on backend
      const initiateResponse = await this.initiatePayment(orderId, {
        name: userDetails.name,
        email: userDetails.email,
        phone: userDetails.phone,
      });

      console.log('🔵 [Payment] Initiate response:', JSON.stringify(initiateResponse, null, 2));

      if (!initiateResponse.success || !initiateResponse.data) {
        console.log('🔴 [Payment] Failed to initiate payment:', initiateResponse.error);
        return {
          success: false,
          error: initiateResponse.error || 'Failed to initiate payment',
        };
      }

      const paymentDetails = initiateResponse.data.payment_details;
      console.log('🔵 [Payment] Payment details received:', JSON.stringify(paymentDetails, null, 2));

      // Step 2: Open Razorpay checkout
      const checkoutOptions: RazorpayOptions = {
        description: paymentDetails.description,
        currency: paymentDetails.currency,
        key: paymentDetails.key,
        amount: paymentDetails.amount,
        name: paymentDetails.name,
        order_id: paymentDetails.razorpay_order_id,
        prefill: {
          email: paymentDetails.prefill.email,
          contact: paymentDetails.prefill.contact,
          name: paymentDetails.prefill.name,
        },
        theme: {
          color: '#00B14F',
        },
      };

      console.log('🔵 [Payment] Opening Razorpay checkout with options:', JSON.stringify(checkoutOptions, null, 2));
      const paymentResult = await this.openCheckout(checkoutOptions);
      console.log('🔵 [Payment] Razorpay checkout result:', JSON.stringify(paymentResult, null, 2));

      if (!paymentResult.success) {
        // Payment failed or cancelled
        console.log('🔴 [Payment] Payment failed or cancelled:', paymentResult.error);
        await this.handlePaymentFailure(orderId, {
          reason: paymentResult.error || 'Payment cancelled by user',
        });
        return paymentResult;
      }

      // Step 3: Verify payment on backend
      console.log('🔵 [Payment] Verifying payment on backend');
      const verifyResponse = await this.verifyPayment({
        razorpay_payment_id: paymentResult.razorpay_payment_id!,
        razorpay_order_id: paymentResult.razorpay_order_id!,
        razorpay_signature: paymentResult.razorpay_signature!,
      });

      console.log('🔵 [Payment] Verify response:', JSON.stringify(verifyResponse, null, 2));

      if (!verifyResponse.success) {
        // Verification failed
        console.log('🔴 [Payment] Payment verification failed');
        await this.handlePaymentFailure(orderId, {
          reason: 'Payment verification failed',
        });
        return {
          success: false,
          error: verifyResponse.error || 'Payment verification failed',
        };
      }

      console.log('✅ [Payment] Payment completed successfully!');
      return {
        success: true,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_signature: paymentResult.razorpay_signature,
      };
    } catch (error: any) {
      console.log('🔴 [Payment] Error in payment process:', error);
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
