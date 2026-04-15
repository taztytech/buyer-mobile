# Tazty App - Coding Standards

## Font Usage Standards

### Font Family Naming Convention

**✅ CORRECT:** Use base font family name with `fontWeight` parameter
```typescript
const styles = StyleSheet.create({
  text: {
    fontFamily: 'Poppins',
    fontWeight: '700', // For Bold
  },
});
```

**❌ INCORRECT:** Using variant-specific font family names
```typescript
const styles = StyleSheet.create({
  text: {
    fontFamily: 'Poppins_700Bold', // Don't do this
  },
});
```

### Font Weight Mapping

When using Poppins font family, use these fontWeight values:

- **400** - Regular (Poppins_400Regular)
- **500** - Medium (Poppins_500Medium)
- **600** - SemiBold (Poppins_600SemiBold)
- **700** - Bold (Poppins_700Bold)

### Example Implementations

```typescript
// Regular text
textRegular: {
  fontFamily: 'Poppins',
  fontWeight: '400',
  fontSize: 14,
}

// Medium text
textMedium: {
  fontFamily: 'Poppins',
  fontWeight: '500',
  fontSize: 16,
}

// SemiBold text
textSemiBold: {
  fontFamily: 'Poppins',
  fontWeight: '600',
  fontSize: 18,
}

// Bold text
textBold: {
  fontFamily: 'Poppins',
  fontWeight: '700',
  fontSize: 20,
}
```

## CSS to React Native Conversion Standards

### Line Height
- Convert percentage line-height to actual pixel values
- **Example:** If `font-size: 16px` and `line-height: 100%`, then `lineHeight: 16`

### Letter Spacing
- Always include letterSpacing even if 0
- **Example:** `letterSpacing: 0`

### Opacity
- Use decimal values (0.85, 0.5, etc.)
- Apply opacity for transparency effects

## Code Quality Standards

### Console Logging
- ❌ Remove all `console.log` statements from production code
- ✅ Keep only `console.error` for error handling
- ✅ Use proper error tracking in production

### Performance Optimization
- ✅ Use `React.useCallback` for render functions in lists/carousels
- ✅ Use `React.useMemo` for expensive calculations
- ✅ Add proper memoization for components rendered in loops

### Testing & Accessibility
- ✅ Always add `testID` props to all interactive elements
- ✅ Add `testID` to major UI sections for testing
- ✅ Use descriptive testID names (e.g., `carousel-slide-${id}`, `veg-mode-toggle`)

### Code Organization
- ✅ Keep components modular and focused
- ✅ Extract reusable patterns
- ✅ Use TypeScript strict typing
- ✅ Document interfaces and types

## Modal Implementation Standards

### Modal Structure
```typescript
<Modal
  visible={showModal}
  transparent={true}
  animationType="fade"
  onRequestClose={() => setShowModal(false)}
>
  <TouchableOpacity
    style={styles.modalOverlay}
    activeOpacity={1}
    onPress={() => setShowModal(false)}
  >
    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
      <View style={styles.modalContent}>
        {/* Modal content here */}
      </View>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>
```

### Modal Styling
- Use semi-transparent overlay: `backgroundColor: 'rgba(0, 0, 0, 0.5)'`
- Center content with `justifyContent: 'center'` and `alignItems: 'center'`
- Use proper border radius for modern look
- Dismiss on outside tap using nested TouchableOpacity pattern

## State Management

### Temporary State for Modals
- Use temporary state for selections before applying
- **Example:** `tempVegSelection` before updating `isVegMode`
- Apply changes only when user confirms

### State Naming
- Use descriptive boolean names with `is`, `has`, `show` prefixes
- **Example:** `isVegMode`, `showVegModePopup`, `isLoading`

## Git Standards

### .gitignore
- Always exclude `.env` files
- Exclude sensitive files (credentials, keys)
- Exclude generated folders (`/ios`, `/android` for RN CLI)

### Commit Messages
- Use descriptive commit messages
- Include emoji indicator: 🤖 Generated with Claude Code
- Add Co-Authored-By line for AI assistance

## API Integration Standards

### Error Handling
```typescript
try {
  const response = await apiService.getData();
  if (response.success && response.data) {
    // Handle success
  }
} catch (error) {
  console.error('[Component] Error:', error);
  // Handle error gracefully
}
```

### Loading States
- Always show loading indicators during API calls
- Use `ActivityIndicator` from React Native
- Provide fallback data when API fails

## UI/UX Standards

### Colors
- Primary: `#00B14F` (Green)
- Background: `#FFFFFF` (White)
- Text: `#000000` (Black)
- Secondary Text: `#9E9E9E` (Gray)
- Borders: `#D9D9D9` (Light Gray)

### Spacing
- Use consistent spacing values
- Follow design specifications exactly
- Use `gap` property for flex layouts

### Border Radius
- Small: `6px` - `10px`
- Medium: `13px` - `20px`
- Large: `20px+`

## Component Standards

### Props Interface
```typescript
interface ComponentProps {
  onAction?: () => void;
  data: DataType;
  isLoading?: boolean;
}

rnclirt const Component: React.FC<ComponentProps> = ({ onAction, data, isLoading }) => {
  // Component implementation
};
```

### RN CLIrt Pattern
- Use named rnclirts for components
- **Example:** `rnclirt const HomeScreen: React.FC<HomeScreenProps>`

## File Organization

### Import Order
1. React imports
2. React Native imports
3. Third-party libraries
4. Internal imports (theme, services, components)
5. Types/Interfaces
6. Constants

### Example
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { colors, spacing } from '@/theme';
import { apiService } from '@/services/api.service';
```

## Design Conversion Standards

### From CSS to React Native
1. Convert `font-family` + `font-weight` to proper pattern
2. Convert `px` to numbers (no units in React Native)
3. Convert `%` line-height to actual pixel values
4. Convert `rgba()` colors to strings
5. Use `flexDirection: 'row'` for horizontal layouts
6. Use `gap` instead of margins where possible

### Example Conversion
```css
/* CSS */
.text {
  font-family: Poppins;
  font-weight: 700;
  font-size: 16px;
  line-height: 100%;
  letter-spacing: 0%;
  color: #FFFFFF;
  opacity: 0.85;
}
```

```typescript
// React Native
text: {
  fontFamily: 'Poppins',
  fontWeight: '700',
  fontSize: 16,
  lineHeight: 16, // 100% of 16px
  letterSpacing: 0,
  color: '#FFFFFF',
  opacity: 0.85,
}
```

---

## Summary

These standards ensure:
- ✅ Consistent code quality across the project
- ✅ Proper font implementation following CSS conventions
- ✅ Better performance through optimization
- ✅ Testability through proper testID usage
- ✅ Maintainability through clean code practices
- ✅ Accurate design implementation

**Last Updated:** 2025-10-15
