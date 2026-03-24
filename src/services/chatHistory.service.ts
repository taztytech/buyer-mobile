/**
 * Chat History Service
 * Manages chat history storage per orderId in AsyncStorage
 * Automatically clears history when order is delivered or cancelled
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key prefix for chat history
const CHAT_HISTORY_PREFIX = '@tazty_chat_history_';

// Performance limits
const MAX_MESSAGES_PER_ORDER = 200; // Keep last 200 messages to prevent storage bloat
const MAX_STORAGE_SIZE_BYTES = 500 * 1024; // 500KB max per order (AsyncStorage limit is ~6MB per key)

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  imageUri?: string;
  fileUri?: string;
  fileName?: string;
  videoUri?: string;
}

interface ChatHistoryData {
  orderId: string;
  messages: ChatMessage[];
  lastUpdated: string; // ISO timestamp
  showSupportCallButton?: boolean;
}

export interface ChatHistoryResult {
  messages: ChatMessage[];
  showSupportCallButton?: boolean;
}

class ChatHistoryService {
  /**
   * Get storage key for a specific order
   */
  private getStorageKey(orderId: string): string {
    return `${CHAT_HISTORY_PREFIX}${orderId}`;
  }

  /**
   * Save chat history for a specific order
   * Optimized to prevent performance issues:
   * - Limits message count to prevent storage bloat
   * - Removes local file URIs (they're temporary anyway)
   * - Checks storage size before saving
   */
  async saveChatHistory(
    orderId: string,
    messages: ChatMessage[],
    showSupportCallButton?: boolean
  ): Promise<void> {
    try {
      if (!orderId) {
        console.warn('[ChatHistoryService] Cannot save chat history: orderId is missing');
        return;
      }

      // Limit message count to prevent storage bloat
      // Keep only the most recent messages
      const messagesToSave = messages.length > MAX_MESSAGES_PER_ORDER
        ? messages.slice(-MAX_MESSAGES_PER_ORDER)
        : messages;

      // Prepare messages for storage
      // Remove local file URIs as they're temporary and can be large
      const messagesForStorage = messagesToSave.map(msg => {
        const { imageUri, fileUri, videoUri, ...msgData } = msg;
        return {
          ...msgData,
          // Convert Date objects to ISO strings for storage
          timestamp: msg.timestamp instanceof Date 
            ? msg.timestamp.toISOString() 
            : new Date(msg.timestamp).toISOString(),
          // Store only file names, not URIs (URIs are local paths that won't persist)
          fileName: msg.fileName,
        };
      });

      const historyData: ChatHistoryData = {
        orderId,
        messages: messagesForStorage,
        lastUpdated: new Date().toISOString(),
        ...(showSupportCallButton !== undefined && { showSupportCallButton }),
      };

      const jsonString = JSON.stringify(historyData);
      // Calculate approximate size in bytes (UTF-8: most chars are 1 byte, but some are 2-4 bytes)
      // Using string length * 1.5 as a safe approximation for mixed UTF-8 content
      const sizeInBytes = Math.ceil(jsonString.length * 1.5);

      // Check if data exceeds size limit
      if (sizeInBytes > MAX_STORAGE_SIZE_BYTES) {
        console.warn(
          `[ChatHistoryService] Chat history for order ${orderId} exceeds size limit (${sizeInBytes} bytes). ` +
          `Keeping only most recent messages.`
        );
        
        // Reduce to last 50 messages if still too large
        const reducedMessages = messages.slice(-50).map(msg => {
          const { imageUri, fileUri, videoUri, ...msgData } = msg;
          return {
            ...msgData,
            timestamp: msg.timestamp instanceof Date 
              ? msg.timestamp.toISOString() 
              : new Date(msg.timestamp).toISOString(),
            fileName: msg.fileName,
          };
        });

        const reducedData: ChatHistoryData = {
          orderId,
          messages: reducedMessages,
          lastUpdated: new Date().toISOString(),
          ...(showSupportCallButton !== undefined && { showSupportCallButton }),
        };

        const reducedJsonString = JSON.stringify(reducedData);
        const storageKey = this.getStorageKey(orderId);
        await AsyncStorage.setItem(storageKey, reducedJsonString);
        
        const reducedSize = Math.ceil(reducedJsonString.length * 1.5);
        console.log(
          `[ChatHistoryService] Saved reduced chat history for order ${orderId} ` +
          `(${reducedMessages.length} messages, ~${reducedSize} bytes)`
        );
        return;
      }

      const storageKey = this.getStorageKey(orderId);
      await AsyncStorage.setItem(storageKey, jsonString);
      
      if (messages.length > MAX_MESSAGES_PER_ORDER) {
        console.log(
          `[ChatHistoryService] Saved chat history for order ${orderId} ` +
          `(${messagesToSave.length} of ${messages.length} messages, ${sizeInBytes} bytes)`
        );
      } else {
        console.log(
          `[ChatHistoryService] Saved chat history for order ${orderId} ` +
          `(${messages.length} messages, ${sizeInBytes} bytes)`
        );
      }
    } catch (error) {
      console.error('[ChatHistoryService] Error saving chat history:', error);
      // Don't throw - chat should still work even if storage fails
    }
  }

  /**
   * Get chat history for a specific order
   */
  async getChatHistory(orderId: string): Promise<ChatHistoryResult | null> {
    try {
      if (!orderId) {
        return null;
      }

      const storageKey = this.getStorageKey(orderId);
      const storedData = await AsyncStorage.getItem(storageKey);

      if (!storedData) {
        return null;
      }

      const historyData: ChatHistoryData = JSON.parse(storedData);
      
      // Convert ISO timestamp strings back to Date objects
      // Note: imageUri, fileUri, videoUri are not restored as they're local paths
      const messages: ChatMessage[] = historyData.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        // Local file URIs are not restored (they're temporary)
        // Only restore fileName if it exists
      }));

      console.log(`[ChatHistoryService] Loaded chat history for order ${orderId} (${messages.length} messages)`);
      return {
        messages,
        ...(historyData.showSupportCallButton !== undefined && {
          showSupportCallButton: historyData.showSupportCallButton,
        }),
      };
    } catch (error) {
      console.error('[ChatHistoryService] Error loading chat history:', error);
      return null;
    }
  }

  /**
   * Clear chat history for a specific order
   * Called when order is delivered or cancelled
   */
  async clearChatHistory(orderId: string): Promise<void> {
    try {
      if (!orderId) {
        return;
      }

      const storageKey = this.getStorageKey(orderId);
      await AsyncStorage.removeItem(storageKey);
      
      console.log(`[ChatHistoryService] Cleared chat history for order ${orderId}`);
    } catch (error) {
      console.error('[ChatHistoryService] Error clearing chat history:', error);
    }
  }

  /**
   * Clear all chat history (for logout or cleanup)
   */
  async clearAllChatHistory(): Promise<void> {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter keys that match chat history prefix
      const chatHistoryKeys = allKeys.filter(key => key.startsWith(CHAT_HISTORY_PREFIX));
      
      if (chatHistoryKeys.length > 0) {
        await AsyncStorage.multiRemove(chatHistoryKeys);
        console.log(`[ChatHistoryService] Cleared all chat history (${chatHistoryKeys.length} orders)`);
      }
    } catch (error) {
      console.error('[ChatHistoryService] Error clearing all chat history:', error);
    }
  }

  /**
   * Check if chat history exists for an order
   */
  async hasChatHistory(orderId: string): Promise<boolean> {
    try {
      if (!orderId) {
        return false;
      }

      const storageKey = this.getStorageKey(orderId);
      const storedData = await AsyncStorage.getItem(storageKey);
      return storedData !== null;
    } catch (error) {
      console.error('[ChatHistoryService] Error checking chat history:', error);
      return false;
    }
  }
}

// Export singleton instance
export const chatHistoryService = new ChatHistoryService();
export default chatHistoryService;

