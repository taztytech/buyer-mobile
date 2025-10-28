# Razorpay Payment Integration

## Overview
This document describes the Razorpay payment gateway integration implemented in the Tazty User App.

## Features Implemented

### 1. Payment Service (`src/services/payment.service.ts`)
- **Created Razorpay Order**: Creates an order on the backend before initiating payment
- **Open Checkout**: Opens Razorpay's native checkout interface
- **Verify Payment**: Verifies payment signature on the backend
- **Handle Failures**: Manages payment failure scenarios
- **Complete Flow**: End-to-end payment processing method

### 2. Checkout Screen Updates (`src/screens/Checkout/CheckoutScreen.tsx`)
- **Payment Method Selection**: Users can choose between:
  - **Cash on Delivery (COD)**: Pay when you receive
  - **Pay Online**: UPI, Card, Wallet & More (via Razorpay)
- **Visual Feedback**: Radio buttons and highlighted cards show selected payment method
- **Dynamic Flow**: Different handling based on payment method chosen

### 3. Payment Flow

#### Cash on Delivery (COD)
1. User selects COD payment method
2. Adds items to server cart
3. Creates order with payment_method='cod'
4. Shows success message immediately
5. Clears local cart

#### Online Payment (Razorpay)
1. User selects Online payment method
2. Adds items to server cart
3. Creates order with payment_method='online'
4. Creates Razorpay order on backend (gets razorpay_order_id)
5. Opens Razorpay checkout with order details
6. User completes payment
7. Verifies payment signature on backend
8. Shows success/failure message
9. Clears local cart on success

## Backend API Endpoints Required

Your backend must implement these endpoints:

### 1. Create Razorpay Order
```
POST /api/buyer/payments/create-razorpay-order
Body: {
  order_id: number,
  amount: number
}
Response: {
  success: boolean,
  data: {
    razorpay_order_id: string,
    amount: number,
    currency: string,
    key_id: string
  }
}
```

### 2. Verify Payment
```
POST /api/buyer/payments/verify-payment
Body: {
  order_id: number,
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string
}
Response: {
  success: boolean,
  message: string
}
```

### 3. Payment Failed (Optional)
```
POST /api/buyer/orders/{orderId}/payment-failed
Body: {
  reason: string
}
Response: {
  success: boolean,
  message: string
}
```

## Environment Configuration

Ensure your `.env` file has the Razorpay Key ID:

```bash
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx  # Test mode
# OR
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx  # Production mode
```

## Backend Configuration

Your backend should have:

```
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

## Testing

### Test Mode
1. Use Razorpay test credentials (rzp_test_...)
2. Use test cards from Razorpay docs:
   - Card: 4111 1111 1111 1111
   - CVV: Any 3 digits
   - Expiry: Any future date

### Production Mode
1. Switch to live credentials (rzp_live_...)
2. Complete Razorpay KYC verification
3. Test with small real transactions first

## Error Handling

The integration handles these scenarios:
- User cancels payment
- Payment fails (insufficient funds, declined card, etc.)
- Network errors during payment
- Payment verification failures
- Invalid Razorpay configuration

## Security Notes

1. **Key ID Only**: The mobile app only contains the Razorpay Key ID (public key)
2. **Secret on Backend**: The Razorpay Key Secret must NEVER be in the mobile app
3. **Signature Verification**: All payments are verified on the backend using HMAC SHA256
4. **Amount Validation**: Backend should validate the payment amount matches the order

## Payment Status Flow

```
Order Created (pending)
    ↓
Payment Initiated
    ↓
Payment Success → Verified → Order Confirmed
    OR
Payment Failed → Order Marked as Failed
    OR
Payment Cancelled → Order Remains Pending
```

## Future Enhancements

- Add payment retry logic for failed transactions
- Support for wallet payments (Paytm, PhonePe, etc.)
- Save card details for future use (requires PCI compliance)
- Add offer/coupon application before payment
- Support for EMI options
- International payment support

## Support

For Razorpay-specific issues:
- Documentation: https://razorpay.com/docs/
- Support: https://dashboard.razorpay.com/support

For integration issues:
- Check network logs in React Native Debugger
- Verify API endpoints are accessible
- Ensure Razorpay Key ID is correct
- Check payment verification signature generation on backend
