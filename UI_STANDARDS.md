# Tazty App UI Standards

## Bottom Action Buttons

All screens with bottom action buttons (Submit, Confirm, Save, etc.) should follow these standardized styles:

### Button Container
```typescript
{
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  paddingVertical: 19,
  paddingHorizontal: 20,
  gap: 10,
  backgroundColor: '#00B14F', // Use appropriate color per screen
  borderRadius: 10,
}
```

### Button Text
```typescript
{
  fontFamily: 'Poppins',
  fontWeight: '700',
  fontSize: 16,
  lineHeight: 24,
  color: '#FFFFFF',
}
```

### Button Icon
- Size: 24px
- Color: '#FFFFFF'
- Icon name: 'arrow-forward' (or appropriate action icon)
- Positioned after the text

### Example Implementation

```tsx
<TouchableOpacity style={styles.actionButton} onPress={handleAction}>
  <Text style={styles.actionButtonText}>Action Text</Text>
  <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
</TouchableOpacity>
```

### Color Variations by Screen Type
- **Primary actions** (Confirm, Submit): `#00B14F` (Tazty Green)
- **Dark actions** (Complete, Finish): `#001E1F` (Dark)
- **Other colors**: Use as needed per design, but maintain the same structure and typography

### Reference Screen
See `LocationSelectionScreen.tsx` for the reference implementation of the Confirm button.

---

## Notes
- Always maintain consistent padding (19px vertical, 20px horizontal)
- Always use 10px gap between text and icon
- Always use Poppins Bold (700) at 16px/24px line height
- Always use 10px border radius
- Button should be full width within its container
