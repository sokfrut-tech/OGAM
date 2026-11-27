package ai.offgridmobile.actions

import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Deterministic, allowlisted Android system actions triggered explicitly by Jarvis Ai tools.
 * Timers and alarms keep EXTRA_SKIP_UI = false so the user can see and adjust them in the OS UI.
 */
class JarvisPhoneActionsModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "JarvisPhoneActionsModule"

  @ReactMethod
  fun setTimer(seconds: Int, label: String?, promise: Promise) {
    if (seconds < 1 || seconds > 86_400) {
      promise.reject("INVALID_TIMER_SECONDS", "Длительность таймера должна быть от 1 до 86400 секунд.")
      return
    }
    try {
      val cleanLabel = label?.trim()?.takeIf { it.isNotEmpty() }
      val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
        putExtra(AlarmClock.EXTRA_LENGTH, seconds)
        if (cleanLabel != null) putExtra(AlarmClock.EXTRA_MESSAGE, cleanLabel)
        putExtra(AlarmClock.EXTRA_SKIP_UI, false)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("ok", true)
          putInt("seconds", seconds)
        },
      )
    } catch (error: Throwable) {
      promise.reject("SET_TIMER_FAILED", error.message ?: "Не удалось открыть таймер.", error)
    }
  }

  @ReactMethod
  fun setAlarm(hour: Int, minute: Int, label: String?, promise: Promise) {
    if (hour !in 0..23 || minute !in 0..59) {
      promise.reject("INVALID_ALARM_TIME", "Время будильника должно быть в диапазоне 00:00–23:59.")
      return
    }
    try {
      val cleanLabel = label?.trim()?.takeIf { it.isNotEmpty() }
      val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
        putExtra(AlarmClock.EXTRA_HOUR, hour)
        putExtra(AlarmClock.EXTRA_MINUTES, minute)
        if (cleanLabel != null) putExtra(AlarmClock.EXTRA_MESSAGE, cleanLabel)
        putExtra(AlarmClock.EXTRA_SKIP_UI, false)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("ok", true)
          putInt("hour", hour)
          putInt("minute", minute)
        },
      )
    } catch (error: Throwable) {
      promise.reject("SET_ALARM_FAILED", error.message ?: "Не удалось открыть будильник.", error)
    }
  }

  @ReactMethod
  fun setFlashlight(enabled: Boolean, promise: Promise) {
    try {
      val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
      if (manager == null) {
        promise.reject("FLASHLIGHT_UNAVAILABLE", "Менеджер камеры недоступен.")
        return
      }
      val flashCameraId = manager.cameraIdList.firstOrNull { id ->
        val chars = manager.getCameraCharacteristics(id)
        val hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        val lensFacing = chars.get(CameraCharacteristics.LENS_FACING)
        hasFlash && lensFacing == CameraCharacteristics.LENS_FACING_BACK
      } ?: manager.cameraIdList.firstOrNull { id ->
        manager.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
      }

      if (flashCameraId == null) {
        promise.reject("FLASHLIGHT_UNAVAILABLE", "Вспышка не найдена на этом устройстве.")
        return
      }
      manager.setTorchMode(flashCameraId, enabled)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("ok", true)
          putBoolean("enabled", enabled)
        },
      )
    } catch (error: Throwable) {
      promise.reject("FLASHLIGHT_FAILED", error.message ?: "Не удалось переключить фонарик.", error)
    }
  }

  @ReactMethod
  fun openSystemSettings(section: String, promise: Promise) {
    val clean = section.trim().lowercase()
    val intent = when (clean) {
      "wifi" -> Intent(Settings.ACTION_WIFI_SETTINGS)
      "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
      "sound" -> Intent(Settings.ACTION_SOUND_SETTINGS)
      "display" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
      "battery" -> Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)
      "app" -> Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:${reactContext.packageName}"),
      )
      "main" -> Intent(Settings.ACTION_SETTINGS)
      else -> null
    }
    if (intent == null) {
      promise.reject("INVALID_SETTINGS_SECTION", "Неподдерживаемый раздел настроек: $section")
      return
    }
    try {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("ok", true)
          putString("section", clean)
        },
      )
    } catch (error: Throwable) {
      promise.reject("OPEN_SETTINGS_FAILED", error.message ?: "Не удалось открыть настройки.", error)
    }
  }

  @ReactMethod
  fun openUrl(url: String, promise: Promise) {
    val parsed = runCatching { Uri.parse(url.trim()) }.getOrNull()
    val scheme = parsed?.scheme?.lowercase()
    val host = parsed?.host
    if (parsed == null || (scheme != "http" && scheme != "https") || host.isNullOrBlank()) {
      promise.reject("INVALID_URL", "Разрешены только корректные адреса http:// и https://.")
      return
    }
    try {
      val intent = Intent(Intent.ACTION_VIEW, parsed).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("ok", true)
          putString("url", parsed.toString())
        },
      )
    } catch (error: Throwable) {
      promise.reject("OPEN_URL_FAILED", error.message ?: "Не удалось открыть ссылку.", error)
    }
  }

  @ReactMethod
  fun shareText(text: String, title: String?, promise: Promise) {
    val clean = text.trim()
    if (clean.isEmpty()) {
      promise.reject("EMPTY_SHARE_TEXT", "Текст для отправки пуст.")
      return
    }
    try {
      val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, clean)
      }
      val chooserTitle = title?.trim()?.takeIf { it.isNotEmpty() } ?: "Поделиться"
      val chooser = Intent.createChooser(sendIntent, chooserTitle).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(chooser)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("ok", true)
        },
      )
    } catch (error: Throwable) {
      promise.reject("SHARE_TEXT_FAILED", error.message ?: "Не удалось открыть меню отправки.", error)
    }
  }
}
