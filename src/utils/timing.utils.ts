/**
 * Timing Utilities
 * Helper functions for formatting and handling item timing information
 *
 * IMPORTANT: All day numbers use API format (ISO 8601):
 * 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday
 */

export interface ItemTiming {
  day_from: number; // API format: 1=Monday, 7=Sunday
  day_to: number;   // API format: 1=Monday, 7=Sunday
  time_from: string; // Format: "HHMM" (e.g., "0600", "1430")
  time_to: string;   // Format: "HHMM" (e.g., "2200", "0030")
  is_available_now: boolean;
}

/**
 * Convert 24-hour time string to 12-hour format with AM/PM
 * @param time - Time string in format "HHMM" (e.g., "0600", "1430")
 * @returns Formatted time string (e.g., "6:00 AM", "2:30 PM")
 */
export const formatTime = (time: string): string => {
  const hours = parseInt(time.substring(0, 2), 10);
  const minutes = time.substring(2, 4);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes} ${period}`;
};

/**
 * Convert day number to short day name
 * @param day - Day number in API format (1=Monday, 2=Tuesday, ..., 7=Sunday)
 * @returns Short day name (e.g., "Mon", "Tue")
 */
export const formatDay = (day: number): string => {
  const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[day] || '';
};

/**
 * Format a range of days
 * @param dayFrom - Starting day number
 * @param dayTo - Ending day number
 * @returns Formatted day range (e.g., "Mon-Fri", "Sat")
 */
export const formatDayRange = (dayFrom: number, dayTo: number): string => {
  if (dayFrom === dayTo) {
    return formatDay(dayFrom);
  }
  return `${formatDay(dayFrom)}-${formatDay(dayTo)}`;
};

/**
 * Format complete timing information
 * @param timing - ItemTiming object
 * @returns Formatted timing string (e.g., "Mon-Fri, 6:00 AM - 11:00 AM")
 */
export const formatItemTiming = (timing: ItemTiming): string => {
  const dayRange = formatDayRange(timing.day_from, timing.day_to);
  const timeRange = `${formatTime(timing.time_from)} - ${formatTime(timing.time_to)}`;
  return `${dayRange}, ${timeRange}`;
};

/**
 * Check if an item is currently available based on its timings
 * @param timings - Array of ItemTiming objects
 * @returns true if item is available now, false otherwise
 */
export const isItemAvailable = (timings?: ItemTiming[]): boolean => {
  if (!timings || timings.length === 0) return true; // If no timings, assume always available
  return timings.some(timing => timing.is_available_now);
};
