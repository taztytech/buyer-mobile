package `in`.tazty.buyer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FCMService : FirebaseMessagingService() {
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed token: $token")
        
        // Send token to React Native
        sendTokenToReactNative(token)
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d(TAG, "From: ${remoteMessage.from}")
        Log.d(TAG, "Message data payload: ${remoteMessage.data}")
        
        // Check if message contains a notification payload
        remoteMessage.notification?.let {
            Log.d(TAG, "Message Notification Body: ${it.body}")
            showNotification(it.title ?: "New Notification", it.body ?: "", remoteMessage.data)
        }
        
        // Send message to React Native
        sendMessageToReactNative(remoteMessage)
    }
    
    private fun sendTokenToReactNative(token: String) {
        val reactContext = (application as MainApplication).reactNativeHost.reactInstanceManager.currentReactContext
        reactContext?.let {
            val params = Arguments.createMap().apply {
                putString("token", token)
            }
            it
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("FCMTokenRefreshed", params)
        }
    }
    
    private fun sendMessageToReactNative(remoteMessage: RemoteMessage) {
        val reactContext = (application as MainApplication).reactNativeHost.reactInstanceManager.currentReactContext
        
        if (reactContext != null) {
            // App is in foreground, send event directly
            val params = Arguments.createMap().apply {
                putString("title", remoteMessage.notification?.title)
                putString("body", remoteMessage.notification?.body)
                val dataMap = Arguments.createMap()
                remoteMessage.data.forEach { (key, value) ->
                    dataMap.putString(key, value)
                }
                putMap("data", dataMap)
            }
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("FCMessageReceived", params)
        } else {
            // App is in background/quit state, use headless task
            val intent = Intent(this, FCMHeadlessTaskService::class.java).apply {
                putExtra("data", remoteMessage.data.toString())
                putExtra("title", remoteMessage.notification?.title)
                putExtra("body", remoteMessage.notification?.body)
            }
            startService(intent)
        }
    }
    
    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "default"
            val channelName = "Default Channel"
            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Default notification channel"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
            }
            notificationManager.createNotificationChannel(channel)
        }
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            // Add action to identify notification tap
            action = "OPEN_FROM_NOTIFICATION"
            // Pass all notification data as extras
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
            // Ensure orderId is passed (support multiple field names)
            val orderId = data["orderId"] ?: data["order_id"] ?: data["orderID"] ?: data["order-id"]
            if (orderId != null) {
                putExtra("orderId", orderId)
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notificationBuilder = NotificationCompat.Builder(this, "default")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
        
        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
    
    companion object {
        private const val TAG = "FCMService"
    }
}

