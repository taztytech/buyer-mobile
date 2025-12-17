# SMS Retriever API - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### 1. Get Your App Hash

**Option A: Using the App (Easiest)**

Add this to your OTP screen temporarily:

```typescript
import { smsRetrieverService } from '@/services/smsRetriever.service';

useEffect(() => {
  smsRetrieverService.getAppHash().then(hash => {
    console.log('APP HASH:', hash);
    Alert.alert('App Hash', hash);
  });
}, []);
```

**Option B: Using Keytool**

```bash
# Debug keystore
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release keystore
keytool -list -v -keystore android/app/my-release-key.keystore -alias my-key-alias
```

Extract SHA-256, convert to Base64, take first 11 characters.

### 2. Update Backend SMS Format

Your backend must append the hash to SMS messages:

```
Your Tazty verification code is 1234. ABC123XYZ45
                                      ^^^^^^^^^^^
                                      11-char hash
```

### 3. Test It!

1. Build and run your app
2. Navigate to OTP screen
3. Send test SMS with hash appended
4. OTP should auto-fill! 🎉

---

## 📋 Example SMS Formats

### ✅ Correct
```
Your code is 1234. ABC123XYZ45
OTP: 5678. ABC123XYZ45
1234 is your verification code. ABC123XYZ45
```

### ❌ Wrong
```
ABC123XYZ45 Your code is 1234  // Hash must be at end
Your code is 1234ABC123XYZ45   // Missing space
Your code is 1234.             // Missing hash
```

---

## 🔍 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| OTP not auto-reading | Check hash matches between app and SMS |
| Hash error | Verify keystore is accessible |
| Timeout | SMS took >60 seconds, increase timeout or resend |
| No Google Play Services | Install/update from Play Store |

---

## 📱 Current Implementation

The OTP screen (`OTPVerificationScreen.tsx`) is already integrated with SMS Retriever:

- ✅ Auto-starts when screen opens
- ✅ Auto-fills OTP when received
- ✅ Auto-verifies if all digits filled
- ✅ Stops when screen closes
- ✅ Restarts on resend

**No additional code needed!** Just ensure your backend sends SMS with the hash.

---

## 🎯 Next Steps

1. Get hash for **debug** build → Give to backend team
2. Get hash for **release** build → Give to backend team
3. Backend updates SMS format → Test with real SMS
4. Deploy! 🚀

---

For detailed documentation, see `SMS_RETRIEVER_SETUP.md`

