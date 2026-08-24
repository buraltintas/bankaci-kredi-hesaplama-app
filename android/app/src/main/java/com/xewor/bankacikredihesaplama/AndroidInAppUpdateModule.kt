package com.xewor.bankacikredihesaplama

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

class AndroidInAppUpdateModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AndroidInAppUpdate"

  @Suppress("DEPRECATION")
  @ReactMethod
  fun startImmediateUpdate(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activity = reactContext.currentActivity

      if (activity == null) {
        promise.resolve(false)
        return@runOnUiThread
      }

      val updateManager = AppUpdateManagerFactory.create(reactContext)

      updateManager.appUpdateInfo
        .addOnSuccessListener { updateInfo ->
          val updateAvailable =
            updateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
              updateInfo.updateAvailability() ==
              UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS

          if (
            !updateAvailable ||
            !updateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
          ) {
            promise.resolve(false)
            return@addOnSuccessListener
          }

          try {
            val didStart = updateManager.startUpdateFlowForResult(
              updateInfo,
              activity,
              AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
              UPDATE_REQUEST_CODE
            )
            promise.resolve(didStart)
          } catch (error: Exception) {
            promise.reject("IN_APP_UPDATE_FAILED", error)
          }
        }
        .addOnFailureListener { error ->
          promise.reject("IN_APP_UPDATE_INFO_FAILED", error)
        }
    }
  }

  companion object {
    private const val UPDATE_REQUEST_CODE = 7318
  }
}
