import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppState } from 'react-native';
import { cartService, AddToCartRequest, CartSummary, CartFetchError, CartResponse } from '@/services/cart.service';
import { storageService } from '@/services/storage.service';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';
import { analyticsService, AnalyticsEvents } from '@/services/analytics.service';

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
  isPreorder?: boolean;
  campaignId?: string;
}

interface CartContextType {
  cart: { [key: string]: CartItem };
  cartSummary: CartSummary | null;
  addToCart: (item: CartItem, overrideRestaurantId?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<CartSummary | null>;
  updateQuantity: (itemId: string, quantity: number) => Promise<CartSummary | null>;
  clearCart: (syncWithBackend?: boolean) => Promise<void>;
  /** Reload cart from backend. Resolves to the cart payload when GET /cart ran; `null` if skipped (guest) or on failure. */
  reloadCart: () => Promise<CartResponse | null>;
  /** Run any pending debounced quantity update immediately (e.g. before navigating to checkout). */
  flushPendingQuantityUpdate: () => Promise<void>;
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

const clampQuantity = (quantity: number) => Math.min(quantity, MAX_ITEM_QUANTITY);

const normalizeCartItemQuantities = (item: CartItem): CartItem => {
  if (item.isCustomizable && item.variants) {
    let remaining = MAX_ITEM_QUANTITY;
    const normalizedVariants = item.variants
      .map(variant => {
        if (remaining <= 0) {
          return { ...variant, quantity: 0 };
        }
        const allowed = Math.min(variant.quantity, remaining);
        remaining -= allowed;
        return { ...variant, quantity: allowed };
      })
      .filter(variant => variant.quantity > 0);

    return {
      ...item,
      variants: normalizedVariants,
    };
  }

  return {
    ...item,
    quantity: clampQuantity(item.quantity || 1),
  };
};

const getCartItemTotalQuantity = (item: CartItem | undefined): number => {
  if (!item) return 0;
  if (item.isCustomizable && item.variants) {
    return item.variants.reduce((sum, variant) => sum + variant.quantity, 0);
  }
  return item.quantity || 0;
};

/**
 * Merge a new add into existing cart state. Rapid "+ Add" taps must accumulate quantity
 * instead of replacing the line with quantity 1 each time.
 */
const mergeAddIntoCart = (prev: { [key: string]: CartItem }, incoming: CartItem): CartItem => {
  const existing = prev[incoming.id];
  if (!existing || existing.isCustomizable || incoming.isCustomizable) {
    return incoming;
  }
  const addQty = incoming.quantity || getCartItemTotalQuantity(incoming) || 1;
  let mergedQty = clampQuantity((existing.quantity || 0) + addQty);
  if (incoming.isPreorder === true || existing.isPreorder === true) {
    mergedQty = Math.min(mergedQty, 1);
  }
  return {
    ...existing,
    ...incoming,
    quantity: mergedQty,
  };
};

/**
 * Check if cart contains only preorder items (or is empty)
 * Returns true if cart is empty OR all items in cart are preorder items
 * Returns false if cart has any non-preorder items
 */
const isCartOnlyPreorder = (currentCart: { [key: string]: CartItem }): boolean => {
  const cartItems = Object.values(currentCart);
  if (cartItems.length === 0) {
    return true; // Empty cart means we can add preorder items as preorder
  }
  // Check if ALL items are preorder items
  return cartItems.every(item => item.isPreorder === true);
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantLogo, setRestaurantLogo] = useState<any>(null);
  const [syncWithBackend, setSyncWithBackend] = useState<boolean>(false);
  const [isCartLoaded, setIsCartLoaded] = useState<boolean>(false);
  
  // Refs for debouncing and canceling pending requests
  const updateQuantityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<{ itemId: string; quantity: number; previousQuantity: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Serialize add-to-cart API calls so cart_summary and server state stay ordered (avoids stale totals). */
  const addToCartBackendChainRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Save cart to local storage
   */
  const saveCartToStorage = async (cartToSave: { [key: string]: CartItem }, restaurantIdToSave: number | null, restaurantNameToSave: string, restaurantLogoToSave: any) => {
    try {
      await storageService.saveCartData({
        cart: cartToSave,
        restaurantId: restaurantIdToSave,
        restaurantName: restaurantNameToSave,
        restaurantLogo: restaurantLogoToSave,
      });
    } catch (error) {
      console.error('[CartContext] Error saving cart to storage:', error);
    }
  };

  /**
   * Normalize cart items to ensure preorder items have quantity <= 1
   */
  const normalizeCartForPreorder = (cartToNormalize: { [key: string]: CartItem }): { [key: string]: CartItem } => {
    const normalizedCart: { [key: string]: CartItem } = {};
    
    Object.keys(cartToNormalize).forEach(itemId => {
      const item = cartToNormalize[itemId];
      
      if (item.isPreorder) {
        // For preorder items, ensure total quantity is at most 1
        if (item.isCustomizable && item.variants && item.variants.length > 0) {
          // For customizable items, calculate total quantity from all variants
          const totalVariantQuantity = item.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
          
          if (totalVariantQuantity > 1) {
            // If total exceeds 1, keep only the first variant with quantity 1
            const firstVariant = { ...item.variants[0], quantity: 1 };
            normalizedCart[itemId] = {
              ...item,
              variants: [firstVariant],
            };
          } else if (totalVariantQuantity === 0) {
            // If no quantity, set first variant to 1
            const firstVariant = { ...item.variants[0], quantity: 1 };
            normalizedCart[itemId] = {
              ...item,
              variants: [firstVariant],
            };
          } else {
            // Total is exactly 1, keep as-is but ensure no variant exceeds 1
            const normalizedVariants = item.variants.map(variant => ({
              ...variant,
              quantity: Math.min(variant.quantity || 0, 1),
            }));
            normalizedCart[itemId] = {
              ...item,
              variants: normalizedVariants.filter(v => v.quantity > 0),
            };
          }
        } else {
          // For non-customizable items, cap quantity at 1
          normalizedCart[itemId] = {
            ...item,
            quantity: Math.min(item.quantity || 1, 1),
          };
        }
      } else {
        // Non-preorder items, keep as-is
        normalizedCart[itemId] = item;
      }
    });
    
    return normalizedCart;
  };

  /**
   * Load cart from local storage
   */
  const loadCartFromStorage = async (): Promise<{
    cart: { [key: string]: CartItem };
    restaurantId: number | null;
    restaurantName: string;
    restaurantLogo: any;
  } | null> => {
    try {
      const storedData = await storageService.getCartData();
      if (storedData && storedData.cart && Object.keys(storedData.cart).length > 0) {
        // Normalize cart to ensure preorder items have correct quantities
        const normalizedCart = normalizeCartForPreorder(storedData.cart as { [key: string]: CartItem });
        
        return {
          cart: normalizedCart,
          restaurantId: storedData.restaurantId,
          restaurantName: storedData.restaurantName,
          restaurantLogo: storedData.restaurantLogo,
        };
      }
      return null;
    } catch (error) {
      console.error('[CartContext] Error loading cart from storage:', error);
      return null;
    }
  };

  const loadCartFromBackend = async (): Promise<CartResponse | null> => {
    try {
      const token = await storageService.getAccessToken();
      if (!token) {
        setIsCartLoaded(true);
        return null;
      }

      // Guests: cart API requires registered user. Use storage only.
      const loggedIn = await storageService.isLoggedIn();
      if (!loggedIn) {
        setIsCartLoaded(true);
        return null;
      }

      const backendCart = await cartService.getCart();

      // Log for debugging
      console.log('[CartContext] Backend cart response:', {
        hasCart: !!backendCart,
        hasItems: !!(backendCart?.items),
        itemsCount: backendCart?.items?.length || 0,
        itemsType: Array.isArray(backendCart?.items) ? 'array' : typeof backendCart?.items,
        restaurantId: backendCart?.restaurant_id,
      });

      // Check if we have a valid cart with items
      if (backendCart && backendCart.items && Array.isArray(backendCart.items)) {
        setCartSummary(backendCart.summary || null);
        // Set restaurant info even if cart is empty
        if (backendCart.restaurant_id) {
          setRestaurantId(backendCart.restaurant_id);
          setRestaurantName(backendCart.restaurant_name || '');
          setRestaurantLogo(backendCart.restaurant_logo || null);
        }

        // Only process items if we have any
        if (backendCart.items.length > 0) {
          const localCart: { [key: string]: CartItem } = {};

          backendCart.items.forEach((item) => {
            // Validate required fields - only require item_id
            if (!item.item_id) {
              console.warn('[CartContext] Skipping invalid cart item (missing item_id):', item);
              return;
            }

            const isVeg = item.dietary_preference === 'veg' ||
                          item.dietary_preference === 'vegetarian';

            const isPreorder = (item as any).is_preorder === true;
            // For preorder items, enforce quantity limit of 1
            const baseQuantity = item.quantity || 1;
            const validatedQuantity = isPreorder ? Math.min(baseQuantity, 1) : baseQuantity;

            const cartItem: CartItem = {
              id: item.item_id.toString(),
              itemId: item.item_id,
              cartItemId: item.id,
              name: item.item_name,
              price: item.unit_price || 0,
              quantity: validatedQuantity,
              isVeg: isVeg,
              image: item.item_images?.[0],
              specialInstructions: item.special_instructions || undefined,
              isCustomizable: item.has_customizations || (item.customizations && item.customizations.length > 0),
              isPreorder: isPreorder,
              campaignId: (item as any).campaign_id?.toString(),
            };

            if (item.customizations && item.customizations.length > 0) {
              // For customizable preorder items, ensure variant quantities don't exceed 1 total
              const variantQuantity = isPreorder ? Math.min(item.quantity || 1, 1) : (item.quantity || 1);
              cartItem.variants = item.customizations.map((customization) => ({
                id: `${item.item_id}-${customization.customization_group_id}`,
                variantId: customization.customization_group_id.toString(),
                variantName: customization.customization_group_name,
                addOns: customization.selected_options.map((opt) => opt.id.toString()),
                addOnNames: customization.selected_options.map((opt) => opt.name || ''),
                quantity: variantQuantity,
                price: item.unit_price || 0,
              }));
            }

            localCart[item.item_id.toString()] = cartItem;
          });

          // Normalize cart to ensure preorder items have correct quantities
          const normalizedCart = normalizeCartForPreorder(localCart);
          
          setCart(normalizedCart);
          // Save to storage after loading from backend (with normalized quantities)
          await saveCartToStorage(normalizedCart, backendCart.restaurant_id, backendCart.restaurant_name || '', backendCart.restaurant_logo);
          console.log('[CartContext] Cart loaded successfully:', {
            itemsCount: Object.keys(localCart).length,
            restaurantId: backendCart.restaurant_id,
          });
        } else {
          // Cart exists but is empty
          setCart({});
          await saveCartToStorage({}, null, '', null);
          console.log('[CartContext] Cart is empty');
        }
        return backendCart;
      }
      // Logged-in users: never resurrect AsyncStorage when the server response is unexpected;
      // that caused cleared carts on device A to reappear on device B.
      setCartSummary(null);
      setCart({});
      setRestaurantId(null);
      setRestaurantName('');
      setRestaurantLogo(null);
      await storageService.clearCartData();
      console.log('[CartContext] Backend cart payload invalid — cleared local cart (logged-in)');
      return null;
    } catch (error) {
      if (error instanceof CartFetchError) {
        console.warn('[CartContext] Cart fetch failed; keeping local cart:', error.message);
      } else {
        console.error('[CartContext] Error loading cart from backend:', error);
      }
      // Don't clear cart on error - keep existing state
      return null;
    } finally {
      setIsCartLoaded(true);
    }
  };

  const loadCartFromBackendRef = useRef(loadCartFromBackend);
  loadCartFromBackendRef.current = loadCartFromBackend;

  const reloadCart = () => loadCartFromBackend();

  /**
   * Load cart on app startup
   * First try storage (fast), then sync with backend if authenticated
   */
  useEffect(() => {
    const initializeCart = async () => {
      // First, try to load from storage for immediate UI
      const storedCart = await loadCartFromStorage();
      if (storedCart) {
        setCart(storedCart.cart);
        setRestaurantId(storedCart.restaurantId);
        setRestaurantName(storedCart.restaurantName);
        setRestaurantLogo(storedCart.restaurantLogo);
        console.log('[CartContext] Loaded cart from storage on startup');
      }

      // Then, sync with backend if authenticated
      await loadCartFromBackend();
    };

    initializeCart();
  }, []); // Only run once on mount

  /**
   * When the app returns to foreground, refresh cart for logged-in users so another device
   * clearing or changing the cart is reflected without requiring a full restart.
   */
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const cameToForeground =
        previous.match(/inactive|background/) !== null && next === 'active';
      previous = next;
      if (!cameToForeground) {
        return;
      }
      void (async () => {
        const token = await storageService.getAccessToken();
        if (!token) {
          return;
        }
        if (!(await storageService.isLoggedIn())) {
          return;
        }
        await loadCartFromBackendRef.current();
      })();
    });
    return () => sub.remove();
  }, []);

  /**
   * Save cart to storage whenever it changes (after initial load)
   */
  useEffect(() => {
    if (isCartLoaded) {
      saveCartToStorage(cart, restaurantId, restaurantName, restaurantLogo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, restaurantId, restaurantName, restaurantLogo, isCartLoaded]);

  const revertCartToSnapshot = (
    snapshot: { [key: string]: CartItem },
    itemId: string,
  ) => {
    setCart(prev => {
      const next = { ...prev };
      if (snapshot[itemId]) {
        next[itemId] = snapshot[itemId];
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  /**
   * Add item to cart (local + backend sync)
   */
  const addToCart = async (item: CartItem, overrideRestaurantId?: number) => {
    const normalizedItem = normalizeCartItemQuantities(item);
    const effectiveRestaurantIdForEvent = overrideRestaurantId || restaurantId;
    const eventQuantity = Math.max(
      1,
      getCartItemTotalQuantity(normalizedItem) || normalizedItem.quantity || 1,
    );
    analyticsService.trackEvent(AnalyticsEvents.ADD_TO_CART, {
      restaurant_id: effectiveRestaurantIdForEvent || undefined,
      item_id: normalizedItem.itemId || parseInt(normalizedItem.id, 10),
      price: normalizedItem.price,
      qty: eventQuantity,
      currency: 'INR',
    });

    let prevCartSnapshot: { [key: string]: CartItem } = {};
    setCart(prev => {
      prevCartSnapshot = { ...prev };
      const merged = mergeAddIntoCart(prev, normalizedItem);
      return { ...prev, [merged.id]: merged };
    });

    // Quantity for this single add action (each API call adds this many units)
    const deltaQty = normalizedItem.quantity || getCartItemTotalQuantity(normalizedItem) || 1;

    const token = await storageService.getAccessToken();
    const effectiveRestaurantId = overrideRestaurantId || restaurantId;

    if (!token || !effectiveRestaurantId) {
      return;
    }

    const prevChain = addToCartBackendChainRef.current;
    const backendWork = (async () => {
      await prevChain;
      setSyncWithBackend(true);
      try {
        const backendRequest: AddToCartRequest = {
          restaurant_id: effectiveRestaurantId,
          item_id: normalizedItem.itemId || parseInt(normalizedItem.id, 10),
          quantity: deltaQty,
          special_instructions: normalizedItem.specialInstructions,
        };

        const currentCartWithoutNewItem = { ...prevCartSnapshot };
        delete currentCartWithoutNewItem[normalizedItem.id];
        const cartHasOnlyPreorder = isCartOnlyPreorder(currentCartWithoutNewItem);

        if (normalizedItem.isPreorder === true && cartHasOnlyPreorder) {
          backendRequest.is_preorder = true;
          if (normalizedItem.campaignId) {
            backendRequest.campaign_id = normalizedItem.campaignId;
          }
        }

        if (normalizedItem.isCustomizable && normalizedItem.variants && normalizedItem.variants.length > 0) {
          backendRequest.customizations = normalizedItem.variants.map((variant) => ({
            customization_group_id: parseInt(variant.variantId || '0', 10),
            selected_options: (variant.addOns || []).map(addOnId => ({
              id: parseInt(addOnId, 10),
            })),
          })).filter(c => c.customization_group_id > 0);
        }

        const response = await cartService.addToCart(backendRequest);

        if (response.success) {
          setCartSummary(response.cart_summary || null);
          setCart(prev => {
            const updatedCart = {
              ...prev,
              [normalizedItem.id]: {
                ...prev[normalizedItem.id],
                cartItemId: response.cart_item_id,
              },
            };
            saveCartToStorage(updatedCart, overrideRestaurantId || restaurantId, restaurantName, restaurantLogo);
            return updatedCart;
          });
        } else {
          const error: any = new Error(response.message || 'Failed to add item to cart');
          if ((response as any).statusCode) {
            error.statusCode = (response as any).statusCode;
          } else if ((response as any).status) {
            error.statusCode = (response as any).status;
          }
          throw error;
        }
      } catch (error: any) {
        revertCartToSnapshot(prevCartSnapshot, normalizedItem.id);
        if (error instanceof Error) {
          const errorAny = error as any;
          if (errorAny.statusCode === undefined) {
            const statusCode = errorAny?.status || errorAny?.response?.status;
            if (statusCode !== undefined) {
              errorAny.statusCode = statusCode;
            }
          }
          throw error;
        }
        const newError: any = new Error(error?.message || 'Failed to add item to cart');
        const statusCode = error?.statusCode || error?.status || error?.response?.status;
        if (statusCode !== undefined) {
          newError.statusCode = statusCode;
        }
        throw newError;
      } finally {
        setSyncWithBackend(false);
      }
    })();

    addToCartBackendChainRef.current = backendWork.catch(() => {});
    await backendWork;
  };

  /**
   * Remove item from cart (local + backend sync)
   * Returns cart_summary from API for immediate billing details update
   */
  const removeFromCart = async (itemId: string): Promise<CartSummary | null> => {
    const item = cart[itemId];
    if (item) {
      analyticsService.trackEvent(AnalyticsEvents.REMOVE_FROM_CART, {
        item_id: item.itemId || parseInt(item.id, 10),
      });
    }

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
        return null;
      }

      setSyncWithBackend(true);

      const removeResponse = await cartService.removeCartItem(item.cartItemId);
      setCartSummary(removeResponse.cart_summary || null);
      // Return cart_summary from remove response
      return removeResponse.cart_summary || null;
    } catch (error) {
      // Item already removed from local cart
      return null;
    } finally {
      setSyncWithBackend(false);
    }
  };

  /**
   * Update item quantity (local + backend sync)
   * Returns cart_summary from API for immediate billing details update
   */
  const updateQuantity = async (itemId: string, quantity: number): Promise<CartSummary | null> => {
    const item = cart[itemId];
    if (!item) {
      return null;
    }

    if (quantity <= 0) {
      // If quantity is going to zero or below, cancel any pending debounced updates
      if (updateQuantityTimeoutRef.current) {
        clearTimeout(updateQuantityTimeoutRef.current);
        updateQuantityTimeoutRef.current = null;
      }

      // Clear any pending update for this item
      if (pendingUpdateRef.current && pendingUpdateRef.current.itemId === itemId) {
        pendingUpdateRef.current = null;
      }

      // Abort any in-flight update request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      await removeFromCart(itemId);
      return null;
    }

    // Check if item is preorder and enforce quantity limit of 1
    if (item.isPreorder) {
      if (quantity > 1) {
        // Revert to previous quantity if trying to set > 1 for preorder item
        console.warn(`Preorder items can only have quantity of 1. Item ${itemId} quantity reset to 1.`);
        // Don't update, just return null
        return null;
      }
    }

    const safeQuantity = clampQuantity(quantity);

    // For preorder items, ensure quantity doesn't exceed 1
    const finalQuantity = item.isPreorder ? Math.min(safeQuantity, 1) : safeQuantity;

    if (quantity > MAX_ITEM_QUANTITY && !item.isPreorder) {
      console.warn(`Quantity for item ${itemId} capped at ${MAX_ITEM_QUANTITY}`);
    }

    // Avoid unnecessary updates
    if ((item.quantity || 0) === finalQuantity) {
      return null;
    }

    // Update local cart immediately for responsive UI
    setCart(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: finalQuantity,
      },
    }));

    // Cancel any pending update for this item
    if (updateQuantityTimeoutRef.current) {
      clearTimeout(updateQuantityTimeoutRef.current);
      updateQuantityTimeoutRef.current = null;
    }

    // Cancel any pending API request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Store pending update (previousQuantity used for revert on API failure)
    const previousQuantity = item.quantity || 0;
    pendingUpdateRef.current = { itemId, quantity: finalQuantity, previousQuantity };

    const runPendingUpdate = async (): Promise<CartSummary | null> => {
      const pendingUpdate = pendingUpdateRef.current;
      if (!pendingUpdate || pendingUpdate.itemId !== itemId) {
        return null;
      }
      const currentItem = cart[pendingUpdate.itemId];
      if (!currentItem) {
        pendingUpdateRef.current = null;
        return null;
      }
      const pendingItemId = pendingUpdate.itemId;
      const pendingQuantity = pendingUpdate.quantity;
      const revertQuantity = pendingUpdate.previousQuantity;

      abortControllerRef.current = new AbortController();

      try {
        const token = await storageService.getAccessToken();
        if (!token || !restaurantId) {
          return null;
        }

        if (!currentItem.cartItemId) {
          const backendRequest: AddToCartRequest = {
            restaurant_id: restaurantId,
            item_id: currentItem.itemId || parseInt(currentItem.id, 10),
            quantity: pendingQuantity,
            special_instructions: currentItem.specialInstructions,
          };
          const cartWithoutCurrent = { ...cart };
          delete cartWithoutCurrent[pendingItemId];
          if (currentItem.isPreorder === true && isCartOnlyPreorder(cartWithoutCurrent)) {
            backendRequest.is_preorder = true;
            if (currentItem.campaignId) {
              backendRequest.campaign_id = currentItem.campaignId;
            }
          }
          if (currentItem.isCustomizable && currentItem.variants && currentItem.variants.length > 0) {
            backendRequest.customizations = currentItem.variants.map((variant) => ({
              customization_group_id: parseInt(variant.variantId || '0', 10),
              selected_options: (variant.addOns || []).map(addOnId => ({ id: parseInt(addOnId, 10) })),
            })).filter(c => c.customization_group_id > 0);
          }

          const addResponse = await cartService.addToCart(backendRequest);
          if (addResponse.success && addResponse.cart_item_id) {
            setCartSummary(addResponse.cart_summary || null);
            setCart(prev => {
              const updated = {
                ...prev,
                [currentItem.id]: { ...prev[currentItem.id], cartItemId: addResponse.cart_item_id },
              };
              saveCartToStorage(updated, restaurantId, restaurantName, restaurantLogo);
              return updated;
            });
            return addResponse.cart_summary || null;
          }
          setCart(prev => ({
            ...prev,
            [pendingItemId]: { ...prev[pendingItemId], quantity: revertQuantity },
          }));
          return null;
        }

        setSyncWithBackend(true);
        const updateResponse = await cartService.updateCartItem(currentItem.cartItemId, {
          restaurant_id: restaurantId,
          quantity: pendingQuantity,
        });

        if (!updateResponse.success) {
          setCart(prev => ({
            ...prev,
            [pendingItemId]: { ...prev[pendingItemId], quantity: revertQuantity },
          }));
          const err: any = new Error(updateResponse.error || 'Failed to update cart item');
          err.isCartUpdateError = true;
          throw err;
        }
        setCartSummary(updateResponse.cart_summary || null);
        return updateResponse.cart_summary || null;
      } catch (error: any) {
        setCart(prev => ({
          ...prev,
          [pendingItemId]: { ...prev[pendingItemId], quantity: revertQuantity },
        }));
        if (error?.name === 'AbortError') return null;
        if (error?.isCartUpdateError) throw error;
        return null;
      } finally {
        setSyncWithBackend(false);
        pendingUpdateRef.current = null;
        abortControllerRef.current = null;
      }
    };

    return new Promise<CartSummary | null>((resolve, reject) => {
      updateQuantityTimeoutRef.current = setTimeout(() => {
        runPendingUpdate().then(resolve).catch(reject);
      }, 300);
    });
  };

  /**
   * Run any pending debounced quantity update immediately.
   * Call before navigating to checkout so the backend cart is in sync.
   * Also waits for queued add-to-cart API calls so totals match the server.
   */
  const flushPendingQuantityUpdate = async (): Promise<void> => {
    await addToCartBackendChainRef.current;
    if (updateQuantityTimeoutRef.current) {
      clearTimeout(updateQuantityTimeoutRef.current);
      updateQuantityTimeoutRef.current = null;
    }
    const pending = pendingUpdateRef.current;
    if (!pending) return;
    const currentItem = cart[pending.itemId];
    if (!currentItem) {
      pendingUpdateRef.current = null;
      return;
    }
    abortControllerRef.current = new AbortController();
    try {
      const token = await storageService.getAccessToken();
      if (!token || !restaurantId) {
        pendingUpdateRef.current = null;
        return;
      }
      if (!currentItem.cartItemId) {
        const backendRequest: AddToCartRequest = {
          restaurant_id: restaurantId,
          item_id: currentItem.itemId || parseInt(currentItem.id, 10),
          quantity: pending.quantity,
          special_instructions: currentItem.specialInstructions,
        };
        const cartWithoutCurrent = { ...cart };
        delete cartWithoutCurrent[pending.itemId];
        if (currentItem.isPreorder === true && isCartOnlyPreorder(cartWithoutCurrent)) {
          backendRequest.is_preorder = true;
          if (currentItem.campaignId) backendRequest.campaign_id = currentItem.campaignId;
        }
        if (currentItem.isCustomizable && currentItem.variants?.length) {
          backendRequest.customizations = currentItem.variants.map((v) => ({
            customization_group_id: parseInt(v.variantId || '0', 10),
            selected_options: (v.addOns || []).map((id) => ({ id: parseInt(id, 10) })),
          })).filter(c => c.customization_group_id > 0);
        }
        const addResponse = await cartService.addToCart(backendRequest);
        if (addResponse.success && addResponse.cart_item_id) {
          setCartSummary(addResponse.cart_summary || null);
          setCart(prev => {
            const updated = {
              ...prev,
              [currentItem.id]: { ...prev[currentItem.id], cartItemId: addResponse.cart_item_id },
            };
            saveCartToStorage(updated, restaurantId, restaurantName, restaurantLogo);
            return updated;
          });
        } else {
          setCart(prev => ({
            ...prev,
            [pending.itemId]: { ...prev[pending.itemId], quantity: pending.previousQuantity },
          }));
        }
        pendingUpdateRef.current = null;
        abortControllerRef.current = null;
        return;
      }
      setSyncWithBackend(true);
      const updateResponse = await cartService.updateCartItem(currentItem.cartItemId, {
        restaurant_id: restaurantId,
        quantity: pending.quantity,
      });
      if (!updateResponse.success) {
        setCart(prev => ({
          ...prev,
          [pending.itemId]: { ...prev[pending.itemId], quantity: pending.previousQuantity },
        }));
      } else {
        setCartSummary(updateResponse.cart_summary || null);
      }
    } catch {
      setCart(prev => ({
        ...prev,
        [pending.itemId]: { ...prev[pending.itemId], quantity: pending.previousQuantity },
      }));
    } finally {
      setSyncWithBackend(false);
      pendingUpdateRef.current = null;
      abortControllerRef.current = null;
    }
  };

  /**
   * Clear entire cart
   * @param syncWithBackend - If true, calls CART_CLEAR API. Defaults to true for manual deletions.
   *                          Set to false for payment success/failure (backend handles it).
   */
  const clearCart = async (syncWithBackend: boolean = true) => {
    const preClearValue = Object.values(cart).reduce((sum, item) => {
      if (item.isCustomizable && item.variants) {
        return sum + item.variants.reduce((variantSum, variant) => variantSum + (variant.price * variant.quantity), 0);
      }
      return sum + (item.price * (item.quantity || 0));
    }, 0);
    const preClearItems = Object.values(cart).reduce((sum, item) => {
      if (item.isCustomizable && item.variants) {
        return sum + item.variants.reduce((variantSum, variant) => variantSum + variant.quantity, 0);
      }
      return sum + (item.quantity || 0);
    }, 0);
    if (preClearItems > 0) {
      analyticsService.trackEvent(AnalyticsEvents.CART_ABANDONED, {
        cart_value: preClearValue,
        last_action: syncWithBackend ? 'manual_clear' : 'flow_clear',
        currency: 'INR',
      });
    }

    // Update local cart immediately
    setCart({});
    setCartSummary(null);
    setRestaurantId(null);
    setRestaurantName('');
    setRestaurantLogo(null);
    // Clear from storage
    await storageService.clearCartData();

    // Sync with backend API if requested (for manual deletions, logout, restaurant conflicts)
    if (syncWithBackend) {
      try {
        const token = await storageService.getAccessToken();
        if (!token) {
          return;
        }

        setSyncWithBackend(true);
        await cartService.clearCart();
        setCartSummary(null);
      } catch (error) {
        // Cart already cleared locally
        console.error('[CartContext] Error clearing cart on backend:', error);
      } finally {
        setSyncWithBackend(false);
      }
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
    // If cart is empty, no conflict
    const cartItemCount = Object.keys(cart).length;
    if (cartItemCount === 0) {
      return false;
    }

    if (restaurantId === null) {
      return true;
    }

    // Check if the new restaurant is different from the current one
    return restaurantId !== newRestaurantId;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartSummary,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        reloadCart,
        flushPendingQuantityUpdate,
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
