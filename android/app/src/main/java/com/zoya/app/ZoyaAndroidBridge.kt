package com.zoya.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ZoyaAndroidBridge")
class ZoyaAndroidBridge : Plugin() {

    private lateinit var dispatcher: FunctionDispatcher

    override fun load() {
        super.load()
        dispatcher = FunctionDispatcher(context)
    }

    @PluginMethod
    fun isAndroidPlatform(call: PluginCall) {
        val ret = JSObject().apply {
            put("isAndroid", true)
            put("platform", "android")
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            call.reject("Failed to open application settings: ${e.message}", e)
        }
    }

    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            call.reject("Failed to open accessibility settings: ${e.message}", e)
        }
    }

    @PluginMethod
    fun isAccessibilityServiceEnabled(call: PluginCall) {
        val isEnabled = dispatcher.accessibilityManager.isEnabled()
        call.resolve(JSObject().put("enabled", isEnabled))
    }

    @PluginMethod
    fun checkOverlayPermission(call: PluginCall) {
        val granted = dispatcher.overlayManager.hasPermission()
        call.resolve(JSObject().put("granted", granted))
    }

    @PluginMethod
    fun requestOverlayPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(context)) {
                try {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    call.resolve(JSObject().put("granted", false))
                    return
                } catch (e: Exception) {
                    call.reject("Failed to open overlay permission settings: ${e.message}", e)
                    return
                }
            }
        }
        call.resolve(JSObject().put("granted", true))
    }

    @PluginMethod
    fun showHUD(call: PluginCall) {
        val text = call.getString("text") ?: "ZOYA AI"
        val success = dispatcher.overlayManager.showOverlay(text)
        call.resolve(JSObject().put("success", success))
    }

    @PluginMethod
    fun hideHUD(call: PluginCall) {
        val success = dispatcher.overlayManager.hideOverlay()
        call.resolve(JSObject().put("success", success))
    }

    @PluginMethod
    fun updateHUDState(call: PluginCall) {
        val listening = call.getBoolean("listening", false) ?: false
        val speaking = call.getBoolean("speaking", false) ?: false
        val processing = call.getBoolean("processing", false) ?: false
        val statusText = call.getString("statusText")

        dispatcher.overlayManager.updateState(listening, speaking, processing, statusText)
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod
    fun startForegroundService(call: PluginCall) {
        try {
            ZoyaForegroundService.start(context)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            call.reject("Failed to start foreground service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun stopForegroundService(call: PluginCall) {
        try {
            ZoyaForegroundService.stop(context)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            call.reject("Failed to stop foreground service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun isForegroundServiceRunning(call: PluginCall) {
        call.resolve(JSObject().put("running", ZoyaForegroundService.isServiceRunning))
    }

    @PluginMethod
    fun dispatchFunction(call: PluginCall) {
        val name = call.getString("name")
        val args = call.getObject("args") ?: JSObject()

        if (name == null) {
            call.reject("Must provide a function name")
            return
        }

        try {
            val result = dispatcher.dispatch(name, args)
            val ret = JSObject().apply {
                put("result", result)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject(e.message, e)
        }
    }
}
