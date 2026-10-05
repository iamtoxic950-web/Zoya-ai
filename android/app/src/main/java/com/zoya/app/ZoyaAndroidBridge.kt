package com.zoya.app

import android.Manifest
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "ZoyaAndroidBridge",
    permissions = [
        Permission(
            strings = [Manifest.permission.CAMERA],
            alias = "camera"
        ),
        Permission(
            strings = [Manifest.permission.READ_CONTACTS],
            alias = "contacts"
        ),
        Permission(
            strings = [Manifest.permission.READ_CALENDAR],
            alias = "calendar"
        )
    ]
)
class ZoyaAndroidBridge : Plugin() {

    private lateinit var dispatcher: FunctionDispatcher
    private var pendingCall: PluginCall? = null
    private var pendingName: String? = null
    private var pendingArgs: JSObject? = null

    override fun load() {
        super.load()
        dispatcher = FunctionDispatcher(context, activity)
    }

    @PluginMethod
    fun dispatchFunction(call: PluginCall) {
        val name = call.getString("name")
        val args = call.getObject("args") ?: JSObject()

        if (name == null) {
            call.reject("Must provide a function name")
            return
        }

        // Check if this action requires permission
        val requiredAlias = when (name) {
            "takePicture" -> "camera"
            "readContacts" -> "contacts"
            "readCalendar" -> "calendar"
            else -> null
        }

        if (requiredAlias != null) {
            if (getPermissionState(requiredAlias) != PermissionState.GRANTED) {
                pendingCall = call
                pendingName = name
                pendingArgs = args
                requestPermissionForAlias(requiredAlias, call, "permissionCallback")
                return
            }
        }

        executeDispatch(name, args, call)
    }

    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        val pCall = pendingCall
        val pName = pendingName
        val pArgs = pendingArgs

        if (pCall != null && pName != null && pArgs != null) {
            val requiredAlias = when (pName) {
                "takePicture" -> "camera"
                "readContacts" -> "contacts"
                "readCalendar" -> "calendar"
                else -> null
            }

            if (requiredAlias != null && getPermissionState(requiredAlias) == PermissionState.GRANTED) {
                executeDispatch(pName, pArgs, pCall)
            } else {
                pCall.reject("Permission denied for $pName")
            }
        }
        
        pendingCall = null
        pendingName = null
        pendingArgs = null
    }

    private fun executeDispatch(name: String, args: JSObject, call: PluginCall) {
        try {
            val result = dispatcher.dispatch(name, args)
            val ret = JSObject()
            ret.put("result", result)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject(e.message, e)
        }
    }
}
