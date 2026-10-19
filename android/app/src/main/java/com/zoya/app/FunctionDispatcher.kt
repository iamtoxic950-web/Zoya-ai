package com.zoya.app

import android.content.Context
import com.getcapacitor.JSObject

class FunctionDispatcher(private val context: Context) {

    val accessibilityManager = AccessibilityManager(context)
    val overlayManager = OverlayManager(context)
    val deviceManager = DeviceManager(context)
    val macroDroidBridge = MacroDroidBridge(context)

    fun dispatch(name: String, args: JSObject): JSObject {
        val result = JSObject()

        when (name) {
            "executeMacroDroidCommand" -> {
                val action = args.getString("action") ?: args.getString("command") ?: ""
                val target = args.getString("target")
                val value = args.getString("value")
                val text = args.getString("text")

                val resJson = macroDroidBridge.executeCommand(action, target, value, text)
                result.put("success", resJson.optBoolean("success", false))
                result.put("action", resJson.optString("action", action))
                result.put("message", resJson.optString("message", ""))
            }
            "isMacroDroidAvailable" -> {
                result.put("available", macroDroidBridge.isAvailable())
            }
            "openApp" -> {
                val appName = args.getString("appName") ?: ""
                result.put("success", deviceManager.openApp(appName))
            }
            "showOverlay" -> {
                val text = args.getString("text")
                result.put("success", overlayManager.showOverlay(text))
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
            else -> {
                throw Exception("Function '$name' not recognized by Zoya Android dispatcher")
            }
        }
        return result
    }
}
