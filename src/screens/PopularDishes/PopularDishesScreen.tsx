import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { homeService } from '@/services/home.service';
import { Shimmer } from '@/components/Shimmer';
import { favoritesService } from '@/services/favorites.service';
import { API_CONFIG, buildApiUrl } from '@/config/api.config';
import { useCart } from '@/context/CartContext';
import { addressService } from '@/services/address.service';
import { useVegMode } from '@/context/VegModeContext';

interface PopularDishRowItem {
  id: string;
  restaurantId?: number;
  storeId?: number;
  storeName?: string;
  storeLogoUrl?: string;
  name: string;
  subtitle: string;
  priceLabel?: string;
  basePrice?: number;
  description?: string;
  locality?: string;
  eta?: string;
  imageUrl?: string;
  cuisineTags?: string;
  rating?: number;
  distanceKm?: number;
  isVeg?: boolean;
  isStoreOpen: boolean;
  showAddButton: boolean;
  isFavorite?: boolean;
  isItemAvailable?: boolean;
}

type HomeCollectionType = 'store' | 'item' | 'unknown';

interface PopularDishesScreenProps {
  onBack?: () => void;
  onNavigateToRestaurant?: (
    restaurantId: number,
    restaurantName: string,
    meta?: { targetItemId?: string; targetItemName?: string }
  ) => void;
  onNavigateToCheckout?: (restaurantId: number, restaurantName: string, restaurantAddress?: string, from?: 'home' | 'restaurant') => void;
  selectedLocation?: { latitude?: number; longitude?: number };
  selectedCollectionId?: number;
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

const mapHomeCollectionItem = (
  item: any,
  index: number,
  showAddButton: boolean,
  isStoreOpen: boolean,
  selectedLocation?: { latitude?: number; longitude?: number }
): PopularDishRowItem => {
  const imageUrl =
    item?.image_url ||
    item?.image ||
    item?.thumbnail ||
    item?.thumbnail_url ||
    item?.collection_image ||
    (Array.isArray(item?.images) && item.images.length > 0 ? item.images[0] : undefined);
  const basePriceRaw = item?.price?.base_price ?? item?.base_price;
  const basePrice = typeof basePriceRaw === 'number' ? basePriceRaw : Number(basePriceRaw);
  const currency = String(item?.price?.currency || 'INR').toUpperCase();
  const priceLabel = Number.isFinite(basePrice)
    ? currency === 'INR'
      ? `₹${basePrice.toFixed(2)}`
      : `${currency} ${basePrice.toFixed(2)}`
    : undefined;
  const sourceName =
    item?.store_name ||
    item?.store?.name ||
    item?.restaurant_name ||
    item?.restaurant?.name;
  const locality =
    item?.store?.location?.locality ||
    item?.location?.locality ||
    item?.locality ||
    'chinna chokkikulam';
  const eta =
    item?.delivery_time ||
    item?.eta ||
    '30-35 mins';
  const cuisineTags =
    item?.cuisine_tags ||
    item?.cuisines ||
    item?.store?.cuisine_tags ||
    '';
  const distanceRaw = item?.distance ?? item?.store?.distance;
  const ratingRaw = item?.rating ?? item?.store?.rating;
  const rating = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw);
  const parsedDistanceKm = typeof distanceRaw === 'number' ? distanceRaw : Number(distanceRaw);
  const locationLatRaw = item?.location?.lat ?? item?.store?.location?.lat;
  const locationLngRaw = item?.location?.lng ?? item?.store?.location?.lng;
  const locationLat = typeof locationLatRaw === 'number' ? locationLatRaw : Number(locationLatRaw);
  const locationLng = typeof locationLngRaw === 'number' ? locationLngRaw : Number(locationLngRaw);
  const userLat = selectedLocation?.latitude;
  const userLng = selectedLocation?.longitude;
  const calculatedDistanceKm =
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    Number.isFinite(locationLat) &&
    Number.isFinite(locationLng)
      ? (() => {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const dLat = toRad(locationLat - (userLat as number));
          const dLng = toRad(locationLng - (userLng as number));
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(userLat as number)) *
              Math.cos(toRad(locationLat)) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return 6371 * c;
        })()
      : NaN;
  const distanceKm = Number.isFinite(parsedDistanceKm) ? parsedDistanceKm : calculatedDistanceKm;
  const storeIdRaw = item?.store_id ?? item?.store?.id;
  const storeId = typeof storeIdRaw === 'number' ? storeIdRaw : Number(storeIdRaw);
  const dietaryPreference = String(item?.dietary_preference || '').trim().toLowerCase();
  const isVeg =
    dietaryPreference === 'veg' ||
    dietaryPreference === 'vegetarian' ||
    dietaryPreference === 'pure-veg';

  return {
    id: String(item?.id ?? `collection-${index}`),
    restaurantId: Number.isFinite(Number(item?.id)) ? Number(item?.id) : undefined,
    storeId: Number.isFinite(storeId) ? storeId : undefined,
    storeName:
      typeof item?.store_name === 'string' && item.store_name.trim().length > 0
        ? item.store_name.trim()
        : typeof item?.store?.name === 'string' && item.store.name.trim().length > 0
          ? item.store.name.trim()
          : undefined,
    storeLogoUrl:
      typeof item?.store?.logo_url === 'string' && item.store.logo_url.trim().length > 0
        ? item.store.logo_url.trim()
        : undefined,
    name: String(item?.name || item?.title || `Food Item ${index + 1}`),
    subtitle:
      typeof sourceName === 'string' && sourceName.trim().length > 0
        ? `by ${sourceName.trim()}`
        : 'by Hotel',
    priceLabel,
    basePrice: Number.isFinite(basePrice) ? basePrice : undefined,
    description:
      typeof item?.long_desc === 'string' && item.long_desc.trim().length > 0
        ? item.long_desc.trim()
        : typeof item?.short_desc === 'string' && item.short_desc.trim().length > 0
          ? item.short_desc.trim()
          : '',
    locality: typeof locality === 'string' && locality.trim().length > 0 ? locality.trim() : 'chinna chokkikulam',
    eta: typeof eta === 'string' && eta.trim().length > 0 ? eta.trim() : '30-35 mins',
    imageUrl: typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? imageUrl : undefined,
    cuisineTags: typeof cuisineTags === 'string' && cuisineTags.trim().length > 0 ? cuisineTags.trim() : undefined,
    rating: Number.isFinite(rating) ? rating : undefined,
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : undefined,
    isVeg,
    isStoreOpen,
    showAddButton,
    isFavorite: Boolean(item?.is_favorite),
    isItemAvailable: item?.is_available !== false,
  };
};

