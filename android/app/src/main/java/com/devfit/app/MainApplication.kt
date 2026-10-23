package com.devfit.app

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.devfit.app.eventreporter.LiftosaurEventReporterPackage
import com.devfit.app.fasttext.FastTextPackage
import com.devfit.app.liftoeditor.LiftoEditorPackage
import com.devfit.app.imageresizer.LiftosaurImageResizerPackage
import com.devfit.app.lftupdater.LftUpdaterPackage
import com.devfit.app.lftupdater.LftUpdaterPath
import com.devfit.app.liveactivity.LiftosaurLiveActivityPackage
import com.devfit.app.profiler.LiftosaurProfilerPackage
import com.devfit.app.push.LiftosaurPushPackage
import com.devfit.app.share.LiftosaurSharePackage
import com.devfit.app.timer.LiftosaurTimerPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(LiftosaurSharePackage())
          add(LiftosaurTimerPackage())
          add(LiftosaurLiveActivityPackage())
          add(LiftosaurEventReporterPackage())
          add(LftUpdaterPackage())
          add(FastTextPackage())
          add(LiftoEditorPackage())
          add(LiftosaurImageResizerPackage())
          add(LiftosaurPushPackage())
          add(LiftosaurProfilerPackage())
        },
      jsMainModulePath = "index",
      jsBundleFilePath = if (BuildConfig.DISABLE_OTA) null else LftUpdaterPath.effectiveBundleFilePath(this),
    )
  }

  override fun onCreate() {
    super.onCreate()
    val prefs = getSharedPreferences("LftUpdater", MODE_PRIVATE)
    if (prefs.getBoolean("launchInProgress", false)) {
      val count = prefs.getInt("crashCount", 0) + 1
      prefs.edit().putInt("crashCount", count).apply()
      Log.w("LftUpdater", "previous launch did not complete; crashCount=$count activeId=${LftUpdaterPath.activeUpdateId(this) ?: "<none>"}")
      if (count >= 3) {
        Log.e("LftUpdater", "crashCount reached $count, reverting to embedded bundle")
        LftUpdaterPath.revertToEmbedded(this)
        prefs.edit().putInt("crashCount", 0).apply()
      }
    } else {
      Log.i("LftUpdater", "launch starting, activeId=${LftUpdaterPath.activeUpdateId(this) ?: "<none>"}")
    }
    prefs.edit().putBoolean("launchInProgress", true).apply()
    loadReactNative(this)
  }

}
