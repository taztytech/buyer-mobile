import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Modal,
  ActionSheetIOS,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { colors } from '@/theme/colors';
import { useOrders } from '@/context/OrdersContext';
import { ordersService } from '@/services/orders.service';

interface ChatScreenProps {
  visible?: boolean;
  onBack?: () => void;
  helpOptionId?: string;
  helpOptionTitle?: string;
  orderId?: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  imageUri?: string;
  fileUri?: string;
  fileName?: string;
  videoUri?: string;
}

interface ChatOption {
  id: string;
  text: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  visible = false,
  onBack,
  helpOptionId,
  helpOptionTitle,
  orderId,
}) => {
  const { getOrderById } = useOrders();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showOptions, setShowOptions] = useState(true);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Determine if order is before delivery (pending, confirmed) or after (accepted, billed, delivered, etc.)
  const isOrderBeforeDelivery = (status: string | null | undefined): boolean => {
    if (!status) return true; // Default to before delivery if status unknown
    const statusLower = status.toLowerCase();
    // Before delivery statuses: pending, confirmed
    // After delivery statuses: accepted, billed, preparing, out_for_delivery, delivered, cancelled, etc.
    return statusLower === 'pending' || statusLower === 'confirmed';
  };

  // Get relevant options based on order status
  const getChatOptions = (): ChatOption[] => {
    const isBeforeDelivery = isOrderBeforeDelivery(orderStatus);

    if (isBeforeDelivery) {
      // Options for before order is delivered
      return [
        { id: 'change_address', text: 'I want to change my delivery address' },
        { id: 'cancel_order', text: 'I want to cancel my order' },
        { id: 'payment_billing', text: 'Payment and billing related issue' },
      ];
    } else {
      // Options for after order is delivered
      return [
        { id: 'order_not_received', text: "I'm not receiving order" },
        { id: 'incorrect_items', text: 'Items delivered are incorrect or wrong' },
        { id: 'missing_items', text: 'Items are missing' },
        { id: 'quality_issue', text: 'Item quality is not good' },
        { id: 'packaging_issue', text: 'Items packaging spillage issue' },
        { id: 'report_delivery_partner', text: 'Report a delivery partner' },
      ];
    }
  };

  const chatOptions = getChatOptions();

  // Fetch order status
  useEffect(() => {
    const fetchOrderStatus = async () => {
      if (!orderId) {
        setOrderStatus(null);
        return;
      }

      try {
        // Try to get from context first
        const contextOrder = getOrderById(orderId);
        if (contextOrder?.status) {
          setOrderStatus(contextOrder.status);
          return;
        }

        // Fetch full order details if not in context
        const response = await ordersService.getOrderById(Number(orderId));
        if (response.success && response.data?.status) {
          setOrderStatus(response.data.status);
        } else {
          setOrderStatus(null);
        }
      } catch (error) {
        console.error('Failed to fetch order status:', error);
        setOrderStatus(null);
      }
    };

    if (visible && orderId) {
      fetchOrderStatus();
    }
  }, [visible, orderId, getOrderById]);

  useEffect(() => {
    if (visible) {
      // Reset messages and options when screen becomes visible
      setMessages([]);
      setShowOptions(false);
      
      // First, show greeting message
      const greetingMessage: Message = {
        id: Date.now().toString(),
        text: "Hi there! I'm here to help you with your order. How can I assist you today?",
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages([greetingMessage]);

      // After a short delay, show the options
      setTimeout(() => {
        setShowOptions(true);
      }, 1000); // Show options after 1 second
    }
  }, [visible]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const userMessage: Message = {
          id: Date.now().toString(),
          text: '',
          sender: 'user',
          timestamp: new Date(),
          imageUri: result.assets[0].uri,
        };
        setMessages((prev) => [...prev, userMessage]);
        setShowOptions(false);
        setShowAttachmentMenu(false);
        
        // Simulate bot response
        setTimeout(() => {
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: 'Thank you for sharing the image. Our support team will review it and get back to you shortly.',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }, 1000);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to pick image');
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Close menu first
      if (Platform.OS === 'android') {
        setShowAttachmentMenu(false);
      }
      
      // Request camera permission directly
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Camera permission is required to take photos. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      // Small delay to ensure menu is closed on Android
      if (Platform.OS === 'android') {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Launch camera immediately after permission is granted
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const userMessage: Message = {
          id: Date.now().toString(),
          text: '',
          sender: 'user',
          timestamp: new Date(),
          imageUri: result.assets[0].uri,
        };
        setMessages((prev) => [...prev, userMessage]);
        setShowOptions(false);
        setShowAttachmentMenu(false);
        
        // Simulate bot response
        setTimeout(() => {
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: 'Thank you for sharing the photo. Our support team will review it and get back to you shortly.',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }, 1000);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to take photo');
    }
  };

  const handleRecordVideo = async () => {
    try {
      // Close menu first
      if (Platform.OS === 'android') {
        setShowAttachmentMenu(false);
      }
      
      // Request camera permission directly
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Camera permission is required to record videos. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      // Small delay to ensure menu is closed on Android
      if (Platform.OS === 'android') {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Launch camera for video recording immediately after permission is granted
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const userMessage: Message = {
          id: Date.now().toString(),
          text: 'Video',
          sender: 'user',
          timestamp: new Date(),
          videoUri: result.assets[0].uri,
        };
        setMessages((prev) => [...prev, userMessage]);
        setShowOptions(false);
        setShowAttachmentMenu(false);
        
        // Simulate bot response
        setTimeout(() => {
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: 'Thank you for sharing the video. Our support team will review it and get back to you shortly.',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }, 1000);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to record video');
    }
  };

  const handlePickVideo = async () => {
    try {
      setShowAttachmentMenu(false);
      
      // Request media library permission directly
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Media library permission is required to select videos. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        const userMessage: Message = {
          id: Date.now().toString(),
          text: 'Video',
          sender: 'user',
          timestamp: new Date(),
          videoUri: result.assets[0].uri,
        };
        setMessages((prev) => [...prev, userMessage]);
        setShowOptions(false);
        setShowAttachmentMenu(false);
        
        // Simulate bot response
        setTimeout(() => {
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: 'Thank you for sharing the video. Our support team will review it and get back to you shortly.',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }, 1000);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to pick video');
    }
  };

  const handlePickDocument = async () => {
    try {
      setShowAttachmentMenu(false);
      
      // Request media library permission directly
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Media library permission is required to select files. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        const userMessage: Message = {
          id: Date.now().toString(),
          text: asset.fileName || (isVideo ? 'Video' : 'File'),
          sender: 'user',
          timestamp: new Date(),
          fileUri: asset.uri,
          fileName: asset.fileName || 'attachment',
          imageUri: asset.type === 'image' ? asset.uri : undefined,
          videoUri: isVideo ? asset.uri : undefined,
        };
        setMessages((prev) => [...prev, userMessage]);
        setShowOptions(false);
        setShowAttachmentMenu(false);
        
        // Simulate bot response
        setTimeout(() => {
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: 'Thank you for sharing the file. Our support team will review it and get back to you shortly.',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }, 1000);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to pick file');
    }
  };

  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Record Video', 'Choose Photo', 'Choose Video', 'Choose File'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handleRecordVideo();
          } else if (buttonIndex === 3) {
            handlePickImage();
          } else if (buttonIndex === 4) {
            handlePickVideo();
          } else if (buttonIndex === 5) {
            handlePickDocument();
          }
        }
      );
    } else {
      setShowAttachmentMenu(true);
    }
  };

  const handlePlayVideo = async (videoUri: string) => {
    try {
      // For local videos, try to open in native video player
      // This is more reliable than WebView for local file:// URIs
      const canOpen = await Linking.canOpenURL(videoUri);
      if (canOpen) {
        // Try opening in native player first
        try {
          await Linking.openURL(videoUri);
          return;
        } catch (error) {
          // If native player fails, fall back to WebView modal
          console.log('Native player failed, using WebView fallback');
        }
      }
      // Fallback to WebView modal
      setSelectedVideoUri(videoUri);
    } catch (error) {
      // If all else fails, use WebView modal
      setSelectedVideoUri(videoUri);
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setShowOptions(false);

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Thank you for your message. Our support team will get back to you shortly.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  const handleCancelOrder = async () => {
    if (!orderId) {
      Alert.alert('Error', 'Order ID is missing');
      setShowCancelReasonModal(false);
      setCancelReason('');
      setShowOptions(true);
      return;
    }

    if (!cancelReason.trim()) {
      Alert.alert('Required', 'Please provide a cancellation reason');
      return;
    }

    try {
      const response = await ordersService.cancelOrder(Number(orderId), cancelReason.trim());
      
      setShowCancelReasonModal(false);
      setCancelReason('');

      if (response.success) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Your order cancellation request has been submitted successfully. Our team will process your refund if applicable.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.error || 'Failed to cancel order. Please try again or contact support.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error: any) {
      setShowCancelReasonModal(false);
      setCancelReason('');
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'An error occurred while canceling your order. Please try again or contact support.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }
  };

  const handleOptionPress = (option: ChatOption) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: option.text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setShowOptions(false);

    // Handle cancel order separately - show modal for reason
    if (option.id === 'cancel_order') {
      setShowCancelReasonModal(true);
      return;
    }

    // Simulate bot response for other options
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I understand your concern. Let me connect you with our support team who can assist you better with this issue.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat with us</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <SafeAreaView style={styles.contentContainer} edges={['bottom']}>
          {/* Chat Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageWrapper,
                  message.sender === 'user' ? styles.userMessageWrapper : styles.botMessageWrapper,
                ]}
              >
                {message.sender === 'bot' && (
                  <View style={styles.botAvatar}>
                    <MaterialIcons name="support-agent" size={20} color="#FFFFFF" />
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    message.sender === 'user' ? styles.userMessageBubble : styles.botMessageBubble,
                  ]}
                >
                  {message.imageUri && !message.videoUri && (
                    <Image
                      source={{ uri: message.imageUri }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  )}
                  {message.videoUri && (
                    <TouchableOpacity
                      style={styles.videoThumbnail}
                      onPress={() => handlePlayVideo(message.videoUri!)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.videoThumbnailPlaceholder}>
                        <MaterialIcons name="videocam" size={48} color="#FFFFFF" />
                      </View>
                      <View style={styles.videoPlayButton}>
                        <MaterialIcons name="play-circle-filled" size={56} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  )}
                  {message.fileUri && !message.imageUri && !message.videoUri && (
                    <View style={styles.fileAttachment}>
                      <MaterialIcons name="insert-drive-file" size={24} color={message.sender === 'user' ? '#FFFFFF' : colors.primary} />
                      <Text
                        style={[
                          styles.fileName,
                          message.sender === 'user' ? styles.userMessageText : styles.botMessageText,
                        ]}
                        numberOfLines={1}
                      >
                        {message.fileName}
                      </Text>
                    </View>
                  )}
                  {message.text ? (
                    <Text
                      style={[
                        styles.messageText,
                        message.sender === 'user' ? styles.userMessageText : styles.botMessageText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.messageTime,
                      message.sender === 'user' ? styles.userMessageTime : styles.botMessageTime,
                    ]}
                  >
                    {formatTime(message.timestamp)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Chat Options */}
            {showOptions && chatOptions.length > 0 && (
              <View style={styles.optionsContainer}>
                <View style={styles.optionsBubble}>
                  {chatOptions.map((option, index) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.optionButton,
                        index < chatOptions.length - 1 && styles.optionButtonBorder,
                      ]}
                      onPress={() => handleOptionPress(option)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.optionButtonText}>{option.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {messages.length > 0 && (
                  <Text style={styles.optionsTime}>
                    {formatTime(new Date())}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Email Support Section */}
          <View style={styles.emailSection}>
            <Text style={styles.emailText}>
              In case of further queries, please drop an email to{' '}
              <Text style={styles.emailLink}>support@tazty.in</Text>
            </Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={showAttachmentOptions}
              activeOpacity={0.7}
            >
              <MaterialIcons name="attach-file" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type your message..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="send"
                size={20}
                color={inputText.trim() ? '#FFFFFF' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Attachment Menu Modal for Android */}
          <Modal
            visible={showAttachmentMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowAttachmentMenu(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowAttachmentMenu(false)}
            >
              <View style={styles.attachmentMenu}>
                <TouchableOpacity
                  style={styles.attachmentMenuItem}
                  onPress={async () => {
                    setShowAttachmentMenu(false);
                    // Small delay to ensure modal closes
                    await new Promise(resolve => setTimeout(resolve, 200));
                    handleTakePhoto();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="camera-alt" size={24} color={colors.primary} />
                  <Text style={styles.attachmentMenuText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentMenuItem}
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    handlePickImage();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="photo-library" size={24} color={colors.primary} />
                  <Text style={styles.attachmentMenuText}>Choose Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentMenuItem}
                  onPress={async () => {
                    setShowAttachmentMenu(false);
                    // Small delay to ensure modal closes
                    await new Promise(resolve => setTimeout(resolve, 200));
                    handleRecordVideo();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="videocam" size={24} color={colors.primary} />
                  <Text style={styles.attachmentMenuText}>Record Video</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentMenuItem}
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    handlePickVideo();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="movie" size={24} color={colors.primary} />
                  <Text style={styles.attachmentMenuText}>Choose Video</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentMenuItem}
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    handlePickDocument();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="insert-drive-file" size={24} color={colors.primary} />
                  <Text style={styles.attachmentMenuText}>Choose File</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.attachmentMenuItem, styles.attachmentMenuCancel]}
                  onPress={() => setShowAttachmentMenu(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachmentMenuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Cancel Order Reason Modal */}
          <Modal
            visible={showCancelReasonModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowCancelReasonModal(false);
              setCancelReason('');
              setShowOptions(true);
            }}
          >
            <KeyboardAvoidingView
              style={styles.cancelReasonModalOverlay}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <View style={styles.cancelReasonModalOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => {
                    setShowCancelReasonModal(false);
                    setCancelReason('');
                    setShowOptions(true);
                  }}
                />
                <View style={styles.cancelReasonModal}>
                  <Text style={styles.cancelReasonTitle}>Cancel Order</Text>
                  <Text style={styles.cancelReasonSubtitle}>
                    Please provide a reason for cancellation:
                  </Text>
                  <TextInput
                    style={styles.cancelReasonInput}
                    placeholder="Enter cancellation reason..."
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <View style={styles.cancelReasonButtons}>
                    <TouchableOpacity
                      style={[styles.cancelReasonButton, styles.cancelReasonButtonSecondary]}
                      onPress={() => {
                        setShowCancelReasonModal(false);
                        setCancelReason('');
                        setShowOptions(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelReasonButtonTextSecondary}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelReasonButton, styles.cancelReasonButtonPrimary]}
                      onPress={handleCancelOrder}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelReasonButtonTextPrimary}>Submit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Video Player Modal */}
          <Modal
            visible={selectedVideoUri !== null}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setSelectedVideoUri(null)}
          >
            <SafeAreaView style={styles.videoPlayerContainer} edges={['top']}>
              <TouchableOpacity
                onPress={() => setSelectedVideoUri(null)}
                style={styles.videoPlayerCloseButton}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              {selectedVideoUri && (
                <View style={styles.videoPlayerContent}>
                  <Video
                    source={{ uri: selectedVideoUri }}
                    style={styles.videoPlayer}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping={false}
                  />
                </View>
              )}
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  flex: {
    flex: 1,
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
    flex: 1,
    marginLeft: 12,
  },
  headerSpacer: {
    width: 40,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  botMessageWrapper: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  botMessageBubble: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontFamily: 'Poppins',
    fontSize: 11,
    lineHeight: 16,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  botMessageTime: {
    color: colors.textSecondary,
    textAlign: 'left',
  },
  optionsContainer: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
  optionsBubble: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    overflow: 'hidden',
    maxWidth: '85%',
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  optionButtonBorder: {
    borderBottomWidth: 1,
  },
  optionButtonText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  optionsTime: {
    fontFamily: 'Poppins',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 8,
  },
  emailSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  emailText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  emailLink: {
    color: colors.primary,
    fontFamily: 'Poppins_500Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  attachmentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: 200,
  },
  fileName: {
    fontFamily: 'Poppins',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentMenu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  attachmentMenuText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    color: '#000000',
    marginLeft: 16,
  },
  attachmentMenuCancel: {
    borderBottomWidth: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
  attachmentMenuCancelText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  videoThumbnail: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  videoThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoPlayButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoPlayerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  videoPlayerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  cancelReasonModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelReasonModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  cancelReasonTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#000000',
    marginBottom: 8,
  },
  cancelReasonSubtitle: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  cancelReasonInput: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E4E4E4',
  },
  cancelReasonButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelReasonButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelReasonButtonPrimary: {
    backgroundColor: colors.primary,
  },
  cancelReasonButtonSecondary: {
    backgroundColor: '#F5F5F5',
  },
  cancelReasonButtonTextPrimary: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  cancelReasonButtonTextSecondary: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#000000',
  },
});

