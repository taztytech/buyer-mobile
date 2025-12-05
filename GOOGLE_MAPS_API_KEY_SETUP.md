# Google Maps API Key Setup

## Issue Fixed
The app was showing an error: "API key not found" for Google Maps.

## Solution Implemented

### 1. Added Meta-Data to AndroidManifest.xml
Added the Google Maps API key meta-data tag:
```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="${GOOGLE_MAPS_API_KEY}"/>
```

### 2. Configured build.gradle
Updated `android/app/build.gradle` to inject the API key from:
- `gradle.properties` (GOOGLE_MAPS_API_KEY property)
- Environment variable (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`)

### 3. Setup Instructions

#### Option 1: Add to gradle.properties (Recommended)
1. Open `android/gradle.properties`
2. Uncomment and set the API key:
   ```properties
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

#### Option 2: Set Environment Variable
Set the environment variable before building:
```bash
# Windows PowerShell
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="your_actual_api_key_here"

# Windows CMD
set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here

# Linux/Mac
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

#### Option 3: Use .env file (if using dotenv)
Add to your `.env.dev` or `.env.prod` file:
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

## Getting Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials)
2. Select your project (or create a new one)
3. Click "Create Credentials" → "API Key"
4. Copy the API key
5. (Recommended) Restrict the API key to:
   - Application restrictions: Android apps
   - API restrictions: Maps SDK for Android

## Important Notes

- ⚠️ **Never commit your API key to version control!**
- Add `android/gradle.properties` to `.gitignore` if you store the key there
- Use environment variables or secure secret management for CI/CD
- The API key in `app.config.js` is for Expo's build process, but for bare workflow, you need to set it in `gradle.properties` or as an environment variable

## Verification

After setting the API key, rebuild the app:
```bash
npm run android:dev
```

The Google Maps error should be resolved.

