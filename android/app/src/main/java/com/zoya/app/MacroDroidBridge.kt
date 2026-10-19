package com.zoya.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.getcapacitor.JSObject
import org.json.JSONObject

/**
 * Android Intent-based MacroDroid Automation Bridge for Zoya AI.
 * Dispatches broadcast intents matching:
 * Action: com.zoya.app.ACTION_MACRODROID_COMMAND
 * Extras:
 *   - command: String
 *   - action: String (e.g., OPEN_APP, OPEN_URL, OPEN_SETTINGS, SET_VOLUME, SET_BRIGHTNESS, PLAY_MEDIA, PAUSE_MEDIA, TOGGLE_FLASHLIGHT, CREATE_REMINDER, READ_NOTIFICATION_STATUS, GET_BATTERY_STATUS)
 *   - target: String?
 *   - text: String?
 *   - value: String?
 */
class MacroDroidBridge(private val context: Context) {

    companion object {
        const val ACTION_MACRODROID_COMMAND = "com.zoya.app.ACTION_MACRODROID_COMMAND"
        const val MACRODROID_PACKAGE_NAME = "com.arlosoft.macrodroid"

        // Safe whitelist of permitted actions
        val SAFE_ACTIONS = setOf(
            "OPEN_APP",
            "OPEN_URL",
            "OPEN_SETTINGS",
            "SET_VOLUME",
            "SET_BRIGHTNESS",
            "PLAY_MEDIA",
            "PAUSE_MEDIA",
            "TOGGLE_FLASHLIGHT",
            "CREATE_REMINDER",
            "READ_NOTIFICATION_STATUS",
            "GET_BATTERY_STATUS"
        )
    }

    /**
     * Checks if MacroDroid is installed and enabled on the Android device.
     */
    fun isAvailable(): Boolean {
        return try {
            val pm: PackageManager = context.packageManager
            pm.getPackageInfo(MACRODROID_PACKAGE_NAME, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            // Also check if any receiver accepts the custom action intent
            val testIntent = Intent(ACTION_MACRODROID_COMMAND)
            val receivers = context.packageManager.queryBroadcastReceivers(testIntent, 0)
            receivers.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Sends a structured automation broadcast intent.
     * MacroDroid listens via:
     *   Trigger -> Connectivity/Intent -> Broadcast Intent Received -> Action: com.zoya.app.ACTION_MACRODROID_COMMAND
     */
    fun executeCommand(
        action: String,
        target: String? = null,
        value: String? = null,
        text: String? = null
    ): JSONObject {
        val result = JSONObject()
        val normalizedAction = action.trim().uppercase()

        if (!SAFE_ACTIONS.contains(normalizedAction)) {
            result.put("success", false)
            result.put("action", normalizedAction)
            result.put("message", "Action '$normalizedAction' is not in the safe permitted actions whitelist.")
            return result
        }

        try {
            val intent = Intent(ACTION_MACRODROID_COMMAND).apply {
                putExtra("command", normalizedAction)
                putExtra("action", normalizedAction)
                target?.let { putExtra("target", it.trim()) }
                value?.let { putExtra("value", it.trim()) }
                text?.let { putExtra("text", it.trim()) }
                // Also provide generic string extra for flexible MacroDroid trigger matching
                putExtra("payload", "$normalizedAction:${target ?: ""}:${value ?: ""}:${text ?: ""}")
                addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES)
            }

            // Send explicit or standard broadcast
            context.sendBroadcast(intent)

            result.put("success", true)
            result.put("action", normalizedAction)
            result.put("message", "Dispatched $normalizedAction to MacroDroid bridge successfully.")
        } catch (e: Exception) {
            result.put("success", false)
            result.put("action", normalizedAction)
            result.put("message", "Failed to dispatch intent: ${e.message}")
        }

        return result
    }
}
