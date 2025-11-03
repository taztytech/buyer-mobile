# Cart Backend Integration - Complete Guide

## ✅ What's Implemented

### Phase 1: Add to Cart ✅
When a user adds an item to the cart:
1. **Immediate UI Update** - Item appears in cart instantly (local state)
2. **Background Sync** - Sends to backend `POST /api/buyer/cart/add`
3. **Backend Tracking** - Stores `cart_item_id` for future updates

**Implementation Files:**
- `src/services/cart.service.ts` - Cart API service
- `src/context/CartContext.tsx` - Cart state management with backend sync
- `src/config/api.config.ts` - API endpoints configuration

### Phase 2: Load Cart on Startup ✅
When the app loads:
1. **Check Authentication** - Only loads cart if user is logged in
2. **Fetch from Backend** - Calls `GET /api/buyer/cart`
3. **Restore Cart** - Converts backend data to local format
4. **Show ViewCartBar** - Automatically displays if cart has items

### Phase 3: Update & Clear Cart ✅
**Update Item Quantity:**
1. **Immediate UI Update** - Quantity changes instantly
2. **Background Sync** - Sends `PUT /api/buyer/cart/update`
3. **Backend Updated** - Keeps backend in sync

**Remove Item:**
1. **Immediate UI Update** - Item removed instantly
2. **Background Sync** - Sends `DELETE /api/buyer/cart/remove`
3. **Backend Updated** - Item removed from backend cart

**Clear Cart:**
1. **Immediate UI Update** - Cart cleared instantly
2. **Background Sync** - Sends `DELETE /api/buyer/cart/clear`
3. **Backend Updated** - Entire cart cleared

## 🔧 How It Works

### Adding Items to Cart

```typescript
// In RestaurantScreen or any component
const { addToCart } = useCart();

await addToCart({
  id: item.id,
  itemId: item.id, // Backend item ID
  name: item.name,
  price: item.price,
  quantity: 1,
  isVeg: item.isVeg,
  specialInstructions: "Extra spicy",
  // For customizable items
  isCustomizable: true,
  variants: [...] // Customizations
});
```

**What happens:**
1. Item added to local cart state (instant UI)
2. If authenticated → Background API call to backend
3. Backend returns `cart_item_id`
4. Local cart updated with `cart_item_id` for future operations

### Loading Cart on App Startup

**Location:** `src/context/CartContext.tsx:58-138`

```typescript
useEffect(() => {
  const loadCartFromBackend = async () => {
    // 1. Check if user is authenticated
    const token = await storageService.getAccessToken();
    if (!token) return;

    // 2. Fetch cart from backend
    const backendCart = await cartService.getCart();

    // 3. Convert to local format and populate cart
    if (backendCart && backendCart.items) {
      setCart(localCart);
      setRestaurantInfo(/* ... */);
    }
  };

  loadCartFromBackend();
}, []);
```

## 📋 API Endpoints Used

### 1. Add to Cart
```
POST /api/buyer/cart/add
Authorization: Bearer {accessToken}

Request Body:
{
  "restaurant_id": 5,
  "item_id": 10,
  "quantity": 2,
  "customizations": [
    {
      "customization_group_id": 1,
      "selected_options": [10, 11]
    }
  ],
  "variants": [...],
  "special_instructions": "Extra spicy"
}

Response:
{
  "success": true,
  "message": "Item added to cart successfully",
  "cart_item_id": 42,
  "cart_summary": {
    "subtotal": 598.00,
    "delivery_fee": 0,
    "tax_amount": 107.64,
    "final_amount": 705.64
  }
}
```

### 2. Get Cart
```
GET /api/buyer/cart
Authorization: Bearer {accessToken}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "restaurant_id": 5,
    "restaurant_name": "Pizza Palace",
    "restaurant_logo": "https://...",
    "items": [
      {
        "id": 42,
        "item_id": 10,
        "item_name": "Margherita Pizza",
        "quantity": 2,
        "unit_price": 299.00,
        "total_price": 598.00,
        "customizations": [...],
        "special_instructions": "Extra cheese"
      }
    ],
    "summary": {
      "subtotal": 598.00,
      "final_amount": 705.64
    },
    "total_items": 2
  }
}
```

## 🐛 Error Handling

### Empty Cart Response
If backend returns no cart or empty cart:
```json
{
  "success": true,
  "message": "Cart is empty"
}
```

