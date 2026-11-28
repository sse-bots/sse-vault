package com.sse.vault.updater

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class SseUpdaterModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    override fun getName(): String = "SseUpdater"

    @ReactMethod
    fun canInstallPackages(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(true)
                return
            }
            promise.resolve(reactCtx.packageManager.canRequestPackageInstalls())
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openInstallPermissionSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(true)
                return
            }
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${reactCtx.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val activity = currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                reactCtx.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INSTALL_PERM_ERR", e)
        }
    }

    @ReactMethod
    fun installApk(rawPath: String, promise: Promise) {
        try {
            val cleanPath = rawPath.removePrefix("file://")
            val apkFile = File(cleanPath)
            if (!apkFile.exists() || apkFile.length() <= 0L) {
                promise.reject("APK_NOT_FOUND", "Downloaded APK file is missing or empty.")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !reactCtx.packageManager.canRequestPackageInstalls()
            ) {
                promise.reject("PERMISSION_REQUIRED", "Enable 'Allow from this source' for SSE Vault to install updates.")
                return
            }

            val authority = "${reactCtx.packageName}.sseupdater.provider"
            val contentUri = FileProvider.getUriForFile(reactCtx, authority, apkFile)

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val activity = currentActivity
            if (activity != null) {
                activity.startActivity(installIntent)
            } else {
                reactCtx.startActivity(installIntent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("APK_INSTALL_ERR", e.message ?: "Could not launch Android APK installer.", e)
        }
    }
}
