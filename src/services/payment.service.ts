// /**
//  * Payment Service
//  * Handles Razorpay payment integration and payment-related API calls
//  */

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

/**
 * Payment error types based on Razorpay SDK actions
 * Simplified to handle only: Network Error, Payment Cancelled, Payment Failed
 */
export enum PaymentErrorType {
  USER_CANCELLED = 'USER_CANCELLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export interface PaymentResult {
  success: boolean;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  error?: string;
  errorType?: PaymentErrorType;
  errorCode?: string;
}

class PaymentService {
  private razorpayKeyId: string;

  constructor() {
    // Get Razorpay key from environment
    this.razorpayKeyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
  }

  /**
   * Parse Razorpay SDK error and map to user-friendly message
   * Only handles: Network Error, Payment Cancelled, Payment Failed
   * Any other error (including user backing out) is treated as Payment Cancelled
   */
  private parseRazorpayError(error: any): {
    errorType: PaymentErrorType;
    errorMessage: string;
    errorCode?: string;
  } {
    // Extract error code from various possible locations
    const errorCode = 
      error?.code || 
      error?.error?.code || 
      error?.errorCode ||
      error?.razorpay_error_code;

    // Extract description from various possible locations
    const errorDescription = 
      error?.description || 
      error?.error?.description || 
      error?.message ||
      error?.razorpay_error_description ||
      error?.error?.message;

    // Normalize error code to uppercase for comparison
    const normalizedCode = errorCode?.toString().toUpperCase() || '';
    const normalizedDescription = errorDescription?.toString().toLowerCase() || '';

    // Check for Network Error first
    if (
      normalizedCode === 'NETWORK_ERROR' ||
      normalizedCode === 'NETWORK_ISSUE' ||
      normalizedDescription.includes('network') ||
      normalizedDescription.includes('connection') ||
      normalizedDescription.includes('timeout') ||
      normalizedDescription.includes('internet')
    ) {
      return {
        errorType: PaymentErrorType.NETWORK_ERROR,
        errorMessage: 'Unable to connect. Please check your internet connection and try again.',
        errorCode: normalizedCode || 'NETWORK_ERROR',
      };
    }

    // Check for Payment Failed (card declined, insufficient funds, etc.)
    if (
      normalizedCode === 'PAYMENT_FAILED' ||
      normalizedCode === 'PAYMENT_DECLINED' ||
      normalizedCode === 'CARD_DECLINED' ||
      normalizedCode === 'INSUFFICIENT_FUNDS' ||
      normalizedDescription.includes('payment failed') ||
      normalizedDescription.includes('declined') ||
      normalizedDescription.includes('insufficient') ||
      (normalizedDescription.includes('failed') && !normalizedDescription.includes('cancelled'))
    ) {
      // Provide more specific message based on error description
      let paymentFailureMessage = 'Payment could not be processed.';
      
      if (normalizedDescription.includes('insufficient') || normalizedDescription.includes('funds')) {
        paymentFailureMessage = 'Not enough money in your account. Please use a different payment method or add money to your account.';
      } else if (normalizedDescription.includes('declined') || normalizedDescription.includes('card')) {
        paymentFailureMessage = 'Your payment was declined. Please try a different payment method.';
      } else if (normalizedDescription.includes('expired')) {
        paymentFailureMessage = 'Your card has expired. Please use a different payment method.';
      } else if (normalizedDescription.includes('invalid')) {
        paymentFailureMessage = 'The payment details you entered are incorrect. Please check and try again.';
      }

      return {
        errorType: PaymentErrorType.PAYMENT_FAILED,
        errorMessage: paymentFailureMessage,
        errorCode: normalizedCode || 'PAYMENT_FAILED',
      };
    }

    // Default: Treat everything else as Payment Cancelled
    // This includes: user backing out, closing Razorpay, cancellation, or any other error
    return {
      errorType: PaymentErrorType.USER_CANCELLED,
      errorMessage: 'Payment was cancelled. You can try again when ready.',
      errorCode: normalizedCode || 'USER_CANCELLED',
    };
  }

