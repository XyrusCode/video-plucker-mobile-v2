package expo.modules.ytpluck

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.ytpluck.EngineManager.cancel
import expo.modules.ytpluck.EngineManager.download
import expo.modules.ytpluck.EngineManager.updateEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Foreground service that owns the lifecycle of active downloads. Declared with the `dataSync`
 * foreground-service type so the OS grants it sustained network + CPU while the app is
 * minimized or the screen is off. A ref-counted partial WakeLock is held while at least one
 * download is actively running.
 *
 * Downloads run concurrently. Pause is graceful — it kills the yt-dlp process tree but keeps
 * the partial file + download archive on disk; resume re-runs yt-dlp with `--continue`.
 *
 * Port of the V1 `DownloadService`; progress is published via [JobBus] to the Expo module.
 */
class DownloadService : Service() {

  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val jobs = ConcurrentHashMap<String, Job>()

  /** Params for a job that is running or paused (kept so resume can relaunch it). */
  private data class PendingJob(
    val jobId: String,
    val url: String,
    val qualityId: String,
    val destDir: String,
    val cookiesPath: String?,
  )

  private val jobParams = ConcurrentHashMap<String, PendingJob>()
  private val pausedJobs = ConcurrentHashMap.newKeySet<String>()
  private val cancelledJobs = ConcurrentHashMap.newKeySet<String>()

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val jobId = intent?.getStringExtra(EXTRA_JOB_ID)
    when (intent?.action) {
      ACTION_STOP -> if (jobId != null) cancelJob(jobId)
      ACTION_PAUSE -> if (jobId != null) pauseJob(jobId)
      ACTION_RESUME -> if (jobId != null) resumeJob(jobId)
      else -> {
        val id = jobId ?: return dropIfIdle(startId)
        val url = intent.getStringExtra(EXTRA_URL) ?: return dropIfIdle(startId)
        val qualityId = intent.getStringExtra(EXTRA_QUALITY) ?: Quality.BEST.id
        val destDir = intent.getStringExtra(EXTRA_DEST) ?: defaultDestDir()
        val cookiesPath = intent.getStringExtra(EXTRA_COOKIES)
        startJob(id, url, qualityId, destDir, cookiesPath)
      }
    }
    // Re-deliver the original intent if the process is killed mid-download.
    return START_REDELIVER_INTENT
  }

  private fun startJob(jobId: String, url: String, qualityId: String, destDir: String, cookiesPath: String?) {
    val params = PendingJob(jobId, url, qualityId, destDir, cookiesPath)
    jobParams[jobId] = params
    launchJob(params)
  }

  private fun launchJob(p: PendingJob, resumePercent: Float? = null) {
    // Promote to foreground immediately (Android requires startForeground within ~5s).
    val initial = JobProgress(
      jobId = p.jobId,
      title = shortTitleFrom(p.url),
      percent = resumePercent ?: 0f,
      speedBytesPerSec = -1f,
      etaSeconds = -1L,
      status = JobStatus.RUNNING,
      url = p.url,
    )
    JobBus.postProgress(initial)
    startForegroundWithNotification(p.jobId, initial)
    acquireWakeLock()

    val job = serviceScope.launch {
      var last = initial
      // Download into a private working dir; publish the finished file to the public
      // gallery afterwards. On pause the dir is retained so `--continue` can resume.
      val workDir = File(cacheDir, "ytwork/${p.jobId}")
      val archivePath = File(workDir, "archive.txt").absolutePath
      var keepWorkDir = false
      try {
        val engineUrl = normalizeForEngine(p.url)
        workDir.mkdirs()
        val onProgress: (Float, Long, String) -> Unit = { percent, etaSeconds, line ->
          val speed = parseSpeedBytesPerSec(line)
          last = last.copy(
            title = parseTitle(line) ?: last.title,
            percent = percent.coerceIn(0f, 100f),
            speedBytesPerSec = speed ?: last.speedBytesPerSec,
            etaSeconds = etaSeconds,
            status = JobStatus.RUNNING,
          )
          JobBus.postProgress(last)
          updateNotification(p.jobId, last)
        }
        suspend fun runOnce() = download(
          url = engineUrl, qualityId = p.qualityId, destDir = workDir.absolutePath,
          jobId = p.jobId, cookiesPath = p.cookiesPath, archivePath = archivePath,
          onProgress = onProgress,
        )
        try {
          runOnce()
        } catch (e: Exception) {
          // If extraction failed because the bundled yt-dlp has gone stale against a site
          // change, pull the latest binary and retry once — self-healing. Pause and cancel
          // are intentional kills, not engine staleness, so never retry.
          if (pausedJobs.contains(p.jobId) || cancelledJobs.contains(p.jobId) ||
            isCancellation(e) || !isStaleEngineError(e.message)
          ) throw e
          notifyUpdating(p.jobId, last)
          updateEngine(applicationContext)
          runOnce()
        }
        exportProduced(workDir)
        last = last.copy(percent = 100f, status = JobStatus.COMPLETED)
        JobBus.postProgress(last)
      } catch (e: Exception) {
        val paused = pausedJobs.remove(p.jobId)
        val cancelled = cancelledJobs.remove(p.jobId) || isCancellation(e)
        last = last.copy(
          status = when {
            paused -> JobStatus.PAUSED
            cancelled -> JobStatus.CANCELLED
            else -> JobStatus.FAILED
          },
          error = if (paused || cancelled) null else failureMessage(p.url, e),
        )
        JobBus.postProgress(last)
        keepWorkDir = paused
      } finally {
        if (p.cookiesPath != null && p.cookiesPath.startsWith(cacheDir.path)) {
          File(p.cookiesPath).delete() // temp WebView-cookie file, clean up after the run
        }
        if (!keepWorkDir) workDir.deleteRecursively()
        onJobFinished(p.jobId, last, keepWorkDir)
      }
    }
    jobs[p.jobId] = job
  }

  /** Copy the finished media file(s) from the working dir into the public gallery by type. */
  private fun exportProduced(workDir: File) {
    val media = workDir.listFiles()?.filter {
      it.isFile && it.length() > 0 &&
        !it.name.endsWith(".part", true) &&
        !it.name.endsWith(".ytdl", true) &&
        !it.name.endsWith(".tmp", true)
    }.orEmpty()
    media.forEach { f -> runCatching { MediaExporter.export(this, f) } }
  }

  private fun cancelJob(jobId: String) {
    cancelledJobs.add(jobId)
    cancel(jobId)
    jobs[jobId]?.cancel()
  }

  private fun pauseJob(jobId: String) {
    // Graceful pause: kill yt-dlp but keep the partial file + archive. The running
    // coroutine catches the destroyed process and marks the job PAUSED.
    pausedJobs.add(jobId)
    cancel(jobId)
  }

  private fun resumeJob(jobId: String) {
    val params = jobParams[jobId] ?: return
    // The paused coroutine may still be unwinding; don't double-launch.
    if (jobs[jobId] != null) return
    pausedJobs.remove(jobId)
    // Purge any lingering engine process-registry entry so the relaunch can't trip the
    // library's "Process ID already exists" guard.
    cancel(jobId)
    val last = lastProgress(jobId)
    val resumePercent = last?.percent?.takeIf { it > 0f }
    launchJob(params, resumePercent)
  }

  private fun lastProgress(jobId: String): JobProgress? = latestProgress[jobId]

  private fun stopWhenIdle() {
    if (jobs.isEmpty() && jobParams.isEmpty()) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  /**
   * A short-link (vm./vt./t/) can hide a photo post, which only reveals itself once yt-dlp has
   * resolved the redirect and rejected the URL. Login-required errors get a plain-English hint
   * pointing at Settings → Cookies instead of a raw yt-dlp dump.
   */
  private fun failureMessage(url: String, e: Exception): String? {
    val msg = e.message ?: return null
    if (url.contains("tiktok.com", ignoreCase = true) &&
      msg.contains("Unsupported URL", ignoreCase = true)
    ) {
      return "TikTok photo/slideshow posts require Image quality — switch to Image and try again."
    }
    return if (isLoginRequiredError(msg)) {
      "This video requires a logged-in account. Open Settings → Cookies, log in (or import a " +
        "cookies.txt file) for the site, then try again."
    } else {
      msg
    }
  }

  private fun onJobFinished(jobId: String, last: JobProgress, paused: Boolean) {
    jobs.remove(jobId)
    if (paused) {
      releaseWakeLock()
      if (hasNotifPermission()) {
        NotificationManagerCompat.from(this).notify(jobId.hashCode(), buildPausedNotification(jobId, last))
      }
      ensureForegroundNotification()
      return
    }
    jobParams.remove(jobId)
    releaseWakeLock()
    NotificationManagerCompat.from(this).cancel(jobId.hashCode())
    if (last.status == JobStatus.FAILED) notifyFailed(jobId, last)
    ensureForegroundNotification()
    stopWhenIdle()
  }

  /**
   * Re-assert a foreground notification when the finishing job's notification happened to back
   * the foreground state while other jobs (or paused jobs) keep the service alive.
   */
  private fun ensureForegroundNotification() {
    if (jobs.isNotEmpty()) {
      jobs.keys.firstOrNull()?.let { running ->
        lastProgress(running)?.let { startForegroundWithNotification(running, it) }
      }
      return
    }
    pausedJobs.firstOrNull()?.let { paused ->
      lastProgress(paused)?.let { p ->
        val notification = buildPausedNotification(paused, p)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          startForeground(
            paused.hashCode(), notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
          )
        } else {
          startForeground(paused.hashCode(), notification)
        }
      }
    }
  }

  /** A dismissible notification carrying the failure reason and a Report action (pre-filled GitHub issue). */
  private fun notifyFailed(jobId: String, p: JobProgress) {
    if (!hasNotifPermission()) return
    val reason = p.error ?: "Download failed"
    val reportIntent = Intent(Intent.ACTION_VIEW, Uri.parse(reportIssueUrl(p, appVersion(this))))
    val reportPi = PendingIntent.getActivity(
      this, reportNotifId(jobId), reportIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notif = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_download)
      .setContentTitle("Download failed")
      .setContentText(reason)
      .setStyle(NotificationCompat.BigTextStyle().bigText("${p.title}\n$reason"))
      .setOngoing(false)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .addAction(0, "Report", reportPi)
      .build()
    NotificationManagerCompat.from(this).notify(failureNotifId(jobId), notif)
  }

  private fun failureNotifId(jobId: String): Int = jobId.hashCode() + 1

  private fun reportNotifId(jobId: String): Int = jobId.hashCode() + 2

  private fun dropIfIdle(startId: Int): Int {
    if (jobs.isEmpty()) stopSelf(startId)
    return START_NOT_STICKY
  }

  // --- Notifications ------------------------------------------------------------------------

  private fun startForegroundWithNotification(jobId: String, p: JobProgress) {
    val notification = buildNotification(jobId, p)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        jobId.hashCode(),
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else {
      startForeground(jobId.hashCode(), notification)
    }
  }

  private fun updateNotification(jobId: String, p: JobProgress) {
    if (hasNotifPermission()) {
      NotificationManagerCompat.from(this).notify(jobId.hashCode(), buildNotification(jobId, p))
    }
  }

  /** Show an indeterminate "Updating downloader…" notification while yt-dlp self-updates. */
  private fun notifyUpdating(jobId: String, p: JobProgress) {
    JobBus.postProgress(
      p.copy(percent = 0f, speedBytesPerSec = -1f, etaSeconds = -1L, status = JobStatus.RUNNING),
    )
    if (!hasNotifPermission()) return
    val notif = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_download)
      .setContentTitle(p.title)
      .setContentText("Updating downloader…")
      .setProgress(0, 0, true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    NotificationManagerCompat.from(this).notify(jobId.hashCode(), notif)
  }

  private fun hasNotifPermission(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      androidx.core.app.ActivityCompat.checkSelfPermission(
        this, android.Manifest.permission.POST_NOTIFICATIONS,
      ) == android.content.pm.PackageManager.PERMISSION_GRANTED

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_LOW,
        ).apply {
          description = CHANNEL_DESC
          setShowBadge(false)
        },
      )
    }
  }

  private fun isCancellation(e: Throwable): Boolean =
    e is kotlinx.coroutines.CancellationException ||
      e is InterruptedException ||
      e.message?.contains("cancel", ignoreCase = true) == true

  private fun servicePendingIntent(action: String, jobId: String, requestCode: Int): PendingIntent {
    val intent = Intent(this, DownloadService::class.java).apply {
      this.action = action
      putExtra(EXTRA_JOB_ID, jobId)
    }
    return PendingIntent.getService(
      this, requestCode, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun buildNotification(jobId: String, p: JobProgress): Notification {
    val pct = p.percent.toInt()
    val speed = formatSpeed(p.speedBytesPerSec)
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_download)
      .setContentTitle(p.title)
      .setContentText("Downloading: $pct% • $speed")
      .setProgress(100, pct, pct == 0)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(0, "Pause", servicePendingIntent(ACTION_PAUSE, jobId, jobId.hashCode() + 3))
      .addAction(0, "Cancel", servicePendingIntent(ACTION_STOP, jobId, jobId.hashCode()))
      .build()
  }

  /** Ongoing "Paused" notification with a Resume action; replaces the progress notification. */
  private fun buildPausedNotification(jobId: String, p: JobProgress): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_download)
      .setContentTitle(p.title)
      .setContentText("Paused at ${p.percent.toInt()}%")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(0, "Resume", servicePendingIntent(ACTION_RESUME, jobId, jobId.hashCode() + 4))
      .addAction(0, "Cancel", servicePendingIntent(ACTION_STOP, jobId, jobId.hashCode()))
      .build()

  // --- Wake lock ----------------------------------------------------------------------------

  /** Ref-counted: one acquire per running job, released when that job ends or pauses. */
  private fun acquireWakeLock() {
    if (wakeLock == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKELOCK_TAG).apply {
        setReferenceCounted(true)
      }
    }
    wakeLock?.acquire(WAKELOCK_TIMEOUT_MS)
  }

  private fun releaseWakeLock() {
    val lock = wakeLock ?: return
    if (lock.isHeld) lock.release()
  }

  override fun onDestroy() {
    wakeLock?.let { lock ->
      lock.setReferenceCounted(false)
      if (lock.isHeld) lock.release()
    }
    wakeLock = null
    serviceScope.cancel()
    super.onDestroy()
  }

  private fun defaultDestDir(): String =
    (getExternalFilesDir(android.os.Environment.DIRECTORY_MOVIES) ?: filesDir).absolutePath

  companion object {
    const val ACTION_START = "expo.modules.ytpluck.action.START"
    const val ACTION_STOP = "expo.modules.ytpluck.action.STOP"
    const val ACTION_PAUSE = "expo.modules.ytpluck.action.PAUSE"
    const val ACTION_RESUME = "expo.modules.ytpluck.action.RESUME"
    const val EXTRA_JOB_ID = "jobId"
    const val EXTRA_URL = "url"
    const val EXTRA_QUALITY = "quality"
    const val EXTRA_DEST = "dest"
    const val EXTRA_COOKIES = "cookiesPath"

    const val CHANNEL_ID = "downloads"
    const val CHANNEL_NAME = "Downloads"
    const val CHANNEL_DESC = "Download progress and failures"

    private const val WAKELOCK_TAG = "ytplucker:download"
    private const val WAKELOCK_TIMEOUT_MS = 6L * 60 * 60 * 1000 // 6h safety cap

    /** Latest progress snapshot per job, used for paused-notification resume percentages. */
    val latestProgress = ConcurrentHashMap<String, JobProgress>()

    /** Build the start intent used by the JS layer. */
    fun startIntent(
      context: Context,
      jobId: String,
      url: String,
      qualityId: String,
      destDir: String?,
      cookiesPath: String?,
    ): Intent = Intent(context, DownloadService::class.java).apply {
      action = ACTION_START
      putExtra(EXTRA_JOB_ID, jobId)
      putExtra(EXTRA_URL, url)
      putExtra(EXTRA_QUALITY, qualityId)
      if (destDir != null) putExtra(EXTRA_DEST, destDir)
      if (cookiesPath != null) putExtra(EXTRA_COOKIES, cookiesPath)
    }
  }
}

/**
 * True when a yt-dlp error means "this content needs a logged-in account" rather than a
 * transient failure. VK videos are commonly restricted to registered users; YouTube and TikTok
 * throw bot-check / sign-in prompts; a raw 401 also means auth.
 */
private fun isLoginRequiredError(message: String): Boolean {
  val m = message.lowercase()
  return listOf(
    "only available to registered users",
    "only available for registered users",
    "available to registered users",
    "available for registered users",
    "sign in to confirm you're not a bot",
    "sign in to verify",
    "requires authentication",
    "requires login",
    "must be logged in",
    "login required",
    "please sign in",
    "not a bot",
    "account is required",
    "http error 401",
    "unauthorized",
  ).any { m.contains(it) }
}

/**
 * Build the GitHub issue URL a failed download's Report action opens. Pre-filled with app
 * version, title, URL and the raw yt-dlp error.
 */
fun reportIssueUrl(p: JobProgress, appVersion: String): String {
  val title = "Download failed: ${p.title.take(80)}"
  val body = buildString {
    appendLine("**App:** Video Plucker $appVersion")
    appendLine("**Progress:** ${p.percent.toInt()}%")
    appendLine("**Title:** ${p.title}")
    appendLine("**URL:** ${p.url}")
    appendLine()
    appendLine("**Error:**")
    appendLine("```")
    appendLine(p.error ?: "unknown error")
    appendLine("```")
  }
  val query = "issue[title]=${Uri.encode(title)}&issue[description]=${Uri.encode(body)}"
  return "https://gitlab.com/KyriosNyx/video-plucker-mobile-v2/-/issues/new?$query"
}

private fun appVersion(context: Context): String =
  runCatching {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    info.versionName ?: "?"
  }.getOrDefault("?")