# Environment-Specific API Configuration

This document explains how environment-specific API configuration works in the Tazty Buyer App.

## Overview

The app uses different API base URLs based on the build environment:
- **Development**: `https://devapi.tazty.in`
- **Production**: `https://prodapi.tazty.in`

The configuration is automatically set during EAS Build based on the build profile.

## Configuration Files

### 1. `app.config.js`
This file detects the EAS build profile and sets the appropriate API URL in the `extra` field, which is accessible via `expo-constants`.

### 2. `eas.json`
Defines build profiles (`development`, `preview`, `production`) with environment variables for each profile.

### 3. `src/config/environment.config.ts`
Centralized environment configuration that reads from Expo Constants and provides a clean API for accessing environment-specific values throughout the app.

## Usage Examples

### Accessing API Base URL

#### Option 1: Using Environment Config (Recommended)
```typescript
import { getApiBaseUrl, envConfig } from '@/config/environment.config';

// Get API base URL
const apiUrl = getApiBaseUrl();
// Returns: 'https://devapi.tazty.in' (development) or 'https://prodapi.tazty.in' (production)

// Access full config
console.log(envConfig.apiBaseUrl);
console.log(envConfig.environment);
```

#### Option 2: Using API Config (For API endpoints)
```typescript
import { API_CONFIG, buildApiUrl } from '@/config/api.config';

// Use BASE_URL directly
const baseUrl = API_CONFIG.BASE_URL;

// Build full URL for an endpoint
const fullUrl = buildApiUrl('/api/buyer/home');
// Returns: 'https://devapi.tazty.in/api/buyer/home' (or production URL)
```

#### Option 3: Using API Service (Recommended for API calls)
```typescript
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/config/api.config';

// The API service automatically uses the correct base URL
const response = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.HOME);
// Internally uses: https://devapi.tazty.in/api/buyer/home (or production)
```

### Checking Environment

```typescript
import { 
  isDevelopment, 
  isProduction, 
  isPreview,
  getEnvironment 
} from '@/config/environment.config';

// Check environment
if (isDevelopment()) {
  console.log('Running in development mode');
}

if (isProduction()) {
  console.log('Running in production mode');
}

// Get current environment name
const env = getEnvironment(); // 'development' | 'preview' | 'production'
```

### Example: API Service File

```typescript
/**
 * Example API Service
 */
import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import { envConfig } from '@/config/environment.config';

class ExampleService {
  /**
   * Fetch data from API
   * The API service automatically uses the correct base URL based on build profile
   */
  async fetchData(): Promise<any> {
    try {
      // Use API_CONFIG.ENDPOINTS for endpoint paths
      const response = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.HOME);
      
      if (response.success) {
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to fetch data');
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Example: Conditional logic based on environment
   */
  async sendAnalytics(event: string, data: any): Promise<void> {
    // Only send analytics in production
    if (envConfig.isProduction) {
      await apiService.post('/analytics/events', { event, data });
    } else {
      console.log('[Analytics]', event, data);
    }
  }
}

export const exampleService = new ExampleService();
```

### Example: Using in Components

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { envConfig } from '@/config/environment.config';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/config/api.config';

export const ExampleComponent: React.FC = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      // API service automatically uses correct base URL
      const response = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.HOME);
      if (response.success) {
        setData(response.data);
      }
    };

    fetchData();
  }, []);

  return (
    <View>
      <Text>Environment: {envConfig.environment}</Text>
      <Text>API URL: {envConfig.apiBaseUrl}</Text>
      {/* Component content */}
    </View>
  );
};
```

## Building with Different Profiles

### Development Build
```bash
# Build with development profile (uses devapi.tazty.in)
eas build --profile development --platform android
eas build --profile development --platform ios
```

### Production Build
```bash
# Build with production profile (uses prodapi.tazty.in)
eas build --profile production --platform android
eas build --profile production --platform ios
```

### Preview Build
```bash
# Build with preview profile (uses devapi.tazty.in by default)
eas build --profile preview --platform android
```

## Local Development

When running locally with `expo start` or `expo run:android`/`expo run:ios`:
- The app defaults to **development** environment
- Uses `https://devapi.tazty.in` as the API base URL
- You can override by setting `EXPO_PUBLIC_API_BASE_URL` environment variable

### Override for Local Development
```bash
# Set environment variable before running
export EXPO_PUBLIC_API_BASE_URL=https://custom-api.example.com
expo start
```

Or create a `.env` file (if using dotenv):
```
EXPO_PUBLIC_API_BASE_URL=https://custom-api.example.com
```

## Adding New Environment Variables

To add new environment-specific variables:

1. **Update `app.config.js`**:
```javascript
const apiConfig = getApiConfig();

module.exports = {
  expo: {
    // ... other config
    extra: {
      apiBaseUrl: apiConfig.apiBaseUrl,
      environment: apiConfig.environment,
      // Add your new variable here
      myNewVariable: process.env.MY_NEW_VAR || 'default-value',
    },
  },
};
```

2. **Update `eas.json`** (if needed for build-time):
```json
{
  "build": {
    "development": {
      "env": {
        "MY_NEW_VAR": "dev-value"
      }
    },
    "production": {
      "env": {
        "MY_NEW_VAR": "prod-value"
      }
    }
  }
}
```

3. **Access in code**:
```typescript
import Constants from 'expo-constants';

const myVar = Constants.expoConfig?.extra?.myNewVariable;
```

## TypeScript Types

The environment configuration includes full TypeScript support:

```typescript
import { Environment, EnvironmentConfig } from '@/config/environment.config';

// Type-safe environment values
const env: Environment = 'development' | 'preview' | 'production';

// Full config interface
const config: EnvironmentConfig = {
  environment: 'development',
  apiBaseUrl: 'https://devapi.tazty.in',
  isDevelopment: true,
  isProduction: false,
  isPreview: false,
};
```

## Troubleshooting

### API URL is incorrect
1. Check that you're using the correct build profile: `eas build --profile <profile>`
2. Verify `eas.json` has the correct environment variables for your profile
3. Check `app.config.js` is correctly reading the build profile
4. Ensure you're accessing the config via `expo-constants` (not `process.env` directly)

### Environment not detected
- The app defaults to `development` if no build profile is detected
- For local development, this is expected behavior
- For EAS builds, ensure `EXPO_PUBLIC_EAS_BUILD_PROFILE` is set in `eas.json`

## Summary

- ✅ Environment-specific API URLs configured
- ✅ EAS Build profiles set up for `@development` and `@production`
- ✅ Centralized configuration accessible throughout the app
- ✅ TypeScript types included
- ✅ Easy to extend for future environment variables

The API URL is automatically set based on the build profile, so you don't need to manually change anything when building for different environments.

