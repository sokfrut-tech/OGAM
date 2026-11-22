package ai.offgridmobile.storage

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Reports and opens Android's special all-files-access setting.
 *
 * This module never requests the permission automatically. The user must explicitly
 * initiate the settings screen from a feature that genuinely needs broad file access.
 * Prefer the Storage Access Framework (ACTION_OPEN_DOCUMENT_TREE) for ordinary imports.
 */
class StoragePermissionModule(
    private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
    override fun getName(): String = "StoragePermissionModule"

    @ReactMethod
    fun isAllFilesAccessGranted(promise: Promise) {
        promise.resolve(
            Build.VERSION.SDK_INT < Build.VERSION_CODES.R ||
                Environment.isExternalStorageManager(),
        )
    }

    @ReactMethod
    fun openAllFilesAccessSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                promise.resolve(true)
                return
            }

            val intent = Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:${context.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            if (intent.resolveActivity(context.packageManager) == null) {
                promise.reject(
                    "storage_settings_unavailable",
                    "Android does not provide the app-specific all-files-access settings screen.",
                )
                return
            }

            context.startActivity(intent)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("storage_settings_open_failed", error)
        }
    }
}
