import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cartService, AddToCartRequest } from '@/services/cart.service';
import { storageService } from '@/services/storage.service';

export interface CartVariant {
  id: string;
  variantId?: string;
  variantName?: string;
  addOns?: string[];
  addOnNames?: string[];
  quantity: number;
  price: number;
}

export interface CartItem {
  id: string; // Frontend item ID (for display)
  itemId?: number; // Backend item ID
  cartItemId?: number; // Backend cart_item_id (from add to cart response)
  name: string;
  price: number;
  quantity?: number;
  isVeg: boolean;
  image?: string;
  isCustomizable?: boolean;
  variants?: CartVariant[];
  specialInstructions?: string;
}

interface CartContextType {
  cart: { [key: string]: CartItem };
  addToCart: (item: CartItem, overrideRestaurantId?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  restaurantId: number | null;
  restaurantName: string;
  restaurantLogo: any;
  setRestaurantInfo: (id: number, name: string, logo?: any) => void;
  checkRestaurantConflict: (newRestaurantId: number) => boolean;
  syncWithBackend: boolean; // Flag to indicate if syncing with backend
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantLogo, setRestaurantLogo] = useState<any>(null);
  const [syncWithBackend, setSyncWithBackend] = useState<boolean>(false);
  const [isCartLoaded, setIsCartLoaded] = useState<boolean>(false);

