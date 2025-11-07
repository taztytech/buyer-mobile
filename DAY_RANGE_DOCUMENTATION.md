# Day Range Numbering System

## API Standard (ISO 8601)

The API uses ISO 8601 day numbering, where the week starts on Monday:

```
1 = Monday
2 = Tuesday
3 = Wednesday
4 = Thursday
5 = Friday
6 = Saturday
7 = Sunday
```

## Important Notes

1. **NO CONVERSION NEEDED**: The frontend should work directly with the API format (1-7)
2. **JavaScript Date.getDay()** returns 0-6 format (0=Sunday), so we must convert JS day to API format
3. **Wrap-around ranges**: Ranges can wrap around the week (e.g., day_from: 5, day_to: 1 means Friday through Monday)

## Conversion Rules

### Converting JavaScript Day to API Day

```javascript
const jsDay = new Date().getDay(); // Returns 0-6 (0=Sunday, 6=Saturday)
const apiDay = jsDay === 0 ? 7 : jsDay; // Convert to 1-7 (1=Monday, 7=Sunday)
```

**Conversion Table:**
```
JS Format (0-6)  →  API Format (1-7)
0 (Sunday)       →  7
1 (Monday)       →  1
2 (Tuesday)      →  2
3 (Wednesday)    →  3
4 (Thursday)     →  4
5 (Friday)       →  5
6 (Saturday)     →  6
```

### Day Range Validation

When checking if current day is in range:

**Normal Range (e.g., Mon-Fri: 1-5):**
```javascript
if (day_to >= day_from) {
  isInRange = currentDay >= day_from && currentDay <= day_to;
}
```

**Wrap-Around Range (e.g., Fri-Mon: 5-1):**
```javascript
if (day_to < day_from) {
  // Wraps around the week (includes weekend)
  isInRange = currentDay >= day_from || currentDay <= day_to;
}
```

## Examples

### Example 1: Monday to Sunday (Full Week)
```
day_from: 1, day_to: 7
Current day: 5 (Friday in API format)
Check: 5 >= 1 && 5 <= 7 = true ✅
```

### Example 2: Friday to Monday (Weekend)
```
day_from: 5, day_to: 1
Current day: 7 (Sunday in API format)
Check: 7 >= 5 || 7 <= 1 = true ✅

Current day: 3 (Wednesday in API format)
Check: 3 >= 5 || 3 <= 1 = false ❌
```

### Example 3: Monday to Friday (Weekdays)
```
day_from: 1, day_to: 5
Current day: 6 (Saturday in API format)
Check: 6 >= 1 && 6 <= 5 = false ❌
```

## Implementation Checklist

- [ ] **ALWAYS** convert JavaScript day (0-6) to API day (1-7) before comparisons
- [ ] **NEVER** convert API day format to JavaScript format
- [ ] **ALWAYS** handle wrap-around ranges with OR logic when `day_to < day_from`
- [ ] Store timings in API format (1-7) throughout the application
- [ ] Only convert when getting the current day from JavaScript's Date object

## Related Files

- `/src/utils/timing.utils.ts` - Timing utility functions
- `/src/screens/Restaurant/RestaurantScreen.tsx` - Restaurant item availability logic
- `/src/services/home.service.ts` - Restaurant opening hours logic

## Last Updated

November 7, 2025 - Clarified that API format (1-7) is the standard and should not be converted