export const PopularDishesScreen: React.FC<PopularDishesScreenProps> = ({
  onBack,
  onNavigateToRestaurant,
  selectedLocation,
  selectedCollectionId,
  isGuest = false,
  onNavigateToLogin,
}) => {
  const insets = useSafeAreaInsets();
  const { addToCart, setRestaurantInfo, checkRestaurantConflict, clearCart } = useCart();
  const { vegMode } = useVegMode();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [items, setItems] = React.useState<PopularDishRowItem[]>([]);
  const [headerTitle, setHeaderTitle] = React.useState('All Food Items');
  const [headerDescription, setHeaderDescription] = React.useState('');
  const [collectionBannerImageUrl, setCollectionBannerImageUrl] = React.useState<string | null>(null);
  const [homeCollectionType, setHomeCollectionType] = React.useState<HomeCollectionType>('unknown');
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeDietaryFilter, setActiveDietaryFilter] = React.useState<'veg' | 'non-veg' | null>(null);

  const visibleItems = React.useMemo(() => {
    const normalizeText = (value: string) => {
      return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

    const query = normalizeText(searchQuery);
    if (!query) return [];

    const queryTokens = query.split(' ').filter(Boolean);

    return items.filter((item) => {
      const haystack = normalizeText(
        [
          item.name || '',
          item.subtitle || '',
          item.locality || '',
          item.description || '',
          item.storeName || '',
          item.cuisineTags || '',
        ].join(' ')
      );

      if (haystack.includes(query)) {
        return true;
      }

      // Keep search forgiving for partial multi-word inputs.
      return queryTokens.some((token) => haystack.includes(token));
    });
  }, [items, searchQuery]);

  const filteredItems = React.useMemo(() => {
    if (activeDietaryFilter === 'veg') {
      return items.filter((item) => item.isVeg === true);
    }
    if (activeDietaryFilter === 'non-veg') {
      return items.filter((item) => item.isVeg === false);
    }
    return items;
  }, [activeDietaryFilter, items]);

  const resolveCollectionType = React.useCallback((rawType: any): HomeCollectionType => {
    const typeStr = String(rawType || '').toLowerCase();
    return typeStr === 'store' ? 'store' : typeStr === 'item' ? 'item' : 'unknown';
  }, []);

  const fetchItems = React.useCallback(async (refresh: boolean = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      let lat = selectedLocation?.latitude;
      let lng = selectedLocation?.longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        try {
          const addressResponse = await addressService.getAddresses();
          if (addressResponse.success && Array.isArray(addressResponse.data)) {
            const defaultAddress = addressResponse.data.find((addr: any) => addr?.is_default);
            if (defaultAddress) {
              const resolvedLat = Number(defaultAddress.latitude);
              const resolvedLng = Number(defaultAddress.longitude);
              if (Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng)) {
                lat = resolvedLat;
                lng = resolvedLng;
              }
            }
          }
        } catch {
          // Keep lat/lng as-is when address fetch fails.
        }
      }
      const homeParams = new URLSearchParams();
      if (typeof lat === 'number' && typeof lng === 'number') {
        homeParams.append('latitude', lat.toString());
        homeParams.append('longitude', lng.toString());
      }
      const homeRequestUrl = `${buildApiUrl(API_CONFIG.ENDPOINTS.BUYER.HOME)}${homeParams.toString() ? `?${homeParams.toString()}` : ''}`;
      console.log('[PopularDishesScreen] REQUEST /api/buyer/home', {
        url: homeRequestUrl,
        lat,
        lng,
      });
      const homeResponse = await homeService.getHomeData(lat, lng);
      console.log('[PopularDishesScreen] RESPONSE /api/buyer/home', {
        endpoint: '/api/buyer/home',
        lat,
        lng,
        response: homeResponse,
      });
      if (homeResponse.success && homeResponse.data) {
        const actualData = (homeResponse.data as any).data || homeResponse.data;
        const collectionSection = (actualData as any)?.home_collection;
        const collectionData = collectionSection?.collection;
        const fallbackCollectionItems = Array.isArray(collectionSection?.data) ? collectionSection.data : [];
        const nearbyRestaurants = Array.isArray((actualData as any)?.nearby_restaurants)
          ? (actualData as any).nearby_restaurants
          : [];
        const storeOpenById = new Map<number, boolean>();
        const storeOpenByName = new Map<string, boolean>();
        nearbyRestaurants.forEach((restaurant: any) => {
          const rId = Number(restaurant?.id);
          if (Number.isFinite(rId)) {
            storeOpenById.set(rId, Boolean(restaurant?.is_open));
          }
          const rName = typeof restaurant?.name === 'string' ? restaurant.name.trim().toLowerCase() : '';
          if (rName.length > 0) {
            storeOpenByName.set(rName, Boolean(restaurant?.is_open));
          }
        });
        const collectionTitle =
          collectionData?.display_title ||
          collectionData?.title ||
          collectionData?.name;
        const collectionDescription =
          collectionData?.description ||
          collectionData?.display_description ||
          '';
        const collectionImageUrl =
          collectionData?.banner_image_url ||
          collectionData?.banner_url ||
          collectionData?.background_image_url ||
          collectionData?.image_url;
        const resolvedCollectionType = resolveCollectionType(
          collectionData?.type || fallbackCollectionItems[0]?.type
        );
        setHomeCollectionType(resolvedCollectionType);

        setHeaderTitle(
          typeof collectionTitle === 'string' && collectionTitle.trim().length > 0
            ? collectionTitle.trim()
            : 'All Food Items'
        );
        setHeaderDescription(
          typeof collectionDescription === 'string' ? collectionDescription.trim() : ''
        );
        setCollectionBannerImageUrl(
          typeof collectionImageUrl === 'string' && collectionImageUrl.trim().length > 0
            ? collectionImageUrl.trim()
            : null
        );

        const effectiveCollectionId =
          typeof selectedCollectionId === 'number'
            ? selectedCollectionId
            : collectionData?.id;
        const collectionItemsParams = new URLSearchParams();
        collectionItemsParams.append('page', '1');
        if (typeof lat === 'number') {
          collectionItemsParams.append('lat', lat.toString());
        }
        if (typeof lng === 'number') {
          collectionItemsParams.append('lng', lng.toString());
        }
        if (vegMode === 'all' || vegMode === 'pure') {
          collectionItemsParams.append('veg_mode', vegMode);
        }
        const collectionItemsRequestUrl =
          effectiveCollectionId != null
            ? `${buildApiUrl(API_CONFIG.ENDPOINTS.BUYER.COLLECTION_ITEMS(effectiveCollectionId))}?${collectionItemsParams.toString()}`
            : null;

        console.log('[PopularDishesScreen] REQUEST /api/buyer/collections/:id/items', {
          url: collectionItemsRequestUrl,
          collectionId: effectiveCollectionId,
          page: 1,
          lat,
          lng,
        });
        console.log('[PopularDishesScreen] VIEW_ALL_API_ENDPOINT', collectionItemsRequestUrl);
        const itemsResponse =
          effectiveCollectionId != null
            ? await homeService.getCollectionItems(
                effectiveCollectionId,
                1,
                lat,
                lng,
                vegMode === 'all' || vegMode === 'pure' ? vegMode : undefined
              )
            : null;
        console.log('[PopularDishesScreen] RESPONSE /api/buyer/collections/:id/items', {
          url: collectionItemsRequestUrl,
          collectionId: effectiveCollectionId,
          response: itemsResponse,
        });
        console.log(
          '[PopularDishesScreen] VIEW_ALL_COLLECTION_RESPONSE_JSON',
          JSON.stringify(itemsResponse, null, 2)
        );

        const itemsFromCollectionApi =
          itemsResponse?.success && Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
        const finalItems = itemsFromCollectionApi.length > 0 ? itemsFromCollectionApi : fallbackCollectionItems;

        if (Array.isArray(finalItems) && finalItems.length > 0) {
          const mappedItems = finalItems.map((item: any, index: number) =>
              mapHomeCollectionItem(
                item,
                index,
                resolvedCollectionType === 'item',
                (() => {
                  if (typeof item?.is_open === 'boolean') {
                    return item.is_open;
                  }
                  if (typeof item?.store?.is_open === 'boolean') {
                    return item.store.is_open;
                  }
                  const sId = Number(item?.store_id ?? item?.store?.id);
                  if (Number.isFinite(sId) && storeOpenById.has(sId)) {
                    return Boolean(storeOpenById.get(sId));
                  }
                  const sName = typeof item?.store_name === 'string'
                    ? item.store_name.trim().toLowerCase()
                    : typeof item?.store?.name === 'string'
                      ? item.store.name.trim().toLowerCase()
                      : '';
                  if (sName.length > 0 && storeOpenByName.has(sName)) {
                    return Boolean(storeOpenByName.get(sName));
                  }
                  return true;
                })(),
                {
                  latitude: selectedLocation?.latitude,
                  longitude: selectedLocation?.longitude,
                }
              )
            );
          setItems(
            mappedItems.map((dish) =>
              (() => {
                const favoriteKey = String(dish.restaurantId ?? dish.storeId ?? dish.id);
                const override =
                  resolvedCollectionType === 'store'
                    ? favoritesService.getRestaurantFavoriteOverride(favoriteKey)
                    : favoritesService.getItemFavoriteOverride(dish.id);
                return typeof override === 'boolean' ? { ...dish, isFavorite: override } : dish;
              })()
            )
          );
        } else {
          setItems([]);
        }
      } else {
        setHeaderTitle('All Food Items');
        setHeaderDescription('');
        setCollectionBannerImageUrl(null);
        setHomeCollectionType('unknown');
        setItems([]);
      }
    } finally {
      if (refresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [resolveCollectionType, selectedCollectionId, selectedLocation?.latitude, selectedLocation?.longitude, vegMode]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItemToCart = React.useCallback(async (item: PopularDishRowItem) => {
    if (isGuest && onNavigateToLogin) {
      onNavigateToLogin();
      return;
    }

    if (item.isItemAvailable === false) {
      return;
    }

    if (!item.storeId) {
      console.log('[PopularDishesScreen] add skipped: missing storeId', item);
      return;
    }

    const hasConflict = checkRestaurantConflict(item.storeId);
    if (hasConflict) {
      await clearCart();
    }

    const restaurantName = item.storeName || 'Restaurant';
    setRestaurantInfo(item.storeId, restaurantName, item.storeLogoUrl || undefined);

    const numericItemId = Number(item.id);
    if (!Number.isFinite(numericItemId) || numericItemId <= 0) {
      console.log('[PopularDishesScreen] add skipped: invalid item id', {
        itemId: item.id,
        item,
      });
      return;
    }

    await addToCart(
      {
        id: item.id,
        itemId: numericItemId,
        name: item.name,
        price: item.basePrice ?? 0,
        quantity: 1,
        isVeg: Boolean(item.isVeg),
        image: item.imageUrl,
        isCustomizable: false,
      },
      item.storeId
    );

    // Navigate only after add succeeds to avoid false "added" perception.
    if (onNavigateToRestaurant) {
      onNavigateToRestaurant(item.storeId, restaurantName, {
        targetItemId: item.id,
        targetItemName: item.name,
      });
    }
  }, [addToCart, checkRestaurantConflict, clearCart, isGuest, onNavigateToLogin, onNavigateToRestaurant, setRestaurantInfo]);

  const handleToggleFavorite = React.useCallback(async (item: PopularDishRowItem) => {
    if (isGuest && onNavigateToLogin) {
      onNavigateToLogin();
      return;
    }

    const previousIsFavorite = Boolean(item.isFavorite);
    const nextIsFavorite = !previousIsFavorite;
    const favoriteEntityId =
      homeCollectionType === 'store'
        ? (item.restaurantId ?? item.storeId ?? item.id)
        : item.id;
    if (homeCollectionType === 'store') {
      favoritesService.setRestaurantFavoriteOverride(favoriteEntityId, nextIsFavorite);
    } else {
      favoritesService.setItemFavoriteOverride(favoriteEntityId, nextIsFavorite);
    }
    setItems((prev) =>
      prev.map((dish) =>
        dish.id === item.id ? { ...dish, isFavorite: nextIsFavorite } : dish
      )
    );

    try {
      console.log('[PopularDishesScreen] wishlist toggle request', {
        collectionType: homeCollectionType,
        itemId: item.id,
        favoriteEntityId,
        nextIsFavorite,
      });
      const response =
        homeCollectionType === 'store'
          ? await favoritesService.toggleFavoriteRestaurant(
              item.restaurantId ?? item.storeId ?? item.id
            )
          : await favoritesService.toggleFavoriteItem(item.id);
      console.log('[PopularDishesScreen] wishlist toggle response', {
        collectionType: homeCollectionType,
        itemId: item.id,
        favoriteEntityId,
        response,
      });
      if (!response.success) {
        if (homeCollectionType === 'store') {
          favoritesService.setRestaurantFavoriteOverride(favoriteEntityId, previousIsFavorite);
        } else {
          favoritesService.setItemFavoriteOverride(favoriteEntityId, previousIsFavorite);
        }
        setItems((prev) =>
          prev.map((dish) =>
            dish.id === item.id ? { ...dish, isFavorite: previousIsFavorite } : dish
          )
        );
      }
    } catch {
      if (homeCollectionType === 'store') {
        favoritesService.setRestaurantFavoriteOverride(favoriteEntityId, previousIsFavorite);
      } else {
        favoritesService.setItemFavoriteOverride(favoriteEntityId, previousIsFavorite);
      }
      setItems((prev) =>
        prev.map((dish) =>
          dish.id === item.id ? { ...dish, isFavorite: previousIsFavorite } : dish
        )
      );
    }
  }, [homeCollectionType, isGuest, onNavigateToLogin]);

  React.useEffect(() => {
    const unsubscribe = favoritesService.subscribeToItemFavoriteChanges((itemId, isFavorite) => {
      setItems((prev) =>
        prev.map((dish) => (dish.id === itemId ? { ...dish, isFavorite } : dish))
      );
    });
    const unsubscribeRestaurant = favoritesService.subscribeToRestaurantFavoriteChanges(
      (restaurantId, isFavorite) => {
        setItems((prev) =>
          prev.map((dish) =>
            String(dish.restaurantId ?? dish.storeId ?? dish.id) === restaurantId
              ? { ...dish, isFavorite }
              : dish
          )
        );
      }
    );
    return () => {
      unsubscribe();
      unsubscribeRestaurant();
    };
  }, []);

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonPage}>
      <View style={styles.skeletonSectionTitleWrap}>
        <Shimmer width={148} height={22} borderRadius={6} backgroundColor="#E8E8E8" />
        <Shimmer width={26} height={26} borderRadius={13} backgroundColor="#E8E8E8" />
      </View>
      <View style={styles.skeletonList}>
        {[0, 1, 2].map((row) => (
          <View key={`popular-skeleton-${row}`} style={styles.skeletonCard}>
            <View style={styles.skeletonContent}>
              <Shimmer width="72%" height={20} borderRadius={6} backgroundColor="#E8E8E8" />
              <Shimmer width="58%" height={18} borderRadius={6} backgroundColor="#E8E8E8" style={styles.skeletonGapSmall} />
              <Shimmer width="38%" height={14} borderRadius={6} backgroundColor="#E8E8E8" style={styles.skeletonGapSmall} />
              <Shimmer width="64%" height={14} borderRadius={6} backgroundColor="#E8E8E8" style={styles.skeletonGapSmall} />
            </View>
            <Shimmer width={156} height={120} borderRadius={16} backgroundColor="#E8E8E8" />
          </View>
        ))}
      </View>
    </View>
  );

  const renderItemContent = (item: PopularDishRowItem) => {
    const isItemUnavailable = item.isItemAvailable === false;
    return homeCollectionType === 'store' ? (
      <>
        <View style={styles.storeImageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={[styles.storeImage, !item.isStoreOpen && styles.imageClosed]}
              resizeMode="cover"
              blurRadius={!item.isStoreOpen ? 2 : 0}
            />
          ) : (
            <View style={[styles.storeImage, styles.imageFallback, !item.isStoreOpen && styles.imageClosed]}>
              <MaterialIcons name="restaurant-menu" size={24} color="#9CA3AF" />
            </View>
          )}
          {!item.isStoreOpen && <View pointerEvents="none" style={styles.disabledImageOverlayStore} />}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.wishlistButton}
            onPress={() => {
              handleToggleFavorite(item).catch(() => {});
            }}
          >
            <MaterialIcons
              name={item.isFavorite ? 'favorite' : 'favorite-border'}
              size={24}
              color={item.isFavorite ? '#FF0000' : '#FFFFFF'}
            />
          </TouchableOpacity>
          {!item.isStoreOpen && (
            <View style={styles.closedStatusRow}>
              <MaterialIcons name="access-time" size={14} color="#FFFFFF" />
              <Text style={styles.closedStatusText} numberOfLines={1}>
                Currently closed
              </Text>
            </View>
          )}
          {item.showAddButton && item.isStoreOpen && item.isItemAvailable !== false && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.addButton}
              onPress={() => {
                handleAddItemToCart(item).catch((error) => {
                  console.log('[PopularDishesScreen] add item failed:', error);
                });
              }}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          )}
          {item.showAddButton && item.isItemAvailable === false && (
            <View pointerEvents="none" style={styles.storeAvailabilityBar}>
              <Text style={styles.storeAvailabilityText}>
                Not available
              </Text>
            </View>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ratingEtaRow}>
            {typeof item.rating === 'number' && item.rating > 0 ? (
              <>
                <MaterialIcons name="star" size={14} color="#00B14F" />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                <Text style={styles.ratingEtaDot}>•</Text>
              </>
            ) : null}
            <Text style={styles.storeEtaText} numberOfLines={1}>{item.eta || '20-25 mins'}</Text>
          </View>
          <Text style={styles.storeCuisineText} numberOfLines={1}>{item.cuisineTags || 'South Indian'}</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.locality || 'Location unavailable'}
          </Text>
          <View style={styles.distanceRow}>
            <MaterialIcons name="place" size={16} color="#00B14F" />
            <Text style={styles.distanceText}>
              {typeof item.distanceKm === 'number' ? `${item.distanceKm.toFixed(2)}Kms` : '--'}
            </Text>
          </View>
        </View>
      </>
    ) : (
      <>
        <View style={styles.content}>
          <View style={[styles.foodTypeBadge, item.isVeg ? styles.foodTypeBadgeVeg : styles.foodTypeBadgeNonVeg]}>
            <View style={[styles.foodTypeInnerDot, item.isVeg ? styles.foodTypeInnerDotVeg : styles.foodTypeInnerDotNonVeg]} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.subtitle ? (
            <Text style={styles.byHotelText} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
          {item.priceLabel ? <Text style={styles.price}>{item.priceLabel}</Text> : null}
        </View>
        <View style={styles.imageContainer}>
          <View style={styles.itemImageClip}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={[styles.itemImage, isItemUnavailable && styles.imageClosed]}
                resizeMode="cover"
                blurRadius={isItemUnavailable ? 2 : 0}
              />
            ) : (
              <View style={[styles.itemImage, styles.imageFallback]}>
                <MaterialIcons name="restaurant-menu" size={24} color="#9CA3AF" />
              </View>
            )}
            {isItemUnavailable && (
              <View pointerEvents="none" style={styles.disabledImageOverlayItem} />
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.wishlistButton}
              onPress={() => {
                handleToggleFavorite(item).catch(() => {});
              }}
            >
              <MaterialIcons
                name={item.isFavorite ? 'favorite' : 'favorite-border'}
                size={24}
                color={item.isFavorite ? '#FF0000' : '#FFFFFF'}
              />
            </TouchableOpacity>
            {item.showAddButton && isItemUnavailable && (
              <View pointerEvents="none" style={styles.itemAvailabilityBar}>
                <Text style={styles.itemAvailabilityText}>
                  Not available
                </Text>
              </View>
            )}
          </View>
          {item.showAddButton && !isItemUnavailable && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.itemAddButton}
              onPress={() => {
                handleAddItemToCart(item).catch((error) => {
                  console.log('[PopularDishesScreen] add item failed:', error);
                });
              }}
            >
              <Text style={styles.itemAddButtonText}>+Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    )
  };

  const renderItem = ({ item }: { item: PopularDishRowItem }) => {
    if (homeCollectionType === 'store') {
      return (
        <TouchableOpacity
          activeOpacity={item.isStoreOpen ? 0.8 : 1}
          style={styles.card}
          disabled={!item.isStoreOpen}
          onPress={() => {
            if (item.isStoreOpen && item.restaurantId && onNavigateToRestaurant) {
              onNavigateToRestaurant(item.restaurantId, item.name);
            }
          }}
        >
          {renderItemContent(item)}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.card}>
        {renderItemContent(item)}
      </View>
    );
  };

  const renderTopHeader = () => {
    if (isLoading) {
      return (
        <View style={styles.heroWrap}>
          <Shimmer width="100%" height="100%" borderRadius={20} backgroundColor="#DCDCDC" />
          <View style={[styles.heroBackButton, { top: insets.top + 12 }]}>
            <MaterialIcons name="chevron-left" size={24} color="#9CA3AF" />
          </View>
          <View style={styles.heroInfoCard}>
            <Shimmer width="62%" height={22} borderRadius={6} backgroundColor="#E8E8E8" />
            <Shimmer width="100%" height={1} borderRadius={0} backgroundColor="#D1D5DB" style={styles.heroSkeletonDivider} />
            <View style={styles.heroSkeletonBottomRow}>
              <Shimmer width="35%" height={16} borderRadius={6} backgroundColor="#E8E8E8" />
              <Shimmer width="24%" height={16} borderRadius={6} backgroundColor="#E8E8E8" />
            </View>
          </View>
        </View>
      );
    }

    if (collectionBannerImageUrl) {
      return (
        <View style={styles.heroWrap}>
          <Image source={{ uri: collectionBannerImageUrl }} style={styles.heroImage} resizeMode="cover" />
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.heroBackButton, { top: insets.top + 12 }]}
          >
            <MaterialIcons name="chevron-left" size={24} color="#0F3D35" />
          </TouchableOpacity>
          <View style={styles.heroInfoCard}>
            <Text style={styles.heroInfoTitle} numberOfLines={1}>{headerTitle}</Text>
            {headerDescription.length > 0 ? (
              <Text style={styles.heroInfoDescription} numberOfLines={2}>
                {headerDescription}
              </Text>
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <TouchableOpacity
          onPress={() => setShowSearch(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerRightSpacer}
        >
          <MaterialIcons name="search" size={22} color="#111827" />
        </TouchableOpacity>
      </View>
    );
  };

  if (showSearch) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={[styles.searchScreenHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.searchBackButton}
          >
            <MaterialIcons name="chevron-left" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.searchInputWrap}>
            <MaterialIcons name="search" size={20} color="#22C55E" />
            <TextInput
              value={searchQuery}
              onChangeText={(text) => setSearchQuery(text)}
              placeholder="Search for dishes..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCorrect={false}
              autoFocus
            />
          </View>
        </View>
        <FlatList
          key={homeCollectionType === 'store' ? 'store-search-list' : 'item-search-list'}
          data={isLoading ? [] : visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.searchListContent}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  {searchQuery.trim() ? 'No matching food items found' : 'Start typing to search dishes'}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        key={homeCollectionType === 'store' ? 'store-list' : 'item-list'}
        data={isLoading ? [] : filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {renderTopHeader()}
            <View style={styles.topActionRow}>
              <View style={styles.dietaryChipsRow}>
                <TouchableOpacity
                  style={[
                    styles.dietaryChip,
                    activeDietaryFilter === 'veg' && styles.dietaryChipActive,
                  ]}
                  onPress={() => setActiveDietaryFilter((prev) => (prev === 'veg' ? null : 'veg'))}
                  activeOpacity={0.75}
                >
                  <View style={styles.dietaryIconSlot}>
                    {activeDietaryFilter === 'veg' ? (
                      <MaterialIcons name="close" size={14} color="#00B14F" />
                    ) : (
                      <View style={[styles.dietaryDotWrap, styles.dietaryDotWrapVeg]}>
                        <View style={[styles.dietaryDot, styles.dietaryDotVeg]} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dietaryChipText,
                      activeDietaryFilter === 'veg' && styles.dietaryChipTextActive,
                    ]}
                  >
                    Veg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dietaryChip,
                    activeDietaryFilter === 'non-veg' && styles.dietaryChipActive,
                  ]}
                  onPress={() => setActiveDietaryFilter((prev) => (prev === 'non-veg' ? null : 'non-veg'))}
                  activeOpacity={0.75}
                >
                  <View style={styles.dietaryIconSlot}>
                    {activeDietaryFilter === 'non-veg' ? (
                      <MaterialIcons name="close" size={14} color="#00B14F" />
                    ) : (
                      <View style={[styles.dietaryDotWrap, styles.dietaryDotWrapNonVeg]}>
                        <View style={[styles.dietaryDot, styles.dietaryDotNonVeg]} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dietaryChipText,
                      activeDietaryFilter === 'non-veg' && styles.dietaryChipTextActive,
                    ]}
                  >
                    Non - Veg
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setShowSearch(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.searchTriggerButton}
                activeOpacity={0.7}
              >
                <MaterialIcons name="search" size={24} color="#00B14F" />
              </TouchableOpacity>
            </View>
            {isLoading ? renderLoadingSkeleton() : null}
          </>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchItems(true)}
            colors={['#00B14F']}
            tintColor="#00B14F"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {activeDietaryFilter ? 'No items in selected food type' : 'No food items found'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  headerRightSpacer: {
    width: 24,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonPage: {
    paddingTop: 6,
  },
  skeletonSectionTitleWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonList: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonContent: {
    flex: 1,
    paddingRight: 16,
  },
  skeletonGapSmall: {
    marginTop: 6,
  },
  heroSkeletonDivider: {
    marginTop: 10,
    marginBottom: 10,
  },
  heroSkeletonBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroWrap: {
    marginHorizontal: -16,
    marginTop: 0,
    marginBottom: 10,
    height: 260,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    justifyContent: 'space-between',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  heroBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoCard: {
    marginTop: 'auto',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroInfoTitle: {
    color: '#111827',
    fontSize: 34 / 2,
    lineHeight: 46 / 2,
    fontFamily: 'Poppins-SemiBold',
  },
  heroInfoDescription: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 14,
  },
  topActionRow: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dietaryChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dietaryChip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
    paddingVertical: 4,
    paddingHorizontal: 12,
    height: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    gap: 5,
  },
  dietaryChipActive: {
    borderColor: '#00B14F',
    backgroundColor: 'rgba(0, 177, 79, 0.08)',
  },
  dietaryChipText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#1F2937',
    opacity: 0.85,
  },
  dietaryChipTextActive: {
    color: '#00B14F',
  },
  dietaryIconSlot: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietaryDotWrap: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietaryDotWrapVeg: {
    borderColor: '#22C55E',
  },
  dietaryDotWrapNonVeg: {
    borderColor: '#EF4444',
  },
  dietaryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dietaryDotVeg: {
    backgroundColor: '#22C55E',
  },
  dietaryDotNonVeg: {
    backgroundColor: '#EF4444',
  },
  searchTriggerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -2,
  },
  searchScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  searchInputWrap: {
    flex: 1,
    height: 54,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  searchListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    overflow: 'visible',
    marginBottom: 18,
  },
  image: {
    width: 156,
    height: 120,
    borderRadius: 16,
  },
  storeImage: {
    width: 140,
    height: 160,
    borderRadius: 18,
  },
  imageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  imageClosed: {
    opacity: 1,
  },
  disabledImageOverlayStore: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    borderRadius: 18,
    backgroundColor: 'rgba(120, 120, 120, 0.55)',
  },
  disabledImageOverlayItem: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(120, 120, 120, 0.55)',
  },
  imageContainer: {
    width: 155,
    height: 160,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
    paddingBottom: 0,
  },
  itemImageClip: {
    width: 155,
    height: 137,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  itemImage: {
    width: 155,
    height: 137,
    borderRadius: 16,
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 4,
  },
  itemAddButton: {
    position: 'absolute',
    top: 115,
    left: 39.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#00B14F',
    width: 76,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAddButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 27,
    color: '#00B14F',
    opacity: 0.85,
  },
  storeImageContainer: {
    width: 140,
    marginRight: 10,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
    paddingBottom: 0,
  },
  addButton: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22C55E',
    paddingHorizontal: 22,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
    color: '#22C55E',
  },
  storeAvailabilityBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 3,
  },
  storeAvailabilityText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 17,
    color: '#F9FAFB',
    textAlign: 'left',
    width: '100%',
  },
  itemAvailabilityBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 3,
  },
  itemAvailabilityText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 17,
    color: '#F9FAFB',
    textAlign: 'left',
    width: '100%',
  },
  content: {
    flex: 1,
    paddingRight: 16,
    paddingTop: 0,
    justifyContent: 'flex-start',
    gap: 4,
  },
  name: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Poppins',
    fontWeight: '600',
    color: '#111827',
  },
  description: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Poppins',
    color: '#6B7280',
  },
  price: {
    marginTop: 0,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  byHotelText: {
    marginTop: 0,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins',
    fontWeight: '500',
    color: '#6B7280',
  },
  foodTypeBadge: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  foodTypeBadgeVeg: {
    borderColor: '#16A34A',
  },
  foodTypeBadgeNonVeg: {
    borderColor: '#DC2626',
  },
  foodTypeInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  foodTypeInnerDotVeg: {
    backgroundColor: '#16A34A',
  },
  foodTypeInnerDotNonVeg: {
    backgroundColor: '#DC2626',
  },
  locationText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Poppins',
    color: '#6B7280',
  },
  storeEtaText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins-Medium',
    color: '#111827',
  },
  ratingEtaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins-Medium',
    color: '#111827',
  },
  ratingEtaDot: {
    marginHorizontal: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  closedStatusRow: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '86%',
  },
  closedStatusText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  storeCuisineText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Poppins',
    color: '#6B7280',
  },
  distanceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    marginLeft: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
  },
  emptyWrap: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Poppins',
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
});
