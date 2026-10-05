package com.zoya.app

import android.content.Context
import android.app.Activity
import com.getcapacitor.JSObject
import org.json.JSONObject

class FunctionDispatcher(private val context: Context, private val activity: Activity?) {

    private val accessibilityManager = AccessibilityManager(context)
    private val overlayManager = OverlayManager(context)
    private val notificationManager = NotificationManager(context)
    private val screenCaptureManager = ScreenCaptureManager(context, activity)
    private val deviceManager = DeviceManager(context)
    private val reminderManager = ReminderManager(context)
    private val memoryManager = MemoryManager(context)

    fun dispatch(name: String, args: JSObject): JSObject {
        val result = JSObject()
        
        when (name) {
            "openApp" -> {
                val appName = args.getString("appName") ?: ""
                result.put("success", deviceManager.openApp(appName))
            }
            "createReminder" -> {
                val title = args.getString("title") ?: ""
                val time = args.getString("time") ?: ""
                result.put("success", reminderManager.createReminder(title, time))
            }
            "readNotifications" -> {
                result.put("notifications", notificationManager.readNotifications())
            }
            "showOverlay" -> {
                result.put("success", overlayManager.showOverlay())
            }
            "hideOverlay" -> {
                result.put("success", overlayManager.hideOverlay())
            }
            "readScreenText" -> {
                result.put("text", accessibilityManager.readScreenText())
            }
            "performAccessibilityAction" -> {
                val action = args.getString("action") ?: ""
                val textToTap = args.getString("textToTap")
                result.put("success", accessibilityManager.performAction(action, textToTap))
            }
            "analyzeScreenshot" -> {
                result.put("base64", screenCaptureManager.takeScreenshot())
            }
            "getDeviceInfo" -> {
                result.put("info", deviceManager.getDeviceInfo())
            }
            "getBatteryStatus" -> {
                result.put("status", deviceManager.getBatteryStatus())
            }
            "getNetworkStatus" -> {
                result.put("status", deviceManager.getNetworkStatus())
            }
            "readClipboard" -> {
                result.put("text", deviceManager.readClipboard())
            }
            "writeClipboard" -> {
                val text = args.getString("text") ?: ""
                result.put("success", deviceManager.writeClipboard(text))
            }
            "pickFile" -> {
                result.put("path", deviceManager.pickFile())
            }
            "takePicture" -> {
                result.put("base64", deviceManager.takePicture())
            }
            "readContacts" -> {
                val query = args.getString("query")
                result.put("contacts", deviceManager.readContacts(query))
            }
            "readCalendar" -> {
                result.put("events", deviceManager.readCalendar())
            }
            else -> {
                throw Exception("Function $name not found in Android dispatcher")
            }
        }
        return result
    }
}
