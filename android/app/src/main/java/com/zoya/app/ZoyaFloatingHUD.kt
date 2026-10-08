package com.zoya.app

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

/**
 * Native Android Floating HUD for Zoya AI.
 * Behaves visually as a small persistent notch / pill at the top of the screen.
 * Shows listening / thinking / speaking status, short command text, and voice activity.
 * Tapping expands into a compact assistant panel or brings Zoya to the foreground.
 */
class ZoyaFloatingHUD(private val context: Context) {

    private val windowManager: WindowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private var floatingView: View? = null
    private var isExpanded = false

    companion object {
        private var instance: ZoyaFloatingHUD? = null

        fun getInstance(context: Context): ZoyaFloatingHUD {
            if (instance == null) {
                instance = ZoyaFloatingHUD(context.applicationContext)
            }
            return instance!!
        }

        fun hasOverlayPermission(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(context)
            } else {
                true
            }
        }
    }

    fun isShowing(): Boolean = floatingView != null

    fun show(initialStatus: String = "ZOYA AI"): Boolean {
        if (!hasOverlayPermission(context)) return false
        if (floatingView != null) {
            updateStatusText(initialStatus)
            return true
        }

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            x = 0
            y = 35 // Positioned near top screen edge, below system camera punch-hole/notch
        }

        val inflater = LayoutInflater.from(context)
        val view = inflater.inflate(R.layout.floating_hud_notch, null)
        floatingView = view

        val pillContainer = view.findViewById<View>(R.id.zoyaPillContainer)
        val pillText = view.findViewById<TextView>(R.id.zoyaPillText)
        val closeBtn = view.findViewById<TextView>(R.id.zoyaCloseBtn)
        val expandedPanel = view.findViewById<View>(R.id.zoyaExpandedPanel)
        val openAppBtn = view.findViewById<Button>(R.id.zoyaOpenAppBtn)

        pillText.text = initialStatus

        // Micro close button
        closeBtn.setOnClickListener {
            hide()
        }

        // Tap on the pill to toggle expanded state
        pillContainer.setOnClickListener {
            isExpanded = !isExpanded
            expandedPanel.visibility = if (isExpanded) View.VISIBLE else View.GONE
        }

        // Open full Zoya console button
        openAppBtn.setOnClickListener {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            if (launchIntent != null) {
                context.startActivity(launchIntent)
            }
            isExpanded = false
            expandedPanel.visibility = View.GONE
        }

        // Allow micro dragging if user wants to adjust vertical notch offset
        var initialY = 0
        var initialTouchY = 0f
        pillContainer.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialY = params.y
                    initialTouchY = event.rawY
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaY = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(deltaY) > 10) {
                        params.y = Math.max(10, initialY + deltaY)
                        try {
                            windowManager.updateViewLayout(view, params)
                        } catch (_: Exception) {}
                        true
                    } else {
                        false
                    }
                }
                else -> false
            }
        }

        try {
            windowManager.addView(view, params)
            return true
        } catch (e: Exception) {
            floatingView = null
            return false
        }
    }

    fun hide(): Boolean {
        floatingView?.let { view ->
            try {
                windowManager.removeView(view)
            } catch (_: Exception) {}
            floatingView = null
            isExpanded = false
            return true
        }
        return false
    }

    fun updateStatusText(text: String) {
        floatingView?.findViewById<TextView>(R.id.zoyaPillText)?.text = text
        floatingView?.findViewById<TextView>(R.id.zoyaExpandedBody)?.text = text
    }

    fun updateState(listening: Boolean, speaking: Boolean, processing: Boolean, status: String?) {
        val view = floatingView ?: return
        val pillText = view.findViewById<TextView>(R.id.zoyaPillText)
        val expandedTitle = view.findViewById<TextView>(R.id.zoyaExpandedTitle)

        val displayText = when {
            status != null && status.isNotBlank() -> status
            speaking -> "ZOYA SPEAKING..."
            processing -> "THINKING..."
            listening -> "LISTENING..."
            else -> "ZOYA ONLINE"
        }

        pillText.text = displayText
        expandedTitle.text = if (listening) "LISTENING..." else if (speaking) "SPEAKING..." else "NEURAL CORE ACTIVE"
    }
}
