export const FirebaseStandardEvents = {
  SELECT_CONTENT: 'select_content',
  VIEW_ITEM: 'view_item',
  VIEW_ITEM_LIST: 'view_item_list',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  ADD_PAYMENT_INFO: 'add_payment_info',
  PURCHASE: 'purchase',
  VIEW_CART: 'view_cart',
  SEARCH: 'search',
  SIGN_UP: 'sign_up',
  LOGIN: 'login',
  SHARE: 'share',
  APP_OPEN: 'app_open',
} as const;

export const FirebaseStandardParams = {
  ITEM_ID: 'item_id',
  ITEM_NAME: 'item_name',
  ITEM_CATEGORY: 'item_category',
  ITEM_LIST_ID: 'item_list_id',
  ITEM_LIST_NAME: 'item_list_name',
  ITEM_VARIANT: 'item_variant',
  ITEM_BRAND: 'item_brand',
  PRICE: 'price',
  QUANTITY: 'quantity',
  CURRENCY: 'currency',
  VALUE: 'value',
  CONTENT_TYPE: 'content_type',
  CONTENT_ID: 'content_id',
  SEARCH_TERM: 'search_term',
  METHOD: 'method',
  SUCCESS: 'success',
} as const;

export const AnalyticsEvents = {
  // App & Session
  APP_OPEN: 'app_open',
  APP_STATE: 'app_state',
  SESSION_END: 'session_end',
  USER_SESSION_START: 'user_session_start',
  USER_SESSION_END: 'user_session_end',

  // Authentication
  LOGIN_VIEW: 'login_view',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  OTP_SENT: 'otp_sent',
  OTP_VERIFIED: 'otp_verified',
  OTP_FAILED: 'otp_failed',
  LOGOUT: 'logout',

  // Location & Discovery
  LOCATION_PERMISSION_GRANTED: 'location_permission_granted',
  LOCATION_PERMISSION_DENIED: 'location_permission_denied',
  LOCATION_SELECTED_MANUAL: 'location_selected_manual',
  RESTAURANT_LIST_VIEWED: 'restaurant_list_viewed',
  NEW_ADDRESS_ADDED: 'new_address_added',

  // Restaurant & Menu
  RESTAURANT_VIEWED: 'restaurant_viewed',
  MENU_VIEWED: 'menu_viewed',
  PRODUCT_VIEWED: 'product_viewed',
  SEARCH: 'search',

  // Cart
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  CART_VIEWED: 'cart_viewed',
  CART_ABANDONED: 'cart_abandoned',

  // Checkout & Payment
  CHECKOUT_STARTED: 'checkout_started',
  PAYMENT_METHOD_SELECTED: 'payment_method_selected',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',

  // Order lifecycle
  ORDER_PLACED: 'order_placed',
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_PICKED_UP: 'order_picked_up',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',

  // Error & performance
  API_ERROR: 'api_error',
  SCREEN_LOAD_SLOW: 'screen_load_slow',

  // Compatibility aliases used across current app
  LOGIN_START: 'login_view',
  LOGIN_FAILURE: 'login_failed',
  SIGNUP_START: 'login_view',
  SIGNUP_SUCCESS: 'login_success',
  RESTAURANT_VIEW: 'restaurant_viewed',
  SEARCH_START: 'search',
  ORDER_VIEW: 'order_placed',
  APP_BACKGROUND: 'app_state',
  APP_FOREGROUND: 'app_state',
} as const;

export const AnalyticsScreens = {
  LOGIN: 'Login',
  OTP_VERIFICATION: 'OTP Verification',
  WELCOME: 'Welcome',
  HOME: 'Home',
  PROFILE: 'Profile',
  EDIT_PROFILE: 'Edit Profile',
  ORDERS: 'My Orders',
  ORDER_DETAIL: 'Order Detail',
  ORDER_TRACKING: 'Order Tracking',
  RATE_ORDER: 'Rate Order',
  SEARCH: 'Search',
  ADDRESS_SELECTION: 'Address Selection',
  LOCATION_SELECTION: 'Location Selection',
  MY_ADDRESSES: 'My Addresses',
  CATEGORY_RESULTS: 'Category Results',
  RESTAURANT: 'Restaurant',
  RESTAURANT_DETAILS: 'Restaurant Details',
  CHECKOUT: 'Checkout',
  EXPLORE_DISHES: 'Explore Dishes',
  PRIVACY_POLICY: 'Privacy Policy',
  TERMS_CONDITIONS: 'Terms & Conditions',
  HELP: 'Help',
  CONTACT_US: 'Contact Us',
  FAQ: 'FAQ',
} as const;
