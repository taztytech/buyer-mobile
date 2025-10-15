# Tazty - Food Delivery App

A modern React Native food delivery application built with Expo and TypeScript.

## Features

- Clean and maintainable code architecture
- TypeScript for type safety
- Custom splash screen with branding
- Theme system with consistent design tokens
- Modular project structure following industry best practices

## Prerequisites

- Node.js >= 18
- npm or yarn
- Expo CLI
- iOS Simulator (macOS only) or Android Emulator

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update your environment variables in `.env`

## Running the App

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Project Structure

```
Tazty/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Generic components
│   │   └── feature/       # Feature-specific components
│   ├── screens/           # Screen components
│   ├── navigation/        # Navigation configuration
│   ├── services/          # API services & storage
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Helper functions
│   ├── constants/         # App constants & config
│   ├── types/             # TypeScript type definitions
│   ├── store/             # State management
│   ├── assets/            # Images, fonts, icons
│   └── theme/             # Design system (colors, spacing, typography)
├── App.tsx                # Root component
├── app.json               # Expo configuration
└── package.json           # Dependencies
```

## Code Quality

### Linting

```bash
npm run lint          # Check for lint errors
npm run lint:fix      # Auto-fix lint errors
```

### Formatting

```bash
npm run format        # Format code with Prettier
```

### Type Checking

```bash
npm run type-check    # Run TypeScript type checking
```

## Building for Production

### iOS

```bash
npm run build:ios
# or with EAS
eas build --platform ios
```

### Android

```bash
npm run build:android
# or with EAS
eas build --platform android
```

## Development Guidelines

This project follows the standards outlined in `REACT_NATIVE_STANDARDS.md`. Please review before contributing.

### Key Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Files**: camelCase for utilities (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Import Aliases**: Use `@/` prefix (`@/theme`, `@/components`)

### Theme Usage

```typescript
import { colors, spacing, typography } from '@/theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.primary,
  },
  title: {
    ...typography.h1,
    color: colors.white,
  },
});
```

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Ready for React Navigation
- **State Management**: Ready for Zustand/Redux Toolkit
- **Code Quality**: ESLint + Prettier
- **Path Aliases**: Babel Module Resolver

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Backend API URL | `https://api.tazty.com` |
| `API_KEY` | API Key | - |
| `ENVIRONMENT` | Current environment | `development` |

## License

MIT

## Support

For issues and questions, please create an issue in the project repository.

---

**Version**: 1.0.0
**Last Updated**: October 2025
