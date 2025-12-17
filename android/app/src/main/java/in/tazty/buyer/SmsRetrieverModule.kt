package `in`.tazty.buyer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.auth.api.phone.SmsRetrieverClient
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import com.google.android.gms.tasks.Task
import java.security.MessageDigest
import java.util.regex.Pattern

class SmsRetrieverModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var smsReceiver: BroadcastReceiver? = null
    private var timeoutHandler: Runnable? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    override fun getName(): String {
        return "SmsRetrieverModule"
    }

    /**
     * Start listening for SMS with the app's hash string
     */
    @ReactMethod
    fun startSmsRetriever(promise: Promise) {
        try {
            val client: SmsRetrieverClient = SmsRetriever.getClient(reactApplicationContext)
            val task: Task<Void> = client.startSmsRetriever()

            task.addOnSuccessListener {
                Log.d(TAG, "SMS Retriever started successfully")
                registerReceiver()
                promise.resolve(true)
            }

            task.addOnFailureListener { e ->
                Log.e(TAG, "Failed to start SMS Retriever", e)
                promise.reject("SMS_RETRIEVER_ERROR", "Failed to start SMS Retriever: ${e.message}", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception starting SMS Retriever", e)
            promise.reject("SMS_RETRIEVER_ERROR", "Exception: ${e.message}", e)
        }
    }

    /**
     * Get the app's hash string for SMS Retriever API
     * This hash needs to be appended to the SMS message
     */
    @ReactMethod
    fun getAppHash(promise: Promise) {
        try {
            val packageName = reactApplicationContext.packageName
            val packageInfo = reactApplicationContext.packageManager.getPackageInfo(
                packageName,
                android.content.pm.PackageManager.GET_SIGNATURES
            )

            // Get the first signature (usually there's only one)
            val signatures = packageInfo?.signatures
            if (signatures == null || signatures.isEmpty()) {
                promise.reject("HASH_ERROR", "No signatures found for package")
                return
            }

            val signature = signatures[0].toByteArray()
            val md = MessageDigest.getInstance("SHA-256")
            val hash = md.digest(signature)
            val hashString = Base64.encodeToString(hash, Base64.NO_PADDING or Base64.NO_WRAP)
                .substring(0, 11)

            Log.d(TAG, "App Hash: $hashString")
            promise.resolve(hashString)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting app hash", e)
            promise.reject("HASH_ERROR", "Failed to get app hash: ${e.message}", e)
        }
    }

    /**
     * Stop listening for SMS
     */
    @ReactMethod
    fun stopSmsRetriever(promise: Promise) {
        try {
            unregisterReceiver()
            cancelTimeout()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping SMS Retriever", e)
            promise.reject("STOP_ERROR", "Failed to stop SMS Retriever: ${e.message}", e)
        }
    }

    /**
     * Register broadcast receiver to listen for SMS
     */
    private fun registerReceiver() {
        if (smsReceiver != null) {
            return // Already registered
        }

        smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (SmsRetriever.SMS_RETRIEVED_ACTION == intent.action) {
                    val extras = intent.extras
                    val status = extras?.get(SmsRetriever.EXTRA_STATUS) as? Status

                    when (status?.statusCode) {
                        CommonStatusCodes.SUCCESS -> {
                            // Get SMS message
                            val message = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE) as String
                            Log.d(TAG, "SMS received: $message")

                            // Extract OTP from message
                            val otp = extractOtp(message)
                            if (otp != null) {
                                sendEvent("onSmsReceived", createMap("otp", otp, "message", message))
                            } else {
                                Log.w(TAG, "Could not extract OTP from message: $message")
                                sendEvent("onSmsReceived", createMap("otp", null, "message", message))
                            }
                        }
                        CommonStatusCodes.TIMEOUT -> {
                            Log.d(TAG, "SMS Retriever timeout")
                            sendEvent("onSmsTimeout", null)
                        }
                        else -> {
                            Log.e(TAG, "SMS Retriever error: ${status?.statusCode}")
                            sendEvent("onSmsError", createMap("error", "Status code: ${status?.statusCode}"))
                        }
                    }

                    // Unregister after receiving
                    unregisterReceiver()
                }
            }
        }

        val intentFilter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
        reactApplicationContext.registerReceiver(smsReceiver, intentFilter)
        Log.d(TAG, "SMS Receiver registered")
    }

    /**
     * Unregister broadcast receiver
     */
    private fun unregisterReceiver() {
        smsReceiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
                Log.d(TAG, "SMS Receiver unregistered")
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering receiver", e)
            }
            smsReceiver = null
        }
    }

    /**
     * Extract OTP from SMS message
     * Supports common OTP patterns: 4-digit, 6-digit, alphanumeric
     */
    private fun extractOtp(message: String): String? {
        // Try different patterns
        val patterns = listOf(
            Pattern.compile("\\b\\d{4}\\b"),           // 4-digit OTP
            Pattern.compile("\\b\\d{6}\\b"),           // 6-digit OTP
            Pattern.compile("\\b\\d{5}\\b"),           // 5-digit OTP
            Pattern.compile("OTP[\\s:]*([0-9]{4,6})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("code[\\s:]*([0-9]{4,6})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("verification[\\s:]*([0-9]{4,6})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("([0-9]{4,6})[\\s]*is[\\s]*your", Pattern.CASE_INSENSITIVE),
            Pattern.compile("your[\\s]*code[\\s]*is[\\s]*([0-9]{4,6})", Pattern.CASE_INSENSITIVE),
        )

        for (pattern in patterns) {
            val matcher = pattern.matcher(message)
            if (matcher.find()) {
                val otp = if (matcher.groupCount() > 0) matcher.group(1) else matcher.group(0)
                if (otp != null) {
                    Log.d(TAG, "Extracted OTP: $otp")
                    return otp
                }
            }
        }

        return null
    }

    /**
     * Set timeout for SMS retrieval
     */
    @ReactMethod
    fun setTimeout(timeoutMs: Int, promise: Promise) {
        try {
            cancelTimeout()
            timeoutHandler = Runnable {
                Log.d(TAG, "SMS Retriever timeout reached")
                unregisterReceiver()
                sendEvent("onSmsTimeout", null)
            }
            handler.postDelayed(timeoutHandler!!, timeoutMs.toLong())
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting timeout", e)
            promise.reject("TIMEOUT_ERROR", "Failed to set timeout: ${e.message}", e)
        }
    }

    /**
     * Cancel timeout
     */
    private fun cancelTimeout() {
        timeoutHandler?.let {
            handler.removeCallbacks(it)
            timeoutHandler = null
        }
    }

    /**
     * Send event to JavaScript
     */
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * Create a WritableMap with key-value pairs
     */
    private fun createMap(vararg pairs: Any?): WritableMap {
        val map = Arguments.createMap()
        var i = 0
        while (i < pairs.size - 1) {
            val key = pairs[i] as String
            val value = pairs[i + 1]
            when (value) {
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Double -> map.putDouble(key, value)
                is Boolean -> map.putBoolean(key, value)
                null -> map.putNull(key)
                else -> map.putString(key, value.toString())
            }
            i += 2
        }
        return map
    }

    /**
     * Cleanup when module is destroyed
     */
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        unregisterReceiver()
        cancelTimeout()
    }

    companion object {
        private const val TAG = "SmsRetrieverModule"
    }
}

