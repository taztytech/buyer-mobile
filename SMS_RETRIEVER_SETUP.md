# SMS Retriever API - Complete Setup Guide

This guide provides complete instructions for implementing Google SMS Retriever API for OTP auto-read in your React Native Android app.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Steps](#setup-steps)
4. [SHA-256 Hash Generation](#sha-256-hash-generation)
5. [Backend SMS Format](#backend-sms-format)
6. [Usage](#usage)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## 🎯 Overview

The SMS Retriever API allows your app to automatically read OTP from SMS messages **without requiring READ_SMS permission**. This provides a better user experience and complies with Google Play Store policies.

### Key Features

- ✅ No READ_SMS permission required
- ✅ Automatic OTP extraction and auto-fill
- ✅ Secure and privacy-compliant
- ✅ Works with any SMS app
- ✅ 60-second timeout handling
- ✅ Error handling and fallback

---

## 📦 Prerequisites

- React Native CLI project (not Expo managed workflow)
- Android Studio installed
- Java Development Kit (JDK) installed
- Android SDK with API level 19+ (Android 4.4+)
- Google Play Services on the device

---

## 🔧 Setup Steps

### Step 1: Dependencies Already Added ✅

The following dependencies have been added to `android/app/build.gradle`:

```gradle
// SMS Retriever API
implementation 'com.google.android.gms:play-services-auth:21.2.0'
implementation 'com.google.android.gms:play-services-auth-api-phone:18.1.0'
```

### Step 2: Native Module Registration ✅

The `SmsRetrieverModule` and `SmsRetrieverPackage` have been created and registered in `MainApplication.kt`.

### Step 3: Verify Package Name

Ensure your app's package name matches in:
- `android/app/build.gradle` → `applicationId`
- `AndroidManifest.xml` → `package`
- Backend SMS configuration

**Current package name:** `in.tazty.buyer`

---

## 🔑 SHA-256 Hash Generation

The SMS Retriever API requires an 11-character hash string to be appended to your SMS messages. This hash is derived from your app's signing certificate.

### Method 1: Using Debug Keystore (Development)

For development builds using the debug keystore:

```bash
# Windows (PowerShell)
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | Select-String "SHA256"

# macOS/Linux
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256
```

**Extract the hash:**
1. Copy the SHA-256 fingerprint (64 characters)
2. Convert to Base64 (first 11 characters)
3. Or use the app to get it programmatically (see below)

### Method 2: Using Release Keystore (Production)

For production builds:

```bash
# Replace with your actual keystore path and alias
keytool -list -v -keystore android/app/my-release-key.keystore -alias my-key-alias
```

Enter your keystore password when prompted, then extract the SHA-256 hash.

### Method 3: Get Hash Programmatically (Recommended)

You can get the hash directly from your app:

```typescript
import { smsRetrieverService } from '@/services/smsRetriever.service';

// Get the app hash
const hash = await smsRetrieverService.getAppHash();
console.log('App Hash:', hash);
```

**Note:** The hash is different for:
- Debug builds (debug.keystore)
- Release builds (release keystore)
- Different keystores

You need to generate hashes for **both debug and release** keystores and provide them to your backend team.

### Method 4: Using App Hash Tool (Alternative)

You can also use Google's App Hash Tool:
1. Install the app on a device
2. Run: `adb logcat | grep "App Hash"`
3. Or use the `getAppHash()` method in your app

---

## 📱 Backend SMS Format

Your backend must append the 11-character hash to the SMS message. The hash must be at the **end** of the message, preceded by a space.

### Example SMS Formats

#### ✅ Correct Format (4-digit OTP)

```
Your Tazty verification code is 1234. <#>
```

Where `<#>` is replaced with your 11-character hash, for example:

```
Your Tazty verification code is 1234. ABC123XYZ45
```

#### ✅ Correct Format (6-digit OTP)

```
Your Tazty verification code is 123456. ABC123XYZ45
```

#### ✅ Alternative Formats

```
OTP: 1234. ABC123XYZ45
Verification code: 1234. ABC123XYZ45
1234 is your Tazty OTP. ABC123XYZ45
```

### ❌ Incorrect Formats

```
ABC123XYZ45 Your code is 1234  // Hash must be at the end
Your code is 1234ABC123XYZ45   // Missing space before hash
Your code is 1234.             // Missing hash
```

### SMS Requirements

1. **Hash at the end:** The 11-character hash must be the last part of the message
2. **Space before hash:** There must be a space before the hash
3. **Message length:** Keep total message under 140 characters (SMS limit)
4. **OTP format:** The OTP can be 4-6 digits (or alphanumeric)
5. **Hash format:** Exactly 11 characters, Base64 encoded

### Backend Implementation Example (Node.js)

```javascript
// Example backend code
const appHash = 'ABC123XYZ45'; // Get from your app's signing certificate
const otp = generateOTP(); // Your 4-digit OTP

const smsMessage = `Your Tazty verification code is ${otp}. ${appHash}`;

// Send SMS
await sendSMS(phoneNumber, smsMessage);
```

### Backend Implementation Example (Python)

```python
# Example backend code
app_hash = 'ABC123XYZ45'  # Get from your app's signing certificate
otp = generate_otp()  # Your 4-digit OTP

sms_message = f"Your Tazty verification code is {otp}. {app_hash}"

# Send SMS
send_sms(phone_number, sms_message)
```

---

## 💻 Usage

### Basic Usage in OTP Screen

The OTP screen has been updated to automatically use SMS Retriever. It will:

1. Start listening when the screen mounts
2. Auto-fill OTP when received
3. Auto-verify if all digits are filled
4. Stop listening when the screen unmounts

### Manual Usage with Hook

```typescript
import { useSmsRetriever } from '@/hooks/useSmsRetriever';

function MyOTPScreen() {
  const { start, stop, isActive } = useSmsRetriever({
    timeoutMs: 60000, // 60 seconds
    onOtpReceived: (otp) => {
      console.log('OTP received:', otp);
      // Auto-fill your OTP input
      setOtp(otp);
    },
    onTimeout: () => {
      console.log('SMS retrieval timed out');
    },
    onError: (error) => {
      console.error('SMS Retriever error:', error);
    },
    autoStart: true, // Start automatically
  });

  // Manual control
  const handleResend = async () => {
    await stop();
    // Resend OTP
    await sendOTP();
    // Restart listener
    await start();
  };

  return (
    // Your OTP UI
  );
}
```

### Using Service Directly

```typescript
import { smsRetrieverService } from '@/services/smsRetriever.service';

// Start listening
await smsRetrieverService.startSmsRetriever(60000);

// Add event listeners
const removeListeners = smsRetrieverService.addListeners({
  onSmsReceived: (data) => {
    console.log('OTP:', data.otp);
    console.log('Full message:', data.message);
  },
  onSmsTimeout: () => {
    console.log('Timeout');
  },
  onSmsError: (error) => {
    console.error('Error:', error.error);
  },
});

// Get app hash
const hash = await smsRetrieverService.getAppHash();
console.log('App Hash:', hash);

// Stop listening
await smsRetrieverService.stopSmsRetriever();
removeListeners();
```

---

## 🧪 Testing

### Step 1: Get Your App Hash

Run your app and get the hash:

```typescript
// Add this temporarily to your OTP screen or a test screen
useEffect(() => {
  smsRetrieverService.getAppHash().then(hash => {
    console.log('=== APP HASH ===');
    console.log(hash);
    console.log('===============');
    Alert.alert('App Hash', hash);
  });
}, []);
```

### Step 2: Send Test SMS

Send a test SMS to your device with the hash appended:

```
Your Tazty verification code is 1234. YOUR_11_CHAR_HASH
```

**Important:** Use the exact hash from your app's signing certificate.

### Step 3: Verify Auto-Read

1. Open your app on the device
2. Navigate to OTP screen
3. Send the test SMS
4. OTP should auto-fill within 1-2 seconds

### Testing Checklist

- [ ] App hash generated for debug keystore
- [ ] App hash generated for release keystore
- [ ] Backend configured with correct hash
- [ ] SMS format includes hash at the end
- [ ] OTP auto-fills when SMS received
- [ ] Timeout works after 60 seconds
- [ ] Manual entry still works if auto-read fails

---

## 🐛 Troubleshooting

### OTP Not Auto-Reading

#### 1. Check Hash Match

**Problem:** Hash in SMS doesn't match app's hash.

**Solution:**
- Verify hash using `getAppHash()` method
- Ensure backend uses the correct hash for the build type (debug vs release)
- Hash changes if you change keystore

#### 2. Check SMS Format

**Problem:** SMS format is incorrect.

**Solution:**
- Hash must be at the **end** of the message
- Must have a **space** before the hash
- Hash must be exactly **11 characters**
- Total message should be under 140 characters

#### 3. Check Google Play Services

**Problem:** Google Play Services not available or outdated.

**Solution:**
- Ensure device has Google Play Services installed
- Update Google Play Services from Play Store
- Test on a real device (not emulator without Play Services)

#### 4. Check Timeout

**Problem:** SMS received after timeout.

**Solution:**
- Default timeout is 60 seconds
- Increase timeout if SMS delivery is slow:
  ```typescript
  startSmsRetriever(90000); // 90 seconds
  ```

#### 5. Check Multiple SMS

**Problem:** Multiple SMS received, wrong one auto-read.

**Solution:**
- SMS Retriever reads the first matching SMS
- Ensure only one OTP SMS is sent
- Clear old SMS before testing

### Common Errors

#### Error: "SMS_RETRIEVER_ERROR"

**Cause:** Failed to start SMS Retriever.

**Solutions:**
- Check Google Play Services is installed
- Ensure device is connected to internet
- Restart the app

#### Error: "HASH_ERROR"

**Cause:** Failed to get app hash.

**Solutions:**
- Check app is properly signed
- Verify keystore is accessible
- Check package name matches

#### Error: "TIMEOUT_ERROR"

**Cause:** Failed to set timeout.

**Solutions:**
- Check timeout value is positive
- Ensure handler is available
- Restart the app

### Debug Logging

Enable debug logs in Android Studio:

```bash
# Filter logs for SMS Retriever
adb logcat | grep "SmsRetrieverModule"
```

Look for:
- "SMS Retriever started successfully"
- "SMS received: [message]"
- "Extracted OTP: [otp]"
- "SMS Retriever timeout"

---

## ✅ Best Practices

### 1. Hash Management

- **Store hashes securely** in your backend
- **Use different hashes** for debug and release builds
- **Update hashes** if you change keystore
- **Test both** debug and release builds

### 2. SMS Format

- **Keep messages short** (under 140 characters)
- **Use clear OTP format** (4-6 digits)
- **Include brand name** for user recognition
- **Test with real SMS** providers

### 3. Error Handling

- **Always provide fallback** for manual entry
- **Don't block UI** if SMS Retriever fails
- **Show helpful messages** if auto-read fails
- **Log errors** for debugging

### 4. User Experience

- **Auto-verify** when OTP is received (optional)
- **Show loading state** while waiting
- **Handle timeout gracefully**
- **Allow manual entry** as backup

### 5. Security

- **Never log full SMS** in production
- **Validate OTP** on backend
- **Set appropriate timeout**
- **Handle edge cases** (multiple SMS, invalid format)

### 6. Testing

- **Test on real devices** (not just emulators)
- **Test with different carriers**
- **Test timeout scenarios**
- **Test error scenarios**
- **Test with slow SMS delivery**

---

## 📚 Additional Resources

- [Google SMS Retriever API Documentation](https://developers.google.com/identity/sms-retriever/overview)
- [Android SMS Retriever Guide](https://developers.google.com/identity/sms-retriever/user-consent/overview)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-android)

---

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify hash matches between app and backend
3. Check Android logs for errors
4. Test with a simple SMS format first
5. Ensure Google Play Services is up to date

---

## 📝 Notes

- SMS Retriever API works only on **Android**
- Requires **Google Play Services**
- Works with **any SMS app** (not just default)
- **No permission** required
- **60-second timeout** by default
- Hash is **keystore-specific**

---

**Last Updated:** 2024
**Version:** 1.0.0

