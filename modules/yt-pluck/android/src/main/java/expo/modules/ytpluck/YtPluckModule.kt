package expo.modules.ytpluck

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * The single native surface the JS layer talks to. Wraps the yt-dlp engine, the foreground
 * download service, the media gallery exporter/history, WebView cookie access, and the
 * Android share target.
 */
class YtPluckModule : Module() {

  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var progressObserver: ((JobProgress) -> Unit)? = null

  override fun definition() = ModuleDefinition {
    Name("YtPluck")

    Events("downloadProgress", "sharedUrl")

    // --- Engine -------------------------------------------------------------------------

    /** Init the bundled Python/yt-dlp/ffmpeg payloads + best-effort yt-dlp self-update. */
    AsyncFunction("initEngineAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      ensureNotificationChannels(context)
      val inited = EngineManager.init(context)
      if (inited) {
        // Self-heal: pull the latest yt-dlp binary in the background, best-effort.
        moduleScope.launch { EngineManager.updateEngine(context) }
      }
      inited
    }

    /** Pull the latest yt-dlp binary now (Settings → "Update downloader" style calls). */
    AsyncFunction("updateEngineAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      EngineManager.updateEngine(context)
    }

    /** Fetch metadata only. Rejects with the yt-dlp error message on failure. */
    AsyncFunction("probeAsync") { url: String ->
      EngineManager.probe(url)
    }

    // --- Downloads ----------------------------------------------------------------------

    /** Start a download in the foreground service. Returns the stable job id. */
    AsyncFunction("startDownloadAsync") { url: String, qualityId: String, cookiesPath: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      ensureNotificationChannels(context)
      val jobId = "job-${System.currentTimeMillis()}"
      val intent = DownloadService.startIntent(context, jobId, url, qualityId, null, cookiesPath)
      context.startService(intent)
      jobId
    }

    Function("pauseDownloadAsync") { jobId: String ->
      sendServiceAction(DownloadService.ACTION_PAUSE, jobId)
    }

    Function("resumeDownloadAsync") { jobId: String ->
      sendServiceAction(DownloadService.ACTION_RESUME, jobId)
    }

    Function("cancelDownloadAsync") { jobId: String ->
      sendServiceAction(DownloadService.ACTION_STOP, jobId)
    }

    // --- Platform helpers ---------------------------------------------------------------

    /** Raw cookie string the system WebView holds for [url], or null. */
    Function("getCookiesAsync") { url: String ->
      EngineManager.getCookies(url)
    }

    /**
     * Persist [cookieLines] (already Netscape-format) under cache/cookies/<key>.txt and
     * return its absolute path — the real path yt-dlp needs, not a content:// URI.
     */
    AsyncFunction("saveCookiesFileAsync") { key: String, cookieLines: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      val dir = File(context.cacheDir, "cookies").apply { mkdirs() }
      val file = File(dir, "$key.txt")
      runCatching {
        file.writeText(cookieLines)
        file.absolutePath
      }.getOrNull()
    }

    /** Everything this app has exported to the public gallery, newest first. */
    AsyncFunction("queryHistoryAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      MediaExporter.queryHistory(context)
    }

    /** URL from the intent that launched the app (share sheet / deep link), or null. */
    Function("getInitialSharedUrl") {
      val activity = appContext.currentActivity
      val intent = activity?.intent ?: return@Function null
      EngineManager.extractSharedUrl(intent)
    }

    // --- Events -------------------------------------------------------------------------

    OnStartObserving("downloadProgress") {
      progressObserver = JobBus.subscribeProgress { progress ->
        sendEvent("downloadProgress", progress.toMap())
      }
    }

    OnStopObserving("downloadProgress") {
      progressObserver?.let { JobBus.unsubscribeProgress(it) }
      progressObserver = null
    }

    OnNewIntent { intent ->
      EngineManager.extractSharedUrl(intent)?.let { url ->
        sendEvent("sharedUrl", Bundle().apply { putString("url", url) })
      }
    }
  }

  private fun sendServiceAction(action: String, jobId: String) {
    val context = appContext.reactContext ?: return
    val intent = android.content.Intent(context, DownloadService::class.java).apply {
      this.action = action
      putExtra(DownloadService.EXTRA_JOB_ID, jobId)
    }
    runCatching { context.startService(intent) }
  }

  private fun ensureNotificationChannels(context: android.content.Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = context.getSystemService(NotificationManager::class.java)
      val downloads = NotificationChannel(
        DownloadService.CHANNEL_ID,
        DownloadService.CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = DownloadService.CHANNEL_DESC
        setShowBadge(false)
      }
      manager.createNotificationChannel(downloads)
    }
  }
}