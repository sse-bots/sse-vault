package com.sse.vault.autofill

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SseAutofillModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    override fun getName(): String = "SseAutofill"

    @ReactMethod
    fun isSupported(promise: Promise) {
        promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
    }

    @ReactMethod
    fun isEnabled(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        try {
            val am = reactCtx.getSystemService(AutofillManager::class.java)
            promise.resolve(am != null && am.hasEnabledAutofillServices())
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        try {
            val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                data = Uri.parse("package:${reactCtx.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val activity = currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                reactCtx.startActivity(intent)
            }
            promise.resolve(true)
        } catch (_: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactCtx.startActivity(fallback)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("AUTOFILL_SETTINGS_ERR", e)
            }
        }
    }

    @ReactMethod
    fun getPrefs(promise: Promise) {
        try {
            val map = Arguments.createMap().apply {
                putBoolean("syncEnabled", SseAutofillStore.isSyncEnabled(reactCtx))
                putBoolean("requireAuth", SseAutofillStore.isRequireAuth(reactCtx))
                putInt("count", SseAutofillStore.loadEntries(reactCtx).size)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("AUTOFILL_PREFS_ERR", e)
        }
    }

    @ReactMethod
    fun setPrefs(syncEnabled: Boolean, requireAuth: Boolean, promise: Promise) {
        try {
            SseAutofillStore.setPrefs(reactCtx, syncEnabled, requireAuth)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUTOFILL_PREFS_ERR", e)
        }
    }

    @ReactMethod
    fun syncEntries(entriesJson: String, promise: Promise) {
        try {
            val count = SseAutofillStore.saveEntriesJson(reactCtx, entriesJson)
            promise.resolve(count)
        } catch (e: Exception) {
            promise.reject("AUTOFILL_SYNC_ERR", e)
        }
    }

    @ReactMethod
    fun clearEntries(promise: Promise) {
        try {
            SseAutofillStore.clearEntries(reactCtx)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUTOFILL_CLEAR_ERR", e)
        }
    }

    @ReactMethod
    fun getPendingSaves(promise: Promise) {
        try {
            promise.resolve(SseAutofillStore.getPendingSavesJson(reactCtx))
        } catch (e: Exception) {
            promise.reject("AUTOFILL_PENDING_ERR", e)
        }
    }

    @ReactMethod
    fun clearPendingSaves(promise: Promise) {
        try {
            SseAutofillStore.clearPendingSaves(reactCtx)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUTOFILL_PENDING_CLEAR_ERR", e)
        }
    }
}