  /**
   * Initiate payment for an order
   * @deprecated This method is no longer used. Payment details are now included in the order creation response.
   * Use processPayment with payment_details from order response instead.
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
      // Use key from options (from API) with env as fallback
      const razorpayKey = options.key || this.razorpayKeyId;
      
      if (!razorpayKey) {
        // Treat configuration error as payment cancelled for simplicity
        return {
          success: false,
          error: 'Payment was cancelled. You can try again when ready.',
          errorType: PaymentErrorType.USER_CANCELLED,
          errorCode: 'MISSING_RAZORPAY_KEY',
        };
      }

      // Ensure amount is in paise (smallest currency unit)
      const amountInPaise = Math.round(options.amount * 100);

      const razorpayOptions = {
        ...options,
        key: razorpayKey,
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
      // Parse SDK error and map to user-friendly message based on error type
      const parsedError = this.parseRazorpayError(error);
      
      return {
        success: false,
        error: parsedError.errorMessage,
        errorType: parsedError.errorType,
        errorCode: parsedError.errorCode,
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
   * This method uses payment_details directly from order creation response
   */
  async processPayment(
    orderId: number,
    paymentDetails: PaymentDetails
  ): Promise<PaymentResult> {
    try {
      // Step 1: Open Razorpay checkout using payment_details from order response
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

      const paymentResult = await this.openCheckout(checkoutOptions);

      if (!paymentResult.success) {
        // Only mark as payment failure if it's not a user cancellation or network error
        // User cancellations and network errors don't need to be marked as failures
        if (
          paymentResult.errorType === PaymentErrorType.PAYMENT_FAILED
        ) {
          await this.handlePaymentFailure(orderId, {
            reason: paymentResult.error || 'Payment could not be processed',
          });
        }
        return paymentResult;
      }

      // Step 2: Verify payment on backend
      const verifyResponse = await this.verifyPayment({
        razorpay_payment_id: paymentResult.razorpay_payment_id!,
        razorpay_order_id: paymentResult.razorpay_order_id!,
        razorpay_signature: paymentResult.razorpay_signature!,
      });

      if (!verifyResponse.success) {
        // Verification failed - treat as payment failed
        await this.handlePaymentFailure(orderId, {
          reason: 'Payment could not be confirmed',
        });
        return {
          success: false,
          error: verifyResponse.error || 'Payment could not be processed. If money was deducted from your account, please contact support.',
          errorType: PaymentErrorType.PAYMENT_FAILED,
          errorCode: 'VERIFICATION_FAILED',
        };
      }

      return {
        success: true,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_signature: paymentResult.razorpay_signature,
      };
    } catch (error: any) {
      // Parse any unexpected errors
      const parsedError = this.parseRazorpayError(error);
      return {
        success: false,
        error: parsedError.errorMessage,
        errorType: parsedError.errorType,
        errorCode: parsedError.errorCode,
      };
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;


// ---------------------------------------------------
// Developer Testing of Razorpay Integration (Mock)

/**
 * Payment Service
 * Handles Razorpay payment integration and payment-related API calls
 */

// import RazorpayCheckout from 'react-native-razorpay';
// import { apiService, ApiResponse } from './api.service';
// import { isExpoGo, isDevelopment } from '@/utils/platform.util';

// // Payment Interfaces
// export interface InitiatePaymentRequest {
//   name: string;
//   email?: string;
//   phone: string;
// }

// export interface PaymentDetails {
//   razorpay_order_id: string;
//   amount: number;
//   currency: string;
//   key: string;
//   name: string;
//   description: string;
//   prefill: {
//     name: string;
//     email?: string;
//     contact: string;
//   };
// }

// export interface InitiatePaymentResponse {
//   success: boolean;
//   message: string;
//   payment_details: PaymentDetails;
// }

// export interface VerifyPaymentRequest {
//   razorpay_payment_id: string;
//   razorpay_order_id: string;
//   razorpay_signature: string;
// }

// export interface PaymentFailureRequest {
//   reason: string;
// }

// export interface RazorpayOptions {
//   description: string;
//   image?: string;
//   currency: string;
//   key: string;
//   amount: number;
//   name: string;
//   order_id: string;
//   prefill?: {
//     email?: string;
//     contact?: string;
//     name?: string;
//   };
//   theme?: {
//     color?: string;
//   };
// }

// export interface PaymentResult {
//   success: boolean;
//   razorpay_payment_id?: string;
//   razorpay_order_id?: string;
//   razorpay_signature?: string;
//   error?: string;
// }

// class PaymentService {
//   private razorpayKeyId: string;
//   private useMockPayment: boolean;

//   constructor() {
//     // Get Razorpay key from environment
//     this.razorpayKeyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
    
//     // Enable mock payment in Expo Go or if explicitly set in env
//     // Set EXPO_PUBLIC_MOCK_PAYMENT=true to force mock mode even in dev builds
//     const forceMock = process.env.EXPO_PUBLIC_MOCK_PAYMENT === 'true';
//     this.useMockPayment = forceMock || (isExpoGo() && isDevelopment());
//   }

//   /**
//    * Initiate payment for an order
//    */
//   async initiatePayment(orderId: number, request: InitiatePaymentRequest): Promise<ApiResponse<InitiatePaymentResponse>> {
//     try {
//       const response = await apiService.post<InitiatePaymentResponse>(
//         `/api/buyer/payment/initiate/${orderId}`,
//         request
//       );
//       return response;
//     } catch (error: any) {
//       return {
//         success: false,
//         error: error.message || 'Failed to initiate payment',
//       };
//     }
//   }

//   /**
//    * Open Razorpay checkout
//    */
//   async openCheckout(options: RazorpayOptions): Promise<PaymentResult> {
//     try {
//       if (!this.razorpayKeyId) {
//         return {
//           success: false,
//           error: 'Razorpay configuration is missing. Please contact support.',
//         };
//       }

//       // Ensure amount is in paise (smallest currency unit)
//       const amountInPaise = Math.round(options.amount * 100);

//       const razorpayOptions = {
//         ...options,
//         key: this.razorpayKeyId,
//         amount: amountInPaise,
//       };

//       const data = await RazorpayCheckout.open(razorpayOptions);

//       return {
//         success: true,
//         razorpay_payment_id: data.razorpay_payment_id,
//         razorpay_order_id: data.razorpay_order_id,
//         razorpay_signature: data.razorpay_signature,
//       };
//     } catch (error: any) {
//       // User cancelled or payment failed
//       return {
//         success: false,
//         error: error.description || error.error?.description || 'Payment was cancelled or failed',
//       };
//     }
//   }

//   /**
//    * Verify payment on backend
//    */
//   async verifyPayment(request: VerifyPaymentRequest): Promise<ApiResponse<any>> {
//     try {
//       const response = await apiService.post<any>(
//         '/api/buyer/payment/verify',
//         request
//       );
//       return response;
//     } catch (error: any) {
//       return {
//         success: false,
//         error: error.message || 'Failed to verify payment',
//       };
//     }
//   }

//   /**
//    * Handle payment failure
//    */
//   async handlePaymentFailure(orderId: number, request: PaymentFailureRequest): Promise<ApiResponse<any>> {
//     try {
//       const response = await apiService.post<any>(
//         `/api/buyer/payment/failure/${orderId}`,
//         request
//       );
//       return response;
//     } catch (error: any) {
//       return {
//         success: false,
//         error: error.message || 'Failed to record payment failure',
//       };
//     }
//   }

//   /**
//    * Complete payment flow for an order
//    * This is a convenience method that handles the entire payment process
//    */
//   async processPayment(
//     orderId: number,
//     userDetails: {
//       name: string;
//       email?: string;
//       phone: string;
//     }
//   ): Promise<PaymentResult> {
//     try {
//       // Mock payment mode for testing (Expo Go or when explicitly enabled)
//       if (this.useMockPayment) {
//         console.log('[PaymentService] Using mock payment mode for testing');
//         // Simulate a small delay to mimic real payment processing
//         await new Promise(resolve => setTimeout(resolve, 1000));
        
//         // Return successful mock payment
//         return {
//           success: true,
//           razorpay_payment_id: 'mock_payment_' + Date.now(),
//           razorpay_order_id: 'mock_order_' + orderId,
//           razorpay_signature: 'mock_signature',
//         };
//       }

//       // Step 1: Initiate payment on backend
//       const initiateResponse = await this.initiatePayment(orderId, {
//         name: userDetails.name,
//         email: userDetails.email,
//         phone: userDetails.phone,
//       });

//       if (!initiateResponse.success || !initiateResponse.data) {
//         return {
//           success: false,
//           error: initiateResponse.error || 'Failed to initiate payment',
//         };
//       }

//       const paymentDetails = initiateResponse.data.payment_details;

//       // Step 2: Open Razorpay checkout
//       const checkoutOptions: RazorpayOptions = {
//         description: paymentDetails.description,
//         currency: paymentDetails.currency,
//         key: paymentDetails.key,
//         amount: paymentDetails.amount,
//         name: paymentDetails.name,
//         order_id: paymentDetails.razorpay_order_id,
//         prefill: {
//           email: paymentDetails.prefill.email,
//           contact: paymentDetails.prefill.contact,
//           name: paymentDetails.prefill.name,
//         },
//         theme: {
//           color: '#00B14F',
//         },
//       };

//       const paymentResult = await this.openCheckout(checkoutOptions);

//       if (!paymentResult.success) {
//         // Payment failed or cancelled
//         await this.handlePaymentFailure(orderId, {
//           reason: paymentResult.error || 'Payment cancelled by user',
//         });
//         return paymentResult;
//       }

//       // Step 3: Verify payment on backend
//       const verifyResponse = await this.verifyPayment({
//         razorpay_payment_id: paymentResult.razorpay_payment_id!,
//         razorpay_order_id: paymentResult.razorpay_order_id!,
//         razorpay_signature: paymentResult.razorpay_signature!,
//       });

//       if (!verifyResponse.success) {
//         // Verification failed
//         await this.handlePaymentFailure(orderId, {
//           reason: 'Payment verification failed',
//         });
//         return {
//           success: false,
//           error: verifyResponse.error || 'Payment verification failed',
//         };
//       }

//       return {
//         success: true,
//         razorpay_payment_id: paymentResult.razorpay_payment_id,
//         razorpay_order_id: paymentResult.razorpay_order_id,
//         razorpay_signature: paymentResult.razorpay_signature,
//       };
//     } catch (error: any) {
//       return {
//         success: false,
//         error: error.message || 'Payment processing failed',
//       };
//     }
//   }
// }

// // Export singleton instance
// export const paymentService = new PaymentService();
// export default paymentService;
