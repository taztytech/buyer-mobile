# UI Design Standards

This document defines the consistent UI/UX standards used across the Tazty app.

## Back Button Standards

All screens in the app should use a consistent back button design to maintain a uniform user experience.

### Standard Back Button Styling

```typescript
backButton: {
  width: 40,
  height: 40,
  borderRadius: 50,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#E4E4E4',
  justifyContent: 'center',
  alignItems: 'center',
}
```

### Standard Back Button Icon

```typescript
<TouchableOpacity style={styles.backButton} onPress={onBack}>
  <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
</TouchableOpacity>
```

### Specifications

- **Size**: 40px × 40px
- **Shape**: Circular (borderRadius: 50)
- **Background**: White (#FFFFFF)
- **Border**: 1px solid #E4E4E4
- **Icon**: MaterialIcons "chevron-left"
- **Icon Size**: 24px
- **Icon Color**: #001E1F (Dark teal)

### Screens Using This Standard

The following screens implement this back button standard:

1. **AddressSelectionScreen** (`src/screens/Location/AddressSelectionScreen.tsx`)
   - Location: Line 260
   - Reference implementation

2. **RestaurantScreen** (`src/screens/Restaurant/RestaurantScreen.tsx`)
   - Location: Line 876
   - Status: ✓ Consistent

3. **CategoryResultsScreen** (`src/screens/Category/CategoryResultsScreen.tsx`)
   - Location: Line 467
   - Status: ✓ Consistent

4. **ProfileScreen** (`src/screens/Profile/ProfileScreen.tsx`)
   - Location: Line 180
   - Status: ✓ Updated to match standard

5. **LocationSelectionScreen** (`src/screens/Location/LocationSelectionScreen.tsx`)
   - Location: Line 432
   - Status: ✓ Updated to follow standard positioning with SafeAreaView

### Special Cases

#### Full-Screen Layouts (Map Overlays)

For screens with full-screen content like maps (e.g., LocationSelectionScreen), wrap the back button in a SafeAreaView with absolute positioning:

```typescript
// In JSX
<SafeAreaView style={styles.headerSafeArea} edges={['top']}>
  <TouchableOpacity style={styles.backButton} onPress={onBack}>
    <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
  </TouchableOpacity>
</SafeAreaView>

// In styles
headerSafeArea: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  paddingHorizontal: 20,
  paddingTop: 16,
},
backButton: {
  width: 40,
  height: 40,
  backgroundColor: '#FFFFFF',
  borderRadius: 50,
  borderWidth: 1,
  borderColor: '#E4E4E4',
  justifyContent: 'center',
  alignItems: 'center',
}
```

This approach ensures the back button respects the device's safe area (status bar, notch) while floating over full-screen content.

### Implementation Guidelines

1. **Always use the standard styling** defined above unless there's a specific technical requirement
2. **Reference AddressSelectionScreen** as the canonical implementation
3. **Maintain consistency** across all navigation patterns
4. **Test on both iOS and Android** to ensure proper rendering
5. **Update this document** when making changes to the standard

### Related Components

- **Close Buttons**: Modals use a similar circular close button pattern (see `FoodItemDetailModal.tsx`)
- **Navigation**: All top-level navigation should use this back button pattern

## Modal Standards

All modals in the app should use consistent standards to ensure proper display on Android devices, particularly to avoid gaps at the bottom caused by the Android navigation bar.

### Standard Modal Configuration

**IMPORTANT:** All Modal components must include `statusBarTranslucent={true}` to ensure they extend fully to the bottom of the screen on Android devices.

```typescript
<Modal
  visible={visible}
  transparent
  animationType="slide" // or "fade" depending on design
  statusBarTranslucent={true}  // REQUIRED for Android
  onRequestClose={onClose}
>
  {/* Modal content */}
</Modal>
```

### Why This is Required

- Without `statusBarTranslucent={true}`, modals on Android will show a gap at the bottom where the navigation bar area is visible
- This prop allows the modal to extend into system UI areas (status bar and navigation bar)
- This is an Android-specific prop and has no negative effect on iOS

### Modals Using This Standard

1. **FoodItemDetailModal** (`src/components/FoodItemDetailModal.tsx`)
   - Location: Line 67
   - Status: ✓ Implemented

2. **CustomizationModal** (`src/components/CustomizationModal.tsx`)
   - Location: Line 92
   - Status: ✓ Implemented

3. **Location Permission Modal** (`src/screens/Home/HomeScreen.tsx`)
   - Location: Line 895
   - Status: ✓ Implemented

4. **FilterModal** (`src/components/FilterModal.tsx`)
   - Location: Line 67
   - Status: ✓ Implemented

### Implementation Guidelines

1. **Always add `statusBarTranslucent={true}`** to Modal components
2. **Do NOT add manual padding** to fix bottom gaps - use this prop instead
3. **Test on Android devices** to ensure no gaps appear at the bottom
4. **Update this document** when creating new modals

## Modal Background Animation Standards

All screens with modals should use consistent animation to scale down and reveal curved edges when modals appear. This creates a visual hierarchy and polish throughout the app.

### Standard Animation Configuration

**Animation Values:**
- **Scale**: 0.92 (scales down to 92% of original size)
- **TranslateY**: 30 (moves down 30px to reveal top edges)
- **Duration**: 300ms
- **Border Radius**: 20px on top corners (borderTopLeftRadius, borderTopRightRadius)
- **Container Background**: #000000 (black, visible behind scaled screen)

### Implementation Code

```typescript
// In component setup
const scaleAnim = useRef(new Animated.Value(1)).current;
const translateYAnim = useRef(new Animated.Value(0)).current;

// Animation effect
useEffect(() => {
  if (showModal1 || showModal2 || showModal3) {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 30,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  } else {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }
}, [showModal1, showModal2, showModal3]);

// In JSX structure
return (
  <View style={styles.container}>
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim },
          ],
        },
      ]}
    >
      {/* Screen content */}
    </Animated.View>

    {/* Modals */}
  </View>
);

// In styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',  // Black background visible behind animation
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',  // Or '#F5F5F5' depending on screen
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
```

### Specifications

- **Scale Value**: 0.92 (8% reduction in size)
- **Translation**: 30px downward
- **Duration**: 300ms
- **Border Radius**: 20px (top corners only)
- **Container Color**: Black (#000000)
- **useNativeDriver**: true (for better performance)
- **Animation Type**: Parallel (scale and translate happen simultaneously)

### Visual Effect

When a modal opens:
1. The entire screen scales down to 92% of its size
2. The screen moves down 30px
3. Curved top edges (20px radius) become visible
4. Black background shows around the scaled screen
5. Creates depth and visual hierarchy

### Screens Using This Standard

1. **RestaurantScreen** (`src/screens/Restaurant/RestaurantScreen.tsx`)
   - Lines: 169-170 (refs), 611-640 (animation), 1315-1321 (styles)
   - Modals: FoodItemDetailModal, CustomizationModal, CustomisationsReviewModal, FilterModal
   - Status: ✓ Implemented

2. **OrderDetailsScreen** (`src/screens/Order/OrderDetailsScreen.tsx`)
   - Lines: 89-90 (refs), 98-133 (animation), 699-705 (styles)
   - Modals: PaymentModal, AddressModal, CustomizationModal
   - Status: ✓ Implemented

### Implementation Guidelines

1. **Always use consistent values**: scale: 0.92, translateY: 30, duration: 300ms
2. **Add border radius** to animatedContainer for curved top edges
3. **Use black container background** (#000000) for consistent depth effect
4. **Include all modal states** in the useEffect dependency array
5. **Use Animated.parallel** to run scale and translate simultaneously
6. **Enable useNativeDriver: true** for better performance
7. **Test on physical devices** to ensure smooth animation
8. **Update this document** when adding animations to new screens

### Related Standards

- See **Modal Standards** section for modal component configuration
- See **Status Bar and Safe Area Standards** for proper screen structure

## Card/Box Styling Standards

All cards and containers in the app should use consistent styling for a cohesive look and feel.

### Standard Card Styling

```typescript
card: {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  padding: 20,
  // NO shadows - clean flat design
}
```

### Layout Spacing

```typescript
content: {
  padding: 20,
}

scrollContent: {
  padding: 20,
  gap: 14,  // gap between cards
  paddingBottom: 24,
}
```

### Specifications

- **Border Radius**: 20px (rounded corners)
- **Padding**: 20px (internal spacing)
- **Background**: White (#FFFFFF)
- **Shadows**: None (flat design)
- **Card Gaps**: 14px spacing between cards
- **Content Padding**: 20px

### Screens Using This Standard

1. **OrdersScreen** - Order cards
2. **OrderDetailScreen** - Information cards
3. **OrderDetailsScreen** - Section cards
4. **MyAddressesScreen** - Address cards

---

## Status Bar and Safe Area Standards

All screens must properly handle the Android status bar to avoid white/black gaps at the top.

### Standard Status Bar Configuration

```typescript
// In JSX - wrap with outer container for green background
return (
  <View style={styles.outerContainer}>
    <StatusBar
      barStyle="light-content"
      backgroundColor="#00B14F"
      translucent={false}
    />
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        bounces={false}              // Prevents iOS bounce
        overScrollMode="never"        // Prevents Android overscroll
      >
        {/* Content */}
      </ScrollView>
    </SafeAreaView>
  </View>
);

// In styles
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',  // Green for status bar area
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#00B14F',  // Green extends to safe area
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',  // White for content area
  },
});
```

### Key Points

1. **Three-Layer Structure**:
   - Outer container: Green background for status bar area
   - SafeAreaView: Handles device notches/status bar
   - ScrollView/Container: White background for content

2. **StatusBar Props**:
   - `barStyle="light-content"` - White icons for green background
   - `backgroundColor="#00B14F"` - Green color
   - `translucent={false}` - Prevents content from going behind status bar

3. **ScrollView Props**:
   - `bounces={false}` - No bounce at top/bottom (iOS)
   - `overScrollMode="never"` - No overscroll effect (Android)

4. **Background Colors**:
   - Status bar area: `#00B14F` (green)
   - Content area: `#FFFFFF` (white) or `#F5F5F5` / `#F3F4F6` (light gray)

### Why This is Required

- Prevents white/black gaps showing in the status bar area on Android
- Ensures consistent green status bar across all screens
- Eliminates scroll bounce revealing gaps
- Maintains professional appearance on all devices

### Screens Using This Standard

1. **HomeScreen** - ✓ Implemented
2. **CategoryResultsScreen** - ✓ Needs update
3. **All other screens** - To be updated

### Implementation Checklist

When creating or updating a screen:

- [ ] Add outer container with green background
- [ ] Configure StatusBar with green color and translucent={false}
- [ ] Wrap content in SafeAreaView with green background
- [ ] Add bounces={false} and overScrollMode="never" to ScrollView
- [ ] Test on physical Android device

---

Last Updated: 2025-10-18
