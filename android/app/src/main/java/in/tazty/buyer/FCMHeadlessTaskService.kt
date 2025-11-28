package `in`.tazty.buyer

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class FCMHeadlessTaskService : HeadlessJsTaskService() {
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val data = intent?.getStringExtra("data") ?: ""
        val title = intent?.getStringExtra("title") ?: ""
        val body = intent?.getStringExtra("body") ?: ""
        
        val params: WritableMap = Arguments.createMap().apply {
            putString("title", title)
            putString("body", body)
            putString("data", data)
        }
        
        val taskConfig = com.facebook.react.jstasks.HeadlessJsTaskConfig(
            "FCMBackgroundMessage",
            params,
            5000, // timeout
            true // allowInForeground
        )
        
        startTask(taskConfig)
        return START_NOT_STICKY
    }
}

