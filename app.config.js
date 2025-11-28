module.exports = {
  expo: {
    name: "Tazty",
    slug: "Tazty",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./src/assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./src/assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#1a9656"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "in.tazty.buyer",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Tazty needs your location to show nearby restaurants and deliver food to your address.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Tazty needs your location to show nearby restaurants and deliver food to your address."
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
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
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
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: "7d65a380-eee0-49b0-9f39-a5cd6eaede5a"
      }
    },
    owner: "hitasoft"
  }
};
