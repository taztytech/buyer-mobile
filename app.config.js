/**
 * Expo App Configuration
 * Environment-specific configuration based on EAS Build profiles
 */

// Load environment file if ENV_FILE is set (for local development)
if (process.env.ENV_FILE) {
  const path = require('path');
  const fs = require('fs');
  const envFile = path.resolve(process.cwd(), process.env.ENV_FILE);
  
  if (fs.existsSync(envFile)) {
    const result = require('dotenv').config({ path: envFile });
    if (result.error) {
      console.warn(`⚠️  Error loading environment file: ${result.error}`);
    } else {
      console.log(`✅ Loaded environment file: ${envFile}`);
      console.log(`   EXPO_PUBLIC_API_BASE_URL: ${process.env.EXPO_PUBLIC_API_BASE_URL || 'not set'}`);
    }
  } else {
    console.warn(`⚠️  Environment file not found: ${envFile}`);
  }
}

// Determine the build environment from EAS build profile
const getBuildEnvironment = () => {
  // EAS Build sets EXPO_PUBLIC_EAS_BUILD_PROFILE during build
  const buildProfile = process.env.EXPO_PUBLIC_EAS_BUILD_PROFILE || process.env.EAS_BUILD_PROFILE;
  
  // Check if ENV_FILE is set (for local development with .env files)
  if (process.env.ENV_FILE) {
    if (process.env.ENV_FILE.includes('.env.dev')) {
      return 'development';
    } else if (process.env.ENV_FILE.includes('.env.prod')) {
      return 'production';
    }
  }
  
  // Fallback to NODE_ENV for local development
  if (!buildProfile) {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
  }
  
  return buildProfile;
};

// Environment-specific API configuration
const getApiConfig = () => {
  const environment = getBuildEnvironment();
  
  // Allow override from .env file or environment variable
  // Priority: EXPO_PUBLIC_API_BASE_URL from .env > default for environment
  const apiBaseUrlOverride = process.env.EXPO_PUBLIC_API_BASE_URL;
  
  const configs = {
    development: {
      apiBaseUrl: apiBaseUrlOverride || 'https://devapi.tazty.in',
      environment: 'development',
    },
    production: {
      apiBaseUrl: apiBaseUrlOverride || 'https://prodapi.tazty.in',
      environment: 'production',
    },
    preview: {
      // Preview builds can use development API or a staging API
      apiBaseUrl: apiBaseUrlOverride || 'https://devapi.tazty.in',
      environment: 'preview',
    },
  };
  
  const config = configs[environment] || configs.development;
  
  // Log the configuration being used
  console.log(`📦 Environment: ${config.environment}`);
  console.log(`🌐 API Base URL: ${config.apiBaseUrl}`);
  if (apiBaseUrlOverride) {
    console.log(`   (from EXPO_PUBLIC_API_BASE_URL in .env file)`);
  }
  
  return config;
};

const apiConfig = getApiConfig();

// module.exports = {
//   expo: {
//     name: "Tazty",
//     slug: "Tazty",
//     version: "1.0.0",
//     orientation: "portrait",
//     icon: "./src/assets/icon.png",
//     userInterfaceStyle: "light",
//     newArchEnabled: true,
//     splash: {
//       image: "./src/assets/splash.png",
//       resizeMode: "cover",
//       backgroundColor: "#1a9656"
//     },
//     ios: {
//       supportsTablet: true,
//       bundleIdentifier: "in.tazty.buyer",
//       infoPlist: {
//         NSLocationWhenInUseUsageDescription: "Tazty needs your location to show nearby restaurants and deliver food to your address.",
//         NSLocationAlwaysAndWhenInUseUsageDescription: "Tazty needs your location to show nearby restaurants and deliver food to your address."
//       },
//       config: {
//         googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
//       }
//     },
//     android: {
//       adaptiveIcon: {
//         foregroundImage: "./src/assets/adaptive-icon.png",
//         backgroundColor: "#ffffff"
//       },
//       edgeToEdgeEnabled: true,
//       predictiveBackGestureEnabled: false,
//       package: "in.tazty.buyer",
//       permissions: [
//         "ACCESS_COARSE_LOCATION",
//         "ACCESS_FINE_LOCATION"
//       ],
//       config: {
//         googleMaps: {
//           apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
//         }
//       }
//     },
//     web: {
//       favicon: "./src/assets/favicon.png"
//     },
//     extra: {
//       // API Configuration
//       apiBaseUrl: apiConfig.apiBaseUrl,
//       environment: apiConfig.environment,
      
//       // Expose EXPO_PUBLIC_API_BASE_URL for runtime access via expo-constants
//       EXPO_PUBLIC_API_BASE_URL: apiConfig.apiBaseUrl,
      
//       // Google Maps API Key
//       EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      
//       // EAS Configuration
//       eas: {
//         projectId: "7d65a380-eee0-49b0-9f39-a5cd6eaede5a"
//       }
//     },
//     owner: "hitasoft"
//   }
// };


module.exports = {
  expo: {
    name: "Tazty",
    slug: "Tazty",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./src/assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./src/assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#1a9656"
    },

    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      "@react-native-firebase/crashlytics"
    ],

    ios: {
      supportsTablet: true,
      bundleIdentifier: "in.tazty.buyer",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Tazty needs your location to show nearby restaurants and deliver food to your address.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Tazty needs your location to show nearby restaurants and deliver food to your address.",
        // For notifications
        FirebaseAppDelegateForwarderEnabled: true
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./src/assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "in.tazty.buyer",

      // 👇 your FCM google-services.json path
      googleServicesFile: "./android/app/google-services.json",

      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        // notifications (Android 13+)
        "android.permission.POST_NOTIFICATIONS"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    web: {
      favicon: "./src/assets/favicon.png"
    },
    extra: {
      apiBaseUrl: apiConfig.apiBaseUrl,
      environment: apiConfig.environment,
      EXPO_PUBLIC_API_BASE_URL: apiConfig.apiBaseUrl,
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: "7d65a380-eee0-49b0-9f39-a5cd6eaede5a"
      }
    },
    owner: "hitasoft"
  }
};
