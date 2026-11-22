package ai.offgridmobile.voice

import android.app.Activity
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.service.voice.VoiceInteractionService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * User-mediated Android default-assistant role request.
 *
 * This module never changes the role silently. It opens RoleManager's system-owned
 * confirmation UI and reports the actual post-result role/service state to JS.
 */
class JarvisAssistantRoleModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val REQUEST_CODE = 0x4A52
    private const val ROLE_ASSISTANT = RoleManager.ROLE_ASSISTANT
  }

  private var pendingPromise: Promise? = null

  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity?,
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
    ) {
      if (requestCode != REQUEST_CODE) return
      val promise = synchronized(this@JarvisAssistantRoleModule) {
        pendingPromise.also { pendingPromise = null }
      } ?: return

      // Re-read RoleManager and VoiceInteractionService state; a RESULT_OK alone is
      // not proof that this app actually became the active assistant on this OEM.
      promise.resolve(readStatus())
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = "JarvisAssistantRoleModule"

  override fun invalidate() {
    reactContext.removeActivityEventListener(activityListener)
    val pending = synchronized(this) {
      pendingPromise.also { pendingPromise = null }
    }
    pending?.reject("ROLE_MODULE_INVALIDATED", "Assistant role request was interrupted.")
    super.invalidate()
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      promise.resolve(readStatus())
    } catch (error: Exception) {
      promise.reject("ASSISTANT_ROLE_STATUS_FAILED", error)
    }
  }

  @ReactMethod
  fun requestAssistantRole(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(readStatus())
      return
    }

    val roleManager = reactContext.getSystemService(RoleManager::class.java)
    if (roleManager == null || !roleManager.isRoleAvailable(ROLE_ASSISTANT)) {
      promise.resolve(readStatus())
      return
    }
    if (roleManager.isRoleHeld(ROLE_ASSISTANT)) {
      promise.resolve(readStatus())
      return
    }

    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Open OGAM before requesting the Jarvis assistant role.")
      return
    }

    synchronized(this) {
      if (pendingPromise != null) {
        promise.reject("ROLE_REQUEST_PENDING", "An assistant-role request is already open.")
        return
      }
      pendingPromise = promise
    }

    val requestIntent = try {
      roleManager.createRequestRoleIntent(ROLE_ASSISTANT)
    } catch (error: Exception) {
      synchronized(this) { pendingPromise = null }
      promise.reject("ROLE_INTENT_FAILED", error)
      return
    }

    UiThreadUtil.runOnUiThread {
      try {
        activity.startActivityForResult(requestIntent, REQUEST_CODE)
      } catch (error: Exception) {
        synchronized(this) { pendingPromise = null }
        promise.reject("ROLE_REQUEST_FAILED", error)
      }
    }
  }

  private fun readStatus() = Arguments.createMap().apply {
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val roleManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      reactContext.getSystemService(RoleManager::class.java)
    } else {
      null
    }
    val available = supported && roleManager?.isRoleAvailable(ROLE_ASSISTANT) == true
    val held = available && roleManager?.isRoleHeld(ROLE_ASSISTANT) == true
    val activeService = supported && VoiceInteractionService.isActiveService(
      reactContext,
      ComponentName(reactContext, JarvisVoiceInteractionService::class.java),
    )

    putBoolean("supported", supported)
    putBoolean("roleAvailable", available)
    putBoolean("roleHeld", held)
    putBoolean("activeService", activeService)
    putBoolean("ready", supported && available && held && activeService)
    putInt("androidApi", Build.VERSION.SDK_INT)
  }
}
