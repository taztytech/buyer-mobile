# Push Notifications Setup Guide

This guide explains how to complete the FCM push notification integration for the Tazty app.

## ✅ What's Already Integrated

The following has been completed:

1. ✅ **Expo Notifications Installed** - `expo-notifications` and `expo-device` packages
2. ✅ **API Endpoints Configured**:
   - `POST /api/buyer/push-tokens` - Register device token
   - `DELETE /api/buyer/push-tokens/{token}` - Unregister device token
3. ✅ **Push Notification Service** - Complete service in `src/services/pushNotification.service.ts`
4. ✅ **Lifecycle Integration**:
   - Auto-registers push token after successful login
   - Auto-unregisters token on logout
5. ✅ **App Configuration** - `app.json` updated with notification permissions

---

## 📋 What You Need to Do

### 1. Firebase Setup (For Android)

#### a. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Add an Android app:
   - Package name: `com.valarcom.tazty`
   - Download the `google-services.json` file

#### b. Add google-services.json
1. Place the downloaded `google-services.json` in your project root:
   ```
   /Users/arun/My Projects/Tazty-User-App/ReactNative-Version/Tazty/google-services.json
   ```

2. The file should look like this:
   ```json
   {
     "project_info": {
       "project_number": "...",
       "project_id": "...",
       "storage_bucket": "..."
     },
     "client": [...]
   }
   ```

---

### 2. iOS Setup (For Apple Push Notifications)

#### a. Apple Developer Account
1. Log in to [Apple Developer Portal](https://developer.apple.com/)
2. Go to **Certificates, Identifiers & Profiles**
3. Create/update App ID: `com.valarcom.tazty`
4. Enable **Push Notifications** capability

#### b. Generate APNs Key
1. In Apple Developer Portal, go to **Keys**
2. Create new key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` key file
4. Note the **Key ID** and **Team ID**

#### c. Upload to Expo
1. Run: `npx eas credentials`
2. Select iOS → Push Notifications
3. Upload the `.p8` file and enter Key ID and Team ID

---

### 3. Expo EAS Setup

#### a. Configure EAS
If you haven't already, create `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### b. Rebuild the App
After adding `google-services.json`:

```bash
# For development build
npx eas build --profile development --platform android

# For production
npx eas build --profile production --platform android
```

---

## 🧪 Testing Push Notifications

### Test on Real Device
1. **Login to the app** - Push token is automatically registered
2. **Check backend logs** - Verify `POST /api/buyer/push-tokens` was called
3. **Send test notification from backend** using the registered token

### Test Notification Payload
Your backend should send notifications in this format:

```javascript
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "sound": "default",
  "title": "Order Update",
  "body": "Your order #1234 is on the way!",
  "data": {
    "orderId": "1234",
    "screen": "orderTracking"
  }
}
```

---

## 📱 How It Works

### 1. On Login
```typescript
// Automatic flow in auth.service.ts
1. User logs in with OTP
2. Tokens are saved
3. Push notification registration starts
4. Device token is sent to: POST /api/buyer/push-tokens
   {
     "token": "ExponentPushToken[xxx]",
     "device_type": "android" | "ios",
     "device_name": "User's Phone"
   }
```

### 2. On Logout
```typescript
// Automatic flow in auth.service.ts
1. User logs out
2. Push token is unregistered: DELETE /api/buyer/push-tokens/{token}
3. Local token is cleared
4. Session is cleared
```

### 3. Receiving Notifications
```typescript
// In your app, you can add listeners (optional)
import { pushNotificationService } from '@/services/pushNotification.service';

// When app is in foreground
pushNotificationService.addNotificationReceivedListener((notification) => {
  console.log('Notification received:', notification);
});

// When user taps notification
pushNotificationService.addNotificationResponseListener((response) => {
  console.log('Notification tapped:', response);
  // Navigate to specific screen based on notification data
});
```

---

## 🔧 Backend Requirements

Your backend API endpoints should:

### POST /api/buyer/push-tokens
**Request:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "device_type": "android",
  "device_name": "Samsung Galaxy S21"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push token registered successfully"
}
```

### DELETE /api/buyer/push-tokens/{token}
**Request:**
- URL parameter: `token` (URL encoded)

**Response:**
```json
{
  "success": true,
  "message": "Push token unregistered successfully"
}
```

---

## 🐛 Troubleshooting

### Push notifications not working on iOS?
- ✅ Check if Push Notifications capability is enabled in App ID
- ✅ Verify APNs key is uploaded to Expo
- ✅ Test only on physical device (not simulator)

### Push notifications not working on Android?
- ✅ Verify `google-services.json` is in the correct location
- ✅ Rebuild the app after adding the file
- ✅ Check Firebase project configuration

### Token not being sent to backend?
- ✅ Check device permissions: Settings → Tazty → Notifications → Allow
- ✅ Check network logs for API call failures
- ✅ Verify backend endpoint is accessible

### "Permission denied" error?
- User may have denied notification permissions
- Guide them to: Settings → Tazty → Notifications → Allow

---

## 📚 Additional Resources

- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Apple Push Notifications](https://developer.apple.com/documentation/usernotifications)

---

## ✅ Checklist

Before deploying to production:

- [ ] `google-services.json` added to project root
- [ ] iOS APNs key uploaded to Expo
- [ ] Backend endpoints implemented and tested
- [ ] App rebuilt with EAS
- [ ] Tested on real Android device
- [ ] Tested on real iOS device
- [ ] Verified token registration on login
- [ ] Verified token unregistration on logout
- [ ] Tested receiving notifications
- [ ] Tested notification tapping/navigation

---

## 🎯 Summary

The FCM integration is **90% complete**. You just need to:

1. Add `google-services.json` file for Android
2. Configure APNs for iOS
3. Rebuild the app
4. Test on real devices

Everything else (permissions, API calls, lifecycle management) is already integrated! 🎉
