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

---

Last Updated: 2025-10-17
