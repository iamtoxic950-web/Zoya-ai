package com.zoya.app

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class ZoyaAccessibilityService : AccessibilityService() {

    companion object {
        var instance: ZoyaAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Collect window state changes or text content here if needed
    }

    override fun onInterrupt() {
        // Handle interrupt
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
