export const ROUTES = {
  // Auth routes
  LOGIN: 'Login',
  REGISTER: 'Register',
  FORGOT_PASSWORD: 'ForgotPassword',

  // Main routes
  HOME: 'Home',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',

  // Add more routes as needed
} as const;

export type RouteNames = (typeof ROUTES)[keyof typeof ROUTES];
