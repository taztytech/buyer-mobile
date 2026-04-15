/**
 * Mock Data Utility
 * Provides fallback/mock data for testing in RN CLI Go
 */

import { RestaurantDetails } from '@/services/restaurant.service';

/**
 * Mock restaurant data for testing
 */
export const mockRestaurantData: RestaurantDetails = {
  id: 1,
  name: 'Dheen Briyani',
  description: 'Authentic South Indian Cuisine',
  cuisine_tags: 'Chettinad, Biryani, South Indian',
  is_open: true,
  delivery_time: '30-40 mins',
  delivery_fee: '30',
  min_order_value: '150',
  gst_number: 'GST123456789',
  fssai_license: 'FSSAI123456789',
  stats: {
    average_rating: 4.5,
    total_reviews: 150,
    total_items: 50,
    total_categories: 8,
  },
  locations: [
    {
      id: 1,
      lat: '9.9352300',
      lng: '78.1210700',
      locality: 'Anna Nagar',
      city: 'Madurai',
      address: '123 Main Street, Anna Nagar, Madurai - 625001',
    },
  ],
  timings: [
    { day: 0, open_time: '1000', close_time: '2200', is_open: true }, // Sunday
    { day: 1, open_time: '1000', close_time: '2200', is_open: true }, // Monday
    { day: 2, open_time: '1000', close_time: '2200', is_open: true }, // Tuesday
    { day: 3, open_time: '1000', close_time: '2200', is_open: true }, // Wednesday
    { day: 4, open_time: '1000', close_time: '2200', is_open: true }, // Thursday
    { day: 5, open_time: '1000', close_time: '2200', is_open: true }, // Friday
    { day: 6, open_time: '1000', close_time: '2200', is_open: true }, // Saturday
  ],
  categories: [
    {
      id: 1,
      name: 'Biryanis',
      items: [
        {
          id: 1,
          name: 'Chicken Biryani',
          description: 'Delicious chicken biryani with authentic spices',
          price: 250,
          images: ['https://via.placeholder.com/300x200/00B14F/FFFFFF?text=Chicken+Biryani'],
          is_available: true,
          is_veg: false,
        },
        {
          id: 2,
          name: 'Mutton Biryani',
          description: 'Tender mutton pieces with fragrant rice',
          price: 350,
          images: ['https://via.placeholder.com/300x200/00B14F/FFFFFF?text=Mutton+Biryani'],
          is_available: true,
          is_veg: false,
        },
      ],
    },
    {
      id: 2,
      name: 'Starters',
      items: [
        {
          id: 3,
          name: 'Chicken 65',
          description: 'Spicy fried chicken appetizer',
          price: 180,
          images: ['https://via.placeholder.com/300x200/00B14F/FFFFFF?text=Chicken+65'],
          is_available: true,
          is_veg: false,
        },
      ],
    },
  ],
};

/**
 * Mock restaurant list for home screen
 */
export const mockRestaurantList = [
  {
    id: 1,
    name: 'Dheen Briyani',
    cuisine_tags: 'Chettinad, Biryani',
    delivery_time: '30-40 mins',
    rating: 4.5,
    total_reviews: 150,
    image: 'https://via.placeholder.com/400x300/00B14F/FFFFFF?text=Dheen+Briyani',
  },
  {
    id: 2,
    name: 'Hotel Saravana Bhavan',
    cuisine_tags: 'South Indian, Vegetarian',
    delivery_time: '25-35 mins',
    rating: 4.3,
    total_reviews: 200,
    image: 'https://via.placeholder.com/400x300/00B14F/FFFFFF?text=Saravana+Bhavan',
  },
  {
    id: 3,
    name: 'Paradise Restaurant',
    cuisine_tags: 'North Indian, Chinese',
    delivery_time: '35-45 mins',
    rating: 4.6,
    total_reviews: 180,
    image: 'https://via.placeholder.com/400x300/00B14F/FFFFFF?text=Paradise',
  },
];

/**
 * Mock user data
 */
export const mockUserData = {
  id: '1',
  name: 'Test User',
  phoneNumber: '9876543210',
  email: 'test@example.com',
};

/**
 * Mock address data
 */
export const mockAddresses = [
  {
    id: 1,
    label: 'Home',
    address: '123 Main Street, Anna Nagar',
    locality: 'Anna Nagar',
    city: 'Madurai',
    latitude: 9.9352300,
    longitude: 78.1210700,
  },
  {
    id: 2,
    label: 'Work',
    address: '456 Office Complex, K.K. Nagar',
    locality: 'K.K. Nagar',
    city: 'Madurai',
    latitude: 9.9252300,
    longitude: 78.1310700,
  },
];

/**
 * Mock order data
 */
export const mockOrders = [
  {
    id: 1,
    restaurant_name: 'Dheen Briyani',
    status: 'delivered',
    total: 520,
    items_count: 2,
    created_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
  },
  {
    id: 2,
    restaurant_name: 'Hotel Saravana Bhavan',
    status: 'in_progress',
    total: 350,
    items_count: 3,
    created_at: new Date().toISOString(), // Today
  },
];

/**
 * Simulate API delay for realistic testing
 */
export const simulateDelay = (ms: number = 1000): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Mock API response wrapper
 */
export const createMockResponse = <T>(data: T, success: boolean = true) => {
  return {
    success,
    data,
    message: success ? 'Success' : 'Error',
  };
};
