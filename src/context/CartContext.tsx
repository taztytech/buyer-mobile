import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { cartService, AddToCartRequest, CartSummary } from '@/services/cart.service';
import { storageService } from '@/services/storage.service';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';

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
  addToCart: (item: CartItem, overrideRestaurantId?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<CartSummary | null>;
  updateQuantity: (itemId: string, quantity: number) => Promise<CartSummary | null>;
  clearCart: (syncWithBackend?: boolean) => Promise<void>;
  reloadCart: () => Promise<void>; // Reload cart from backend
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
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantLogo, setRestaurantLogo] = useState<any>(null);
  const [syncWithBackend, setSyncWithBackend] = useState<boolean>(false);
  const [isCartLoaded, setIsCartLoaded] = useState<boolean>(false);
  
  // Refs for debouncing and canceling pending requests
  const updateQuantityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<{ itemId: string; quantity: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const loadCartFromBackend = async () => {
    try {
      const token = await storageService.getAccessToken();
      if (!token) {
        setIsCartLoaded(true);
        return;
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
            // Validate required fields
            if (!item.item_id || !item.item_name) {
              console.warn('[CartContext] Skipping invalid cart item:', item);
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
      } else {
        // No valid cart response - try loading from storage as fallback
        const storedCart = await loadCartFromStorage();
        if (storedCart) {
          // Cart is already normalized in loadCartFromStorage
          setCart(storedCart.cart);
          setRestaurantId(storedCart.restaurantId);
          setRestaurantName(storedCart.restaurantName);
          setRestaurantLogo(storedCart.restaurantLogo);
          console.log('[CartContext] Loaded cart from storage as fallback');
        } else {
          // No cart data anywhere
          setCart({});
          setRestaurantId(null);
          setRestaurantName('');
          setRestaurantLogo(null);
          console.log('[CartContext] No cart data received');
        }
      }
    } catch (error) {
      console.error('[CartContext] Error loading cart from backend:', error);
      // Don't clear cart on error - keep existing state
    } finally {
      setIsCartLoaded(true);
    }
  };

  const reloadCart = async () => {
    await loadCartFromBackend();
  };

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
   * Save cart to storage whenever it changes (after initial load)
   */
  useEffect(() => {
    if (isCartLoaded) {
      saveCartToStorage(cart, restaurantId, restaurantName, restaurantLogo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, restaurantId, restaurantName, restaurantLogo, isCartLoaded]);

  /**
   * Add item to cart (local + backend sync)
   */
  const addToCart = async (item: CartItem, overrideRestaurantId?: number) => {
    const normalizedItem = normalizeCartItemQuantities(item);

      // Update local cart immediately for responsive UI
    setCart(prev => ({
      ...prev,
      [normalizedItem.id]: normalizedItem,
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
        item_id: normalizedItem.itemId || parseInt(normalizedItem.id, 10), // Use itemId if available, fallback to id
        quantity: normalizedItem.quantity || getCartItemTotalQuantity(normalizedItem) || 1,
        special_instructions: normalizedItem.specialInstructions,
      };

      // Check current cart state (excluding the item being added)
      const currentCartWithoutNewItem = { ...cart };
      delete currentCartWithoutNewItem[normalizedItem.id];
      const cartHasOnlyPreorder = isCartOnlyPreorder(currentCartWithoutNewItem);

      // Only include preorder fields if:
      // 1. Item is actually a preorder item
      // 2. Cart contains ONLY preorder items (no normal items mixed in)
      if (normalizedItem.isPreorder === true && cartHasOnlyPreorder) {
        backendRequest.is_preorder = true;
        if (normalizedItem.campaignId) {
          backendRequest.campaign_id = normalizedItem.campaignId;
        }
      }

      // Add customizations if item has variants (customizable items)
      if (normalizedItem.isCustomizable && normalizedItem.variants && normalizedItem.variants.length > 0) {
        // Map frontend variants to backend customizations structure
        backendRequest.customizations = normalizedItem.variants.map((variant) => ({
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
        setCart(prev => {
          const updatedCart = {
            ...prev,
            [normalizedItem.id]: {
              ...prev[normalizedItem.id],
              cartItemId: response.cart_item_id,
            },
          };
          // Save to storage after backend sync
          saveCartToStorage(updatedCart, overrideRestaurantId || restaurantId, restaurantName, restaurantLogo);
          return updatedCart;
        });
      } else {
        // Backend returned an error - remove item from local cart and throw error with status code
        setCart(prev => {
          const newCart = { ...prev };
          delete newCart[normalizedItem.id];
          return newCart;
        });
        const error: any = new Error(response.message || 'Failed to add item to cart');
        // Preserve status code if available in response
        if ((response as any).statusCode) {
          error.statusCode = (response as any).statusCode;
        } else if ((response as any).status) {
          error.statusCode = (response as any).status;
        }
        throw error;
      }
    } catch (error: any) {
      // If error is already thrown from above, re-throw it (it should have statusCode preserved)
      if (error instanceof Error) {
        // Preserve statusCode if it exists
        const errorAny = error as any;
        if (errorAny.statusCode !== undefined) {
          throw error;
        }
        // If error doesn't have statusCode, try to extract it
        const statusCode = errorAny?.statusCode || errorAny?.status || errorAny?.response?.status;
        if (statusCode !== undefined) {
          errorAny.statusCode = statusCode;
        }
        throw error;
      }
      // For other errors, remove item from local cart and throw
      setCart(prev => {
        const newCart = { ...prev };
        delete newCart[normalizedItem.id];
        return newCart;
      });
      const newError: any = new Error(error?.message || 'Failed to add item to cart');
      // Preserve statusCode if available
      const statusCode = error?.statusCode || error?.status || error?.response?.status;
      if (statusCode !== undefined) {
        newError.statusCode = statusCode;
      }
      throw newError;
    } finally {
      setSyncWithBackend(false);
    }
  };

  /**
   * Remove item from cart (local + backend sync)
   * Returns cart_summary from API for immediate billing details update
   */
  const removeFromCart = async (itemId: string): Promise<CartSummary | null> => {
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
        return null;
      }

      setSyncWithBackend(true);

      const removeResponse = await cartService.removeCartItem(item.cartItemId);
      
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

    // Store pending update
    pendingUpdateRef.current = { itemId, quantity: finalQuantity };

    return new Promise<CartSummary | null>((resolve, reject) => {
      updateQuantityTimeoutRef.current = setTimeout(async () => {
        const pendingUpdate = pendingUpdateRef.current;
        if (!pendingUpdate || pendingUpdate.itemId !== itemId) {
          resolve(null);
          return;
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        try {
          const token = await storageService.getAccessToken();

          if (!token || !restaurantId) {
            resolve(null);
            return;
          }

          // If item doesn't have cartItemId, add it to backend first
          if (!item?.cartItemId) {
            // Prepare backend request
            const backendRequest: AddToCartRequest = {
              restaurant_id: restaurantId,
              item_id: item.itemId || parseInt(item.id, 10),
              quantity: finalQuantity,
              special_instructions: item.specialInstructions,
            };

            // Check if cart contains only preorder items (excluding current item being updated)
            const cartWithoutCurrentItem = { ...cart };
            delete cartWithoutCurrentItem[itemId];
            const cartHasOnlyPreorder = isCartOnlyPreorder(cartWithoutCurrentItem);

            // Only include preorder fields if:
            // 1. Item is actually a preorder item
            // 2. Cart contains ONLY preorder items (no normal items mixed in)
            if (item.isPreorder === true && cartHasOnlyPreorder) {
              backendRequest.is_preorder = true;
              if (item.campaignId) {
                backendRequest.campaign_id = item.campaignId;
              }
            }

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
              setCart(prev => {
                const updatedCart = {
                  ...prev,
                  [item.id]: {
                    ...prev[item.id],
                    cartItemId: addResponse.cart_item_id,
                  },
                };
                // Save to storage after backend sync
                saveCartToStorage(updatedCart, restaurantId, restaurantName, restaurantLogo);
                return updatedCart;
              });
              // Return cart_summary from add response
              resolve(addResponse.cart_summary || null);
              return;
            } else {
              // Revert local cart change on failure
              setCart(prev => ({
                ...prev,
                [itemId]: {
                  ...prev[itemId],
                  quantity: item.quantity || 0,
                },
              }));
              resolve(null);
              return;
            }
          }

          setSyncWithBackend(true);

          // Update existing cart item - do NOT pass is_preorder or campaign_id
          // These fields are only sent when adding new items via addToCart API
          const updateResponse = await cartService.updateCartItem(item.cartItemId, {
            restaurant_id: restaurantId,
            quantity: finalQuantity,
          });

          // If update failed, reject promise with error message so it can be displayed
          if (!updateResponse.success) {
            // Revert local cart change on failure
            setCart(prev => ({
              ...prev,
              [itemId]: {
                ...prev[itemId],
                quantity: item.quantity || 0,
              },
            }));
            
            const errorMessage = updateResponse.error || 'Failed to update cart item';
            const error: any = new Error(errorMessage);
            error.isCartUpdateError = true;
            reject(error);
            return;
          }

          // Return cart_summary from update response
          resolve(updateResponse.cart_summary || null);
        } catch (error: any) {
          // Revert local cart change on error
          setCart(prev => ({
            ...prev,
            [itemId]: {
              ...prev[itemId],
              quantity: item.quantity || 0,
            },
          }));
          
          // If request was aborted, don't treat as error
          if (error?.name === 'AbortError') {
            resolve(null);
            return;
          }
          
          // Reject with cart update errors so they can be caught and displayed in the UI
          if (error?.isCartUpdateError) {
            reject(error);
            return;
          }
          
          // For other errors, just resolve with null (local cart already reverted)
          resolve(null);
        } finally {
          setSyncWithBackend(false);
          pendingUpdateRef.current = null;
          abortControllerRef.current = null;
        }
      }, 300); // 300ms debounce delay
    });
  };

  /**
   * Clear entire cart
   * @param syncWithBackend - If true, calls CART_CLEAR API. Defaults to true for manual deletions.
   *                          Set to false for payment success/failure (backend handles it).
   */
  const clearCart = async (syncWithBackend: boolean = true) => {
    // Update local cart immediately
    setCart({});
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
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        reloadCart,
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
