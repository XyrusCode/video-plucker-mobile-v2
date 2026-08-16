package expo.modules.ytpluck

import java.util.concurrent.CopyOnWriteArrayList

/**
 * In-process bus bridging the foreground [DownloadService] to the Expo module, which forwards
 * to JS as events. The service runs in the same process, so a plain singleton works — no IPC.
 */
object JobBus {

  private val progressObservers = CopyOnWriteArrayList<(JobProgress) -> Unit>()

  fun subscribeProgress(observer: (JobProgress) -> Unit): (JobProgress) -> Unit {
    progressObservers.add(observer)
    return observer
  }

  fun unsubscribeProgress(observer: (JobProgress) -> Unit) {
    progressObservers.remove(observer)
  }

  fun postProgress(progress: JobProgress) {
    progressObservers.forEach { it(progress) }
  }
}

/**
 * A snapshot of a download's progress. Immutable; safe to fan out through [JobBus].
 * Mirrors the V1 domain model (statuses map 1:1 to the JS JobStatus strings).
 */
data class JobProgress(
  val jobId: String,
  val title: String,
  val percent: Float,
  val speedBytesPerSec: Float,
  val etaSeconds: Long,
  val status: String,
  val error: String? = null,
  val url: String = "",
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "jobId" to jobId,
    "title" to title,
    "percent" to percent,
    "speedBytesPerSec" to speedBytesPerSec,
    "etaSeconds" to etaSeconds,
    "status" to status,
    "error" to error,
    "url" to url,
  )
}

/** Terminal / running states for a single download job. */
object JobStatus {
  const val RUNNING = "RUNNING"
  const val QUEUED = "QUEUED"
  const val PAUSED = "PAUSED"
  const val COMPLETED = "COMPLETED"
  const val FAILED = "FAILED"
  const val CANCELLED = "CANCELLED"
}