export type MetaCurrency = 'INR';

export type RegistrationMethod = 'phone_otp' | 'email' | 'google' | 'apple';

export interface PurchasePayload {
  orderId: string;
  amount: number;
  numItems?: number;
  currency?: MetaCurrency;
  eventId?: string;
}