  /**
   * Load cart from backend on app startup
   */
  useEffect(() => {
    const loadCartFromBackend = async () => {
      try {
        const token = await storageService.getAccessToken();

        // Only load cart if user is authenticated
        if (!token) {
          if (__DEV__) {
            console.log('User not authenticated, skipping cart load');
          }
          setIsCartLoaded(true);
          return;
        }

        if (__DEV__) {
          console.log('Loading cart from backend...');
        }

        const backendCart = await cartService.getCart();

        if (backendCart && backendCart.items && Array.isArray(backendCart.items) && backendCart.items.length > 0) {
          // Set restaurant info
          setRestaurantId(backendCart.restaurant_id);
          setRestaurantName(backendCart.restaurant_name);
          setRestaurantLogo(backendCart.restaurant_logo);

          if (__DEV__) {
            console.log('Restaurant:', backendCart.restaurant_name);
            console.log('Total items in backend cart:', backendCart.items.length);
          }

          // Convert backend cart items to local cart format
          const localCart: { [key: string]: CartItem } = {};

          backendCart.items.forEach((item) => {
            // Map dietary_preference to isVeg
            const isVeg = item.dietary_preference === 'veg' ||
                          item.dietary_preference === 'vegetarian';

            const cartItem: CartItem = {
              id: item.item_id.toString(),
              itemId: item.item_id,
              cartItemId: item.id, // Backend cart_item_id
              name: item.item_name,
              price: item.unit_price,
              quantity: item.quantity,
              isVeg: isVeg,
              image: item.item_images?.[0],
              specialInstructions: item.special_instructions || undefined,
              isCustomizable: item.has_customizations || (item.customizations && item.customizations.length > 0),
            };

            // Convert customizations to variants if present
            if (item.customizations && item.customizations.length > 0) {
              cartItem.variants = item.customizations.map((customization) => ({
                id: `${item.item_id}-${customization.customization_group_id}`,
                variantId: customization.customization_group_id.toString(),
                variantName: customization.customization_group_name,
                addOns: customization.selected_options.map((opt) => opt.id.toString()),
                addOnNames: customization.selected_options.map((opt) => opt.name || ''),
                quantity: item.quantity,
                price: item.unit_price,
              }));
            }

            localCart[item.item_id.toString()] = cartItem;
          });

          setCart(localCart);

          if (__DEV__) {
            console.log('✅ Cart loaded from backend:', Object.keys(localCart).length, 'items');
          }
        } else {
          if (__DEV__) {
            console.log('No cart found in backend');
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Failed to load cart from backend:', error);
        }
        // Continue with empty cart if loading fails
      } finally {
        setIsCartLoaded(true);
      }
    };

    loadCartFromBackend();
  }, []); // Only run once on mount

  /**
   * Add item to cart (local + backend sync)
   */
  const addToCart = async (item: CartItem, overrideRestaurantId?: number) => {
    // Update local cart immediately for responsive UI
    setCart(prev => ({
      ...prev,
      [item.id]: item,
    }));

    // Sync with backend
    try {
      const token = await storageService.getAccessToken();

      // Use overrideRestaurantId if provided, otherwise use context restaurantId
      const effectiveRestaurantId = overrideRestaurantId || restaurantId;

      // Only sync with backend if user is authenticated
      if (!token || !effectiveRestaurantId) {
        return;
      }

      setSyncWithBackend(true);

      // Prepare backend request
      const backendRequest: AddToCartRequest = {
        restaurant_id: effectiveRestaurantId,
        item_id: item.itemId || parseInt(item.id, 10), // Use itemId if available, fallback to id
        quantity: item.quantity || 1,
        special_instructions: item.specialInstructions,
      };

      // Add customizations if item has variants (customizable items)
      if (item.isCustomizable && item.variants && item.variants.length > 0) {
        // Map frontend variants to backend customizations structure
        backendRequest.customizations = item.variants.map((variant) => ({
          customization_group_id: parseInt(variant.variantId || '0', 10),
          selected_options: (variant.addOns || []).map(addOnId => ({
            id: parseInt(addOnId, 10),
          })),
        })).filter(c => c.customization_group_id > 0);
      }

      // Call backend API
      const response = await cartService.addToCart(backendRequest);

      if (response.success) {
        // Update local cart with backend cart_item_id
        setCart(prev => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            cartItemId: response.cart_item_id,
          },
        }));
      }
    } catch (error) {
      // Item remains in local cart even if backend sync fails
    } finally {
      setSyncWithBackend(false);
    }
  };

  /**
   * Remove item from cart (local + backend sync)
   */
  const removeFromCart = async (itemId: string) => {
    const item = cart[itemId];

    // Update local cart immediately for responsive UI
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[itemId];
      return newCart;
    });

    // Sync with backend
    try {
      const token = await storageService.getAccessToken();
      if (!token || !item?.cartItemId) {
        return;
      }

      setSyncWithBackend(true);

      const response = await cartService.removeCartItem(item.cartItemId);
    } catch (error) {
      // Item already removed from local cart
    } finally {
      setSyncWithBackend(false);
    }
  };

  /**
   * Update item quantity (local + backend sync)
   */
  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    const item = cart[itemId];

    // Update local cart immediately for responsive UI
    setCart(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity,
      },
    }));

    // Sync with backend
    try {
      const token = await storageService.getAccessToken();

      if (!token || !restaurantId) {
        return;
      }

      // If item doesn't have cartItemId, add it to backend first
      if (!item?.cartItemId) {

        // Prepare backend request
        const backendRequest: AddToCartRequest = {
          restaurant_id: restaurantId,
          item_id: item.itemId || parseInt(item.id, 10),
          quantity: quantity,
          special_instructions: item.specialInstructions,
        };

        // Add customizations if item has variants
        if (item.isCustomizable && item.variants && item.variants.length > 0) {
          backendRequest.customizations = item.variants.map((variant) => ({
            customization_group_id: parseInt(variant.variantId || '0', 10),
            selected_options: (variant.addOns || []).map(addOnId => ({
              id: parseInt(addOnId, 10),
            })),
          })).filter(c => c.customization_group_id > 0);
        }

        const addResponse = await cartService.addToCart(backendRequest);

        if (addResponse.success && addResponse.cart_item_id) {
          // Update local cart with backend cart_item_id
          setCart(prev => ({
            ...prev,
            [item.id]: {
              ...prev[item.id],
              cartItemId: addResponse.cart_item_id,
            },
          }));
          return; // Quantity already set during add
        } else {
          return;
        }
      }

      setSyncWithBackend(true);

      const response = await cartService.updateCartItem(item.cartItemId, {
        restaurant_id: restaurantId,
        quantity,
      });
    } catch (error) {
      // Quantity already updated in local cart
    } finally {
      setSyncWithBackend(false);
    }
  };

  /**
   * Clear entire cart (local + backend sync)
   */
  const clearCart = async () => {
    // Update local cart immediately
    setCart({});
    const prevRestaurantId = restaurantId;
    setRestaurantId(null);
    setRestaurantName('');
    setRestaurantLogo(null);

    // Sync with backend
    try {
      const token = await storageService.getAccessToken();
      if (!token) {
        return;
      }

      setSyncWithBackend(true);

      const response = await cartService.clearCart();
    } catch (error) {
      // Cart already cleared locally
    } finally {
      setSyncWithBackend(false);
    }
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, item) => {
      if (item.isCustomizable && item.variants) {
        return sum + item.variants.reduce((variantSum, variant) => variantSum + variant.quantity, 0);
      }
      return sum + (item.quantity || 0);
    }, 0);
  };

  const getTotalPrice = () => {
    return Object.values(cart).reduce((sum, item) => {
      if (item.isCustomizable && item.variants) {
        return sum + item.variants.reduce((variantSum, variant) => variantSum + (variant.price * variant.quantity), 0);
      }
      return sum + (item.price * (item.quantity || 0));
    }, 0);
  };

  const setRestaurantInfo = (id: number, name: string, logo?: any) => {
    setRestaurantId(id);
    setRestaurantName(name);
    setRestaurantLogo(logo || null);
  };

  const checkRestaurantConflict = (newRestaurantId: number): boolean => {
    // If cart is empty or no restaurant is set, no conflict
    if (Object.keys(cart).length === 0 || restaurantId === null) {
      return false;
    }

    // Check if the new restaurant is different from the current one
    return restaurantId !== newRestaurantId;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
        restaurantId,
        restaurantName,
        restaurantLogo,
        setRestaurantInfo,
        checkRestaurantConflict,
        syncWithBackend,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
