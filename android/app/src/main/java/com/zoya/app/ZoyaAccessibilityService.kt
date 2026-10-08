package com.zoya.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Android Accessibility Service for Zoya AI.
 * Handles legitimate assistant capabilities:
 * - Querying screen content for context upon user request
 * - Performing standard navigation actions (Home, Back, Recents, Notifications)
 * - Tapping specific text or permitted actions when requested by the user
 */
class ZoyaAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: ZoyaAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Accessibility events can be processed here if needed for assistant context
    }

    override fun onInterrupt() {
        // Called when system interrupts the service
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    /**
     * Reads all visible text from the active window hierarchy.
     */
    fun extractActiveScreenText(): String {
        val rootNode = rootInActiveWindow ?: return "Unable to read current screen hierarchy."
        val builder = StringBuilder()
        traverseNodeText(rootNode, builder)
        return if (builder.isBlank()) "No text found on active screen." else builder.toString().trim()
    }

    private fun traverseNodeText(node: AccessibilityNodeInfo?, builder: StringBuilder) {
        if (node == null) return

        val text = node.text
        if (!text.isNullOrBlank()) {
            builder.append(text).append("\n")
        }
        val desc = node.contentDescription
        if (!desc.isNullOrBlank() && desc != text) {
            builder.append("[").append(desc).append("]\n")
        }

        for (i in 0 until node.childCount) {
            traverseNodeText(node.getChild(i), builder)
        }
    }

    /**
     * Performs standard navigation or click actions.
     */
    fun performAction(actionName: String, targetText: String? = null): Boolean {
        return when (actionName.lowercase()) {
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "recents", "recent_apps" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            "quick_settings" -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
            "lock_screen" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            } else false
            "click_text" -> if (!targetText.isNullOrBlank()) clickNodeWithText(targetText) else false
            else -> false
        }
    }

    private fun clickNodeWithText(target: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val matchedNodes = rootNode.findAccessibilityNodeInfosByText(target)
        if (matchedNodes.isNullOrEmpty()) return false

        for (node in matchedNodes) {
            if (node.isClickable) {
                return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            // Check parent clickable
            var parent = node.parent
            while (parent != null) {
                if (parent.isClickable) {
                    return parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                }
                parent = parent.parent
            }
        }
        return false
    }

    /**
     * Dispatches a tap gesture at coordinate (x, y) if officially supported by Android API.
     */
    fun performTapAt(x: Float, y: Float): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false

        val path = Path().apply {
            moveTo(x, y)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGesture(gesture, null, null)
    }
}
