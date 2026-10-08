package com.zoya.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Settings
import org.json.JSONObject

class AccessibilityManager(private val context: Context) {
    fun isEnabled(): Boolean {
        return ZoyaAccessibilityService.isRunning()
    }

    fun readScreenText(): String {
        val service = ZoyaAccessibilityService.instance
        return service?.extractActiveScreenText() ?: "Accessibility Service is not enabled. Please enable Zoya in Android Settings > Accessibility."
    }

    fun performAction(action: String, textToTap: String?): Boolean {
        val service = ZoyaAccessibilityService.instance ?: return false
        return service.performAction(action, textToTap)
    }
}

class OverlayManager(private val context: Context) {
    private val floatingHUD = ZoyaFloatingHUD.getInstance(context)

    fun hasPermission(): Boolean {
        return ZoyaFloatingHUD.hasOverlayPermission(context)
    }

    fun showOverlay(text: String? = null): Boolean {
        return floatingHUD.show(text ?: "ZOYA AI")
    }

    fun hideOverlay(): Boolean {
        return floatingHUD.hide()
    }

    fun updateState(listening: Boolean, speaking: Boolean, processing: Boolean, status: String?) {
        floatingHUD.updateState(listening, speaking, processing, status)
    }
}

class DeviceManager(private val context: Context) {
    fun openApp(appName: String): Boolean {
        val pm: PackageManager = context.packageManager
        try {
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val cleanTarget = appName.trim().lowercase()

            for (packageInfo in packages) {
                val label = pm.getApplicationLabel(packageInfo).toString().lowercase()
                if (label.contains(cleanTarget) || cleanTarget.contains(label)) {
                    val intent = pm.getLaunchIntentForPackage(packageInfo.packageName)
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(intent)
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return false
    }

    fun getDeviceInfo(): JSONObject {
        return JSONObject().apply {
            put("model", Build.MODEL)
            put("manufacturer", Build.MANUFACTURER)
            put("androidVersion", Build.VERSION.RELEASE)
            put("sdkInt", Build.VERSION.SDK_INT)
            put("device", Build.DEVICE)
        }
    }

    fun getBatteryStatus(): JSONObject {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val level = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        val isCharging = bm?.isCharging ?: false

        return JSONObject().apply {
            put("level", level)
            put("isCharging", isCharging)
        }
    }

    fun getNetworkStatus(): JSONObject {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        var isConnected = false
        var connectionType = "none"

        if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork
            val capabilities = cm.getNetworkCapabilities(network)
            if (capabilities != null) {
                isConnected = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                connectionType = when {
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                    else -> "other"
                }
            }
        }

        return JSONObject().apply {
            put("connected", isConnected)
            put("type", connectionType)
        }
    }

    fun readClipboard(): String {
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        return cm?.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
    }

    fun writeClipboard(text: String): Boolean {
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        val clip = ClipData.newPlainText("Zoya Assistant", text)
        cm.setPrimaryClip(clip)
        return true
    }
}