**Handled by:** Defensive null checks in cart service and context
- Checks `backendCart && backendCart.items && Array.isArray(backendCart.items)`
- Gracefully continues with empty cart if backend fails

### Authentication Errors
If user is not authenticated:
- Cart loading is skipped silently
- Add to cart works locally only
- No error shown to user

### Network Errors
If backend is unreachable:
- Cart remains in local state
- Error logged in development mode
- User can continue using local cart

## 📱 User Experience

### First Time User (No Cart)
1. User opens app
2. No backend cart exists
3. Empty cart state
4. ViewCartBar hidden

### User Adds Items
1. User adds item → Appears instantly
2. Backend synced in background
3. ViewCartBar appears at bottom
4. User can checkout or continue shopping

### Returning User (Has Cart)
1. User opens app
2. Cart loaded from backend automatically
3. ViewCartBar appears with saved items
4. User can continue where they left off

## 🔍 Development Logging

All cart operations log detailed info in `__DEV__` mode:

```
✅ Cart loaded from backend: 3 items
✅ Push token registered successfully
✅ Item added to cart. Cart item ID: 42
⚠️  Skipping backend sync: User not authenticated
❌ Failed to load cart from backend: [Error details]
```

## 📋 API Endpoints Reference

### 1. Add to Cart ✅
```
POST /api/buyer/cart/add
```

### 2. Get Cart ✅
```
GET /api/buyer/cart
```

### 3. Update Cart Item ✅
```
PUT /api/buyer/cart/update

Body:
{
  "cart_item_id": 42,
  "restaurant_id": 5,  // Optional
  "quantity": 3,
  "customizations": [...],  // Optional
  "variants": [...],  // Optional
  "special_instructions": "Medium spicy"  // Optional
}
```

### 4. Remove from Cart ✅
```
DELETE /api/buyer/cart/remove

Body:
{
  "cart_item_id": 42
}
```

### 5. Clear Cart ✅
```
DELETE /api/buyer/cart/clear
```

## 🚀 What's Next

### Phase 4: Cart Summary & Checkout
- Display cart summary (subtotal, taxes, delivery fee)
- Apply coupons/offers
- Proceed to checkout

## 📝 Notes

### Cart Item ID Mapping
- **Frontend `id`**: String used for UI (e.g., "123")
- **Backend `item_id`**: Numeric item ID (e.g., 123)
- **Backend `cart_item_id`**: Unique ID for cart entry (e.g., 42)

### Customizations Mapping
Frontend `variants` are mapped to backend `customizations`:
```typescript
// Frontend
variants: [
  {
    id: "123-1",
    variantId: "1",
    addOns: ["10", "11"],
    quantity: 2,
    price: 299
  }
]

// Backend
customizations: [
  {
    customization_group_id: 1,
    selected_options: [
      { id: 10 },
      { id: 11 }
    ]
  }
]
```

### ViewCartBar Auto-Display
The `ViewCartBar` component automatically shows/hides based on cart items:
- Returns `null` if `getTotalItems() === 0`
- Displays when cart has items
- Shows restaurant info, item count, total price

## ✅ Testing Checklist

- [x] Add item to cart (authenticated user)
- [x] Add item to cart (unauthenticated user)
- [x] Load cart on app startup (with items)
- [x] Load cart on app startup (empty cart)
- [x] ViewCartBar appears when cart has items
- [x] ViewCartBar hidden when cart is empty
- [x] Update cart item quantity (syncs to backend)
- [x] Remove item from cart (syncs to backend)
- [x] Clear entire cart (syncs to backend)
- [ ] Cart summary displays correctly
- [ ] Apply coupons/offers

## 🎯 Summary

The cart backend integration is **complete for Phases 1, 2 & 3**:
- ✅ Items sync to backend when added
- ✅ Cart loads from backend on app startup
- ✅ **Item quantity updates sync to backend**
- ✅ **Item removal syncs to backend**
- ✅ **Clear cart syncs to backend**
- ✅ ViewCartBar shows automatically
- ✅ Graceful error handling
- ✅ Works offline (local state fallback)
- ✅ Development logging for debugging
- ✅ Optimistic UI updates (instant feedback)

**Full cart lifecycle is now backend-synced!** Users can:
- Add items → Synced ✅
- Update quantities → Synced ✅
- Remove items → Synced ✅
- Clear cart → Synced ✅
- Close/reopen app → Cart restored ✅

🎉 All cart operations persist across app sessions!
