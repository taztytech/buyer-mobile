# React Native Project Standards & Architecture Guide

## Table of Contents
1. [Project Structure](#project-structure)
2. [Naming Conventions](#naming-conventions)
3. [Component Architecture](#component-architecture)
4. [State Management](#state-management)
5. [Styling Guidelines](#styling-guidelines)
6. [API & Data Fetching](#api--data-fetching)
7. [Navigation](#navigation)
8. [TypeScript Standards](#typescript-standards)
9. [Code Quality & Linting](#code-quality--linting)
10. [Testing Strategy](#testing-strategy)
11. [Performance Best Practices](#performance-best-practices)
12. [Security Guidelines](#security-guidelines)
13. [Git Workflow](#git-workflow)
14. [Documentation Standards](#documentation-standards)

---

## Project Structure

```
my-app/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── common/              # Generic components (Button, Input, Card)
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.styles.ts
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── index.ts
│   │   │   └── ...
│   │   └── feature/             # Feature-specific components
│   │       └── UserCard/
│   ├── screens/                 # Screen/Page components
│   │   ├── Home/
│   │   ├── Profile/
│   │   └── Settings/
│   ├── navigation/              # Navigation configuration
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── types.ts
│   ├── services/                # External services & API
│   │   ├── api/
│   │   │   ├── client.ts        # Axios/fetch configuration
│   │   │   ├── endpoints.ts     # API endpoint constants
│   │   │   └── services/
│   │   │       ├── userService.ts
│   │   │       └── authService.ts
│   │   └── storage/             # AsyncStorage wrappers
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useDebounce.ts
│   │   └── useUser.ts
│   ├── utils/                   # Helper functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── helpers.ts
│   ├── constants/               # App constants
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   └── routes.ts
│   ├── types/                   # TypeScript definitions
│   │   ├── user.types.ts
│   │   ├── api.types.ts
│   │   └── navigation.types.ts
│   ├── store/                   # State management
│   │   ├── slices/              # Redux slices or Zustand stores
│   │   └── index.ts
│   ├── assets/                  # Static assets
│   │   ├── images/
│   │   ├── fonts/
│   │   └── icons/
│   └── theme/                   # Design system
│       ├── colors.ts
│       ├── typography.ts
│       ├── spacing.ts
│       └── index.ts
├── __tests__/                   # Test files
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Example env file
├── App.tsx                      # Root component
├── app.json                     # Expo configuration
└── package.json
```

---

## Naming Conventions

### Files & Folders

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Screens | PascalCase | `HomeScreen.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Hooks | camelCase with "use" | `useAuth.ts` |
| Constants | UPPER_SNAKE_CASE | `API_ENDPOINTS.ts` |
| Types | PascalCase with .types | `user.types.ts` |
| Tests | Same as source + .test | `Button.test.tsx` |

### Code Naming

```typescript
// Components: PascalCase
const UserProfile = () => {}
const CustomButton = () => {}

// Functions: camelCase
const fetchUserData = () => {}
const calculateTotal = () => {}

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = "https://api.example.com"
const MAX_RETRY_ATTEMPTS = 3

// Variables: camelCase
const userName = "John"
const isLoading = false

// Types/Interfaces: PascalCase
interface UserData {}
type AuthState = {}
enum UserRole {}

// Private/Internal: prefix with underscore
const _internalHelper = () => {}
```

### Boolean Naming
Always use prefixes for clarity:
- `is`: `isLoading`, `isVisible`, `isValid`
- `has`: `hasError`, `hasPermission`
- `can`: `canEdit`, `canDelete`
- `should`: `shouldUpdate`, `shouldRender`

---

## Component Architecture

### Component Structure

```typescript
// UserProfile.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// 1. Type definitions
interface UserProfileProps {
  userId: string;
  onPress?: () => void;
  testID?: string;
}

// 2. Component definition
export const UserProfile: React.FC<UserProfileProps> = ({ 
  userId, 
  onPress,
  testID = 'user-profile' 
}) => {
  // 3. Hooks (in order)
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  // 4. Derived state with useMemo
  const displayName = useMemo(() => {
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  }, [user]);
  
  // 5. useEffect hooks
  useEffect(() => {
    fetchUserData();
  }, [userId]);
  
  // 6. Event handlers with useCallback
  const handlePress = useCallback(() => {
    onPress?.();
    navigation.navigate('UserDetails', { userId });
  }, [onPress, navigation, userId]);
  
  // 7. Helper functions
  const fetchUserData = async () => {
    setLoading(true);
    try {
      const data = await userService.getUser(userId);
      setUser(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 8. Early returns
  if (loading) {
    return <LoadingSpinner testID={`${testID}-loading`} />;
  }
  
  if (!user) {
    return <ErrorMessage testID={`${testID}-error`} />;
  }
  
  // 9. Main render
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.name}>{displayName}</Text>
      <TouchableOpacity onPress={handlePress} style={styles.button}>
        <Text style={styles.buttonText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

// 10. Styles at bottom
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Smart vs Presentational Components

**Container (Smart) Component:**
```typescript
// UserProfileContainer.tsx
export const UserProfileContainer = () => {
  const { data, loading, error } = useUser();
  const { updateUser } = useUserActions();
  
  const handleUpdate = async (updates: Partial<User>) => {
    await updateUser(updates);
  };
  
  return (
    <UserProfileView 
      user={data}
      loading={loading}
      error={error}
      onUpdate={handleUpdate}
    />
  );
};
```

**Presentational Component:**
```typescript
// UserProfileView.tsx
interface UserProfileViewProps {
  user: User | null;
  loading: boolean;
  error: Error | null;
  onUpdate: (updates: Partial<User>) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  loading,
  error,
  onUpdate,
}) => {
  // Only UI logic, no business logic
  return (
    <View>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error.message} />}
      {user && <UserInfo user={user} onUpdate={onUpdate} />}
    </View>
  );
};
```

---

## State Management

### Selection Guide

| App Size | Recommended Solution | Use Case |
|----------|---------------------|----------|
| Small | Context API + useReducer | Simple apps, few shared states |
| Medium | Zustand | Growing apps, need simplicity |
| Large | Redux Toolkit | Complex apps, extensive state |

### Zustand Example (Recommended)

```typescript
// store/userStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setUser: (user) => set({ user, isAuthenticated: true }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Usage in component
const UserProfile = () => {
  const { user, logout } = useUserStore();
  
  return (
    <View>
      <Text>{user?.name}</Text>
      <Button onPress={logout} title="Logout" />
    </View>
  );
};
```

### Redux Toolkit Example

```typescript
// store/slices/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  loading: false,
  error: null,
};

export const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async (userId: string) => {
    const response = await userService.getUser(userId);
    return response.data;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUser: (state) => {
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch user';
      });
  },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
```

---

## Styling Guidelines

### Theme System

```typescript
// theme/colors.ts
export const colors = {
  // Primary colors
  primary: '#007AFF',
  primaryDark: '#0051D5',
  primaryLight: '#4DA2FF',
  
  // Secondary colors
  secondary: '#5856D6',
  secondaryDark: '#3C3BA4',
  secondaryLight: '#7A79E8',
  
  // Neutral colors
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',
  
  // Status colors
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',
  
  // Grayscale
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F5F5F5',
  gray200: '#E0E0E0',
  gray300: '#BDBDBD',
  gray400: '#9E9E9E',
  gray500: '#757575',
  gray600: '#616161',
  gray700: '#424242',
  gray800: '#212121',
} as const;

// theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// theme/typography.ts
export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    lineHeight: 16,
  },
} as const;

// theme/index.ts
export const theme = {
  colors,
  spacing,
  typography,
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
  },
} as const;
```

### StyleSheet Best Practices

```typescript
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

// ✅ Good: Use theme constants
const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
});

// ❌ Bad: Hardcoded values
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
});
```

### Responsive Design

```typescript
// utils/responsive.ts
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const wp = (percentage: number) => {
  return (SCREEN_WIDTH * percentage) / 100;
};

export const hp = (percentage: number) => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

export const normalize = (size: number) => {
  const scale = SCREEN_WIDTH / 375; // iPhone 11 base
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Usage
const styles = StyleSheet.create({
  container: {
    width: wp(90), // 90% of screen width
    height: hp(50), // 50% of screen height
  },
  text: {
    fontSize: normalize(16), // Scales with screen size
  },
});
```

---

## API & Data Fetching

### Axios Configuration

```typescript
// services/api/client.ts
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      await AsyncStorage.removeItem('auth_token');
      // Navigate to login
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Service Layer

```typescript
// services/api/services/userService.ts
import apiClient from '../client';
import { User, UpdateUserRequest } from '@/types/user.types';

export const userService = {
  getUser: async (userId: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${userId}`);
    return response.data;
  },
  
  updateUser: async (userId: string, data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${userId}`, data);
    return response.data;
  },
  
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`);
  },
};
```

### React Query Integration (Recommended)

```typescript
// hooks/useUser.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/api/services/userService';

export const useUser = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserRequest }) =>
      userService.updateUser(userId, data),
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['user', data.id] });
    },
  });
};

// Usage in component
const UserProfile = ({ userId }: { userId: string }) => {
  const { data: user, isLoading, error } = useUser(userId);
  const updateUser = useUpdateUser();
  
  const handleUpdate = () => {
    updateUser.mutate({ 
      userId, 
      data: { name: 'New Name' } 
    });
  };
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <UserInfo user={user} onUpdate={handleUpdate} />;
};
```

---

## Navigation

### React Navigation Setup

```typescript
// navigation/types.ts
export type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Settings: undefined;
  UserDetails: { userId: string; tab?: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

```typescript
// navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUserStore } from '@/store/userStore';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  
  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator 
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};
```

### Type-Safe Navigation

```typescript
// screens/Profile/ProfileScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params; // Type-safe
  
  const navigateToDetails = () => {
    navigation.navigate('UserDetails', { userId, tab: 'posts' }); // Type-safe
  };
  
  return <View>...</View>;
};
```

---

## TypeScript Standards

### Type Definitions

```typescript
// types/user.types.ts

// Use interfaces for object shapes
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Use types for unions, intersections
export type UserRole = 'admin' | 'user' | 'guest';
export type UserStatus = 'active' | 'inactive' | 'suspended';

// API request/response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

// Utility types
export type PartialUser = Partial<User>;
export type RequiredUser = Required<User>;
export type UserWithoutDates = Omit<User, 'createdAt' | 'updatedAt'>;
export type UserCredentials = Pick<User, 'email'>;
```

### Type Guards

```typescript
// utils/typeGuards.ts
export const isUser = (value: unknown): value is User => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as User).id === 'string'
  );
};

// Usage
const data = await fetchUser();
if (isUser(data)) {
  console.log(data.email); // Type-safe
}
```

### Strict TypeScript Config

```json
// tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Code Quality & Linting

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'expo',
    'prettier',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['prettier', '@typescript-eslint', 'react-hooks'],
  rules: {
    'prettier/prettier': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Husky + Lint-Staged

```json
// package.json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

---

## Testing Strategy

### Unit Testing with Jest

```typescript
// components/Button/__tests__/Button.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Click Me" />);
    expect(getByText('Click Me')).toBeTruthy();
  });
  
  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPressMock} />
    );
    
    fireEvent.press(getByText('Click Me'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
  
  it('is disabled when loading', () => {
    const { getByTestId } = render(
      <Button title="Submit" loading testID="submit-button" />
    );
    
    const button = getByTestId('submit-button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });
});
```

### Hook Testing

```typescript
// hooks/__tests__/useAuth.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '../useAuth';

describe('useAuth', () => {
  it('logs in successfully', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeDefined();
  });
});
```

### Integration Testing

```typescript
// screens/__tests__/LoginScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';
import * as authService from '@/services/api/services/authService';

jest.mock('@/services/api/services/authService');

describe('LoginScreen', () => {
  it('handles successful login', async () => {
    const mockLogin = authService.login as jest.MockedFunction<typeof authService.login>;
    mockLogin.mockResolvedValue({ token: 'test-token', user: { id: '1' } });
    
    const { getByTestId, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password');
    fireEvent.press(getByText('Login'));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password');
    });
  });
});
```

---

## Performance Best Practices

### Memoization

```typescript
// ✅ Good: Memoize expensive computations
const ExpensiveComponent = ({ data }: { data: number[] }) => {
  const sortedData = useMemo(() => {
    return data.sort((a, b) => a - b);
  }, [data]);
  
  const handlePress = useCallback(() => {
    console.log('Pressed');
  }, []);
  
  return <List data={sortedData} onPress={handlePress} />;
};

// ✅ Good: Memoize components
export const UserCard = React.memo<UserCardProps>(({ user }) => {
  return <View>...</View>;
}, (prevProps, nextProps) => {
  return prevProps.user.id === nextProps.user.id;
});
```

### FlatList Optimization

```typescript
const UserList = ({ users }: { users: User[] }) => {
  const renderItem = useCallback(({ item }: { item: User }) => {
    return <UserCard user={item} />;
  }, []);
  
  const keyExtractor = useCallback((item: User) => item.id, []);
  
  const getItemLayout = useCallback(
    (data: User[] | null | undefined, index: number) => ({
      length: 80, // Fixed item height
      offset: 80 * index,
      index,
    }),
    []
  );
  
  return (
    <FlatList
      data={users}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews={true}
      initialNumToRender={10}
    />
  );
};
```

### Image Optimization

```typescript
import { Image } from 'expo-image';

// ✅ Good: Use expo-image with caching
<Image
  source={{ uri: user.avatar }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
  style={{ width: 100, height: 100 }}
/>

// ✅ Good: Use appropriate sizes
<Image
  source={{ 
    uri: user.avatar,
    width: 100,
    height: 100,
  }}
/>
```

---

## Security Guidelines

### Secure Storage

```typescript
// services/storage/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  save: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  
  get: async (key: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(key);
  },
  
  remove: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

// Usage
await secureStorage.save('auth_token', token);
const token = await secureStorage.get('auth_token');
```

### Environment Variables

```typescript
// constants/config.ts
import Constants from 'expo-constants';

interface Config {
  apiUrl: string;
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
}

export const config: Config = {
  apiUrl: Constants.expoConfig?.extra?.apiUrl || 'https://api.example.com',
  apiKey: Constants.expoConfig?.extra?.apiKey || '',
  environment: Constants.expoConfig?.extra?.environment || 'development',
};

// app.json
{
  "expo": {
    "extra": {
      "apiUrl": process.env.API_URL,
      "apiKey": process.env.API_KEY,
      "environment": process.env.ENVIRONMENT
    }
  }
}
```

### Input Validation

```typescript
// utils/validators.ts
export const validators = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },
  
  password: (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain uppercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain a number' };
    }
    return { valid: true };
  },
  
  phone: (phone: string): boolean => {
    const regex = /^\+?[1-9]\d{1,14}$/;
    return regex.test(phone);
  },
};
```

---

## Git Workflow

### Branch Naming

```
main/master          # Production-ready code
develop              # Development branch
feature/user-auth    # New features
bugfix/login-crash   # Bug fixes
hotfix/payment-fail  # Production hotfixes
release/v1.2.0       # Release preparation
```

### Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add biometric authentication

Implemented Face ID and Touch ID support for iOS
and fingerprint authentication for Android.

Closes #123
```

```
fix(profile): resolve avatar upload crash

Fixed issue where large images caused app to crash
during avatar upload by adding image compression.

Fixes #456
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots
<!-- Add screenshots if applicable -->

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
```

---

## Documentation Standards

### Component Documentation

```typescript
/**
 * Button component with loading and disabled states
 * 
 * @component
 * @example
 * ```tsx
 * <Button 
 *   title="Submit" 
 *   onPress={handleSubmit}
 *   loading={isLoading}
 *   variant="primary"
 * />
 * ```
 */
interface ButtonProps {
  /** Button text */
  title: string;
  /** Called when button is pressed */
  onPress: () => void;
  /** Shows loading spinner when true */
  loading?: boolean;
  /** Disables button when true */
  disabled?: boolean;
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Test identifier */
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({ ... }) => {
  // Implementation
};
```

### README Structure

```markdown
# Project Name

Brief description of the project

## Features
- Feature 1
- Feature 2
- Feature 3

## Prerequisites
- Node.js >= 18
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator

## Installation
\`\`\`bash
npm install
\`\`\`

## Configuration
1. Copy `.env.example` to `.env`
2. Add your API keys
3. Configure app.json

## Running the App
\`\`\`bash
npm start
npm run ios
npm run android
\`\`\`

## Testing
\`\`\`bash
npm test
npm run test:watch
npm run test:coverage
\`\`\`

## Build
\`\`\`bash
npm run build:ios
npm run build:android
\`\`\`

## Project Structure
See ARCHITECTURE.md

## Contributing
See CONTRIBUTING.md

## License
MIT
```

---

## Quick Reference Checklist

### Before Committing
- [ ] Code is formatted (Prettier)
- [ ] No ESLint errors
- [ ] Tests pass
- [ ] TypeScript compiles without errors
- [ ] No console.logs (except console.warn/error)
- [ ] Component has testID props
- [ ] Styles use theme constants
- [ ] API calls have error handling

### Before Creating PR
- [ ] Branch is up to date with develop
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Screenshots added (if UI changes)
- [ ] No merge conflicts
- [ ] Commit messages follow convention

### Code Review Checklist
- [ ] Code is readable and maintainable
- [ ] Follows project architecture
- [ ] No duplicated code
- [ ] Proper error handling
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Accessibility considerations (testID, labels)

---

## Useful Commands

```bash
# Development
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run web                  # Run on web browser

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint errors
npm run format               # Format with Prettier
npm run type-check           # TypeScript type checking

# Testing
npm test                     # Run tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Generate coverage report

# Build
npm run build:ios            # Build iOS app
npm run build:android        # Build Android app
eas build --platform all     # Build with EAS

# Clean
rm -rf node_modules          # Remove node_modules
npm install                  # Reinstall dependencies
npx expo start --clear       # Clear cache and start
```

---

## Additional Resources

### Official Documentation
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript](https://www.typescriptlang.org/docs/)

### Recommended Libraries
- **State Management:** Zustand, Redux Toolkit
- **Data Fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form
- **UI Components:** React Native Paper, NativeBase
- **Icons:** @expo/vector-icons
- **Animation:** React Native Reanimated
- **Date/Time:** date-fns
- **Validation:** Zod, Yup

### Community
- [React Native Community](https://github.com/react-native-community)
- [Expo Forums](https://forums.expo.dev/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native)

---

**Last Updated:** October 2025
**Version:** 1.0.0
