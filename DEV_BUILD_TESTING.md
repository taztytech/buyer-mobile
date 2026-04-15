# Development Build Testing

This document explains how to test the Tazty app with React Native CLI development builds when native modules are involved.

## Overview

The app includes fallback mechanisms for runtimes where some native modules are unavailable:

- **Maps (`react-native-maps`)**: fallback view with location info
- **Payment (`react-native-razorpay`)**: requires full native build
- **Push Notifications (Firebase)**: requires full native build

## Recommended Setup

Use native builds for complete feature testing:

```bash
npm run android
npm run ios
```

For iOS native dependencies:

```bash
pod install --project-directory=ios
```
