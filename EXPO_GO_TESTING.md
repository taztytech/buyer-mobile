# Testing in Expo Go

This document explains how to test the Tazty app in Expo Go on iOS, which has limitations with certain native modules.

## Overview

The app now includes fallback mechanisms to handle native modules that aren't supported in Expo Go:

- **Maps (react-native-maps)**: Shows a fallback view with location info and "Open in Maps" button
- **Payment Gateway (react-native-razorpay)**: Not yet implemented (will need fallback)
- **Push Notifications**: Already has Expo Go detection and graceful fallback

## What Works in Expo Go

✅ All UI screens and navigation
✅ API calls and data fetching
✅ Authentication (OTP login)
✅ Profile management
✅ Cart functionality
✅ Restaurant browsing
✅ Location text display (without map preview)
✅ Image loading and caching
✅ All React Native core features

## What Shows Fallback Views

⚠️ **Maps**: Shows location text + "Open in Maps" button instead of interactive map
⚠️ **Push Notifications**: Disabled with warning message in logs

## What Requires Development Build

❌ **Razorpay Payments**: Native payment gateway requires development build
❌ **Interactive Maps**: Full map preview with markers requires development build
❌ **Push Notifications**: Testing push notifications requires development build

## How to Test in Expo Go

### 1. Start the Development Server

```bash
cd /Users/arun/My\ Projects/Tazty-User-App/ReactNative-Version/Tazty
npx expo start --clear
```

### 2. Open in Expo Go on iPhone

- Install Expo Go from App Store
- Scan QR code from terminal
- App will load with fallback views for unsupported features

### 3. Features You Can Test

**Authentication:**
- Login with phone number
- OTP verification
- Profile creation and editing

**Restaurant Browsing:**
- View restaurant list
- Search restaurants
- Filter by cuisine
- View restaurant details (with map fallback)
- View menu items

**Cart & Ordering:**
- Add items to cart
- Customize items
- View cart
- *Note: Payment will need fallback implementation*

**Profile:**
- Edit profile
- Manage addresses
- View order history
- Change settings

## Fallback System Architecture

### Platform Detection (`src/utils/platform.util.ts`)

```typescript
import { isExpoGo } from '@/utils/platform.util';

if (isExpoGo()) {
  // Show fallback UI
} else {
  // Show full native feature
}
```

### Mock Data (`src/utils/mockData.util.ts`)

Provides realistic mock data for testing when needed:
- Mock restaurants
- Mock orders
- Mock user data
- Mock addresses

### Map Fallback

The RestaurantDetailsScreen now conditionally loads MapView:

```typescript
// Shows real map in dev/production builds
// Shows fallback view in Expo Go
{MapView && !isExpoGo() ? (
  <MapView ... />
) : (
  <FallbackView ... />
)}
```

## Creating a Development Build (Recommended)

For full feature testing on iOS, create a development build:

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Create iOS development build
eas build --profile development --platform ios
```

This will create an installable build that includes all native modules.

### Local Build (Alternative)

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Open in Xcode
cd ios
open Tazty.xcworkspace

# Build and run on device/simulator from Xcode
```

## Troubleshooting

### "Invariant Violation" Error

If you see invariant violation errors about missing native modules:
- ✅ **Fixed**: MapView now has conditional loading
- ✅ **Fixed**: Push notifications have Expo Go detection
- ⚠️ **Needs Fix**: Razorpay payment (if you try to use it)

### Metro Bundler Cache Issues

```bash
npx expo start --clear
```

### App Crashes on iOS Expo Go

1. Check if error is related to native module
2. Ensure conditional loading is added for that module
3. Add fallback view or mock data

## Adding More Fallbacks

If you need to add fallbacks for other native modules:

1. **Add Platform Check**:
```typescript
import { isExpoGo } from '@/utils/platform.util';

if (!isExpoGo()) {
  // Use native module
} else {
  // Use fallback
}
```

2. **Conditional Import**:
```typescript
let NativeModule: any;
if (!isExpoGo()) {
  NativeModule = require('native-module');
}
```

3. **Create Fallback UI**:
```typescript
{NativeModule && !isExpoGo() ? (
  <NativeFeature />
) : (
  <FallbackView />
)}
```

## Production Builds

Production builds (.ipa for iOS, .apk for Android) include all native modules and don't need fallbacks. The `isExpoGo()` check will return `false` in production, so all full features will be available.

## References

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo Go Limitations](https://docs.expo.dev/workflow/expo-go/#limitations)
