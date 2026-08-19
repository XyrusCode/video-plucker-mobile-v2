package expo.modules.ytpluck

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Target of the failure notification's "Report" action. Fires a user-initiated Sentry event
 * with the failed download's context — no GitHub/GitLab issue links anymore. The Sentry
 * Android SDK is bundled with the app via `@sentry/react-native`; this module compiles against
 * it with `compileOnly` so the runtime class is always present. Best-effort: if the DSN isn't
 * set (or Sentry hasn't been initialized from JS), the capture is a no-op.
 */
class ReportReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val jobId = intent.getStringExtra(DownloadService.EXTRA_JOB_ID)
    val p = jobId?.let { DownloadService.latestProgress[it] }
    val title = p?.title ?: "Unknown"
    val error = p?.error ?: "no error detail"
    val url = p?.url ?: intent.getStringExtra(DownloadService.EXTRA_URL) ?: ""
    io.sentry.Sentry.withScope { scope ->
      scope.setTag("source", "user-report")
      scope.setExtra("appVersion", runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
      }.getOrNull() ?: "?")
      scope.setExtra("url", url)
      scope.setExtra("error", error)
      io.sentry.Sentry.captureMessage(
        "Download failed: ${title.take(80)}",
        io.sentry.SentryLevel.ERROR,
      )
    }
  }
}