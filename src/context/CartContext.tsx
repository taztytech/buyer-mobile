import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartVariant {
  variantId: string;
  variantName: string;
  quantity: number;
  price: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  isVeg: boolean;
  image?: string;
  isCustomizable?: boolean;
  variants?: CartVariant[];
}

interface CartContextType {
  cart: { [key: string]: CartItem };
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  restaurantId: number | null;
  restaurantName: string;
  restaurantLogo: any;
  setRestaurantInfo: (id: number, name: string, logo?: any) => void;
  checkRestaurantConflict: (newRestaurantId: number) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantLogo, setRestaurantLogo] = useState<any>(null);

  const addToCart = (item: CartItem) => {
    setCart(prev => ({
      ...prev,
      [item.id]: item,
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[itemId];
      return newCart;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          quantity,
        },
      }));
    }
  };

  const clearCart = () => {
    setCart({});
    setRestaurantId(null);
    setRestaurantName('');
    setRestaurantLogo(null);
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
