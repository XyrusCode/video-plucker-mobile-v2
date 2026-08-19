package expo.modules.ytpluck

import android.content.Context
import android.content.Intent
import android.webkit.CookieManager
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Thin wrapper over youtubedl-android (yt-dlp + ffmpeg) — the piece that "pipes the stream to
 * disk". yt-dlp owns the socket and file handle, so heap usage stays flat regardless of file
 * size. Faithful port of the V1 `DownloadManager` (which itself mirrors the desktop app's
 * `download.rs::build_args`).
 */
object EngineManager {

  @Volatile
  private var initialized = false

  /** Bounds the per-session self-heal: only the first probe failure of a session triggers a
   * yt-dlp update + retry (unless the error is a known-stale signature, which always does). */
  @Volatile
  private var selfHealedThisSession = false

  /** Init the bundled Python/yt-dlp/ffmpeg payloads once. Best-effort; never throws. */
  suspend fun init(context: Context): Boolean = withContext(Dispatchers.IO) {
    if (initialized) return@withContext true
    runCatching {
      YoutubeDL.init(context.applicationContext)
      FFmpeg.init(context.applicationContext)
      initialized = true
    }.isSuccess
  }

  /** Pull the latest yt-dlp binary and persist it. Best-effort (e.g. offline → false). */
  suspend fun updateEngine(context: Context): Boolean = withContext(Dispatchers.IO) {
    if (!initialized) init(context)
    runCatching { YoutubeDL.updateYoutubeDL(context.applicationContext) }.isSuccess
  }

  /**
   * Fetch metadata only (yt-dlp `-J`). Never throws: failures return a `{ok=false, error}`
   * map with a readable message so the JS layer never sees a bare rejection.
   *
   * Self-heals like downloads: ensures the engine is initialized first, normalizes the URL
   * for the engine, and on a stale-engine signature (or the first probe failure of the
   * session) updates yt-dlp and retries once. Probes use the same request options as
   * downloads (no-config, no-playlist, platform cookies, TikTok web-fallback) so analysis
   * sees exactly what the download would see.
   */
  suspend fun probe(
    context: Context,
    url: String,
    cookiesPath: String?,
  ): Map<String, Any?> = withContext(Dispatchers.IO) {
    val failure = { msg: String ->
      mapOf("ok" to false, "error" to msg)
    }
    if (!initialized && !init(context)) {
      return@withContext failure(
        "The downloader engine could not start. Restart the app, or tap Settings → Update " +
          "downloader, then try again."
      )
    }
    val target = normalizeForEngine(url)
    val request = YoutubeDLRequest(target).apply {
      addOption("--no-config")
      addOption("--no-playlist")
      if (cookiesPath != null) {
        addOption("--cookies", cookiesPath)
      }
      // TikTok impersonator workaround: prefer the web extraction path. For photo/slideshow
      // posts, additionally declare the media type so the image pipeline is selected.
      if (target.contains("tiktok.com", ignoreCase = true)) {
        if (isTikTokPhotoUrl(target)) {
          addOption("--extractor-args", "tiktok:web_fallback=true;media_type=image")
        } else {
          addOption("--extractor-args", "tiktok:web_fallback=true")
        }
      }
    }
    var result = runCatching { YoutubeDL.getInfo(request) }
    if (result.isFailure) {
      val msg = exceptionDetail(result.exceptionOrNull()!!)
        .takeIf { it.isNotBlank() }
        ?: "Analysis failed. Update the downloader in Settings and try again."
      if ((isStaleEngineError(msg) || !selfHealedThisSession) && updateEngine(context)) {
        selfHealedThisSession = true
        result = runCatching { YoutubeDL.getInfo(request) }
      }
      if (result.isFailure) {
        val retryMsg = exceptionDetail(result.exceptionOrNull()!!)
          .takeIf { it.isNotBlank() }
          ?: msg
        return@withContext failure(retryMsg)
      }
    }
    runCatching {
      val info = result.getOrThrow()
      val heights = info.formats
        ?.mapNotNull { it.height.takeIf { h -> h > 0 } }
        ?.distinct()
        ?.sorted()
        ?: emptyList()
      mapOf(
        "ok" to true,
        "title" to (info.title ?: url),
        "thumbnailUrl" to info.thumbnail,
        "durationSeconds" to (info.duration.takeIf { it > 0 } ?: -1),
        "uploader" to info.uploader,
        "source" to (info.extractorKey?.takeIf { it.isNotBlank() } ?: info.extractor),
        "availableHeights" to heights,
      )
    }.getOrElse { failure(exceptionDetail(it)) }
  }

  /**
   * Run a download to completion. Blocking (yt-dlp runs synchronously) — always called from a
   * background dispatcher inside the foreground service.
   */
  suspend fun download(
    url: String,
    qualityId: String,
    destDir: String,
    jobId: String,
    cookiesPath: String?,
    archivePath: String?,
    onProgress: (Float, Long, String) -> Unit,
  ) = withContext(Dispatchers.IO) {
    val quality = Quality.fromId(qualityId)
    val request = YoutubeDLRequest(url).apply {
      // Output template mirrors desktop: "Title [id].ext".
      addOption("-o", "$destDir/%(title)s [%(id)s].%(ext)s")
      addOption("--no-playlist")
      addOption("--no-mtime")
      addOption("--newline")
      addOption("--no-config")
      // Resume partial downloads after a pause; harmless on a fresh download.
      addOption("--continue")
      if (archivePath != null) {
        addOption("--download-archive", archivePath)
      }
      // Numeric options passed as strings for API stability across wrapper versions.
      addOption("--retries", "10")
      addOption("--extractor-retries", "3")
      addOption("--file-access-retries", "3")
      // Bandwidth: parallel fragment fetch + generous socket/chunk sizing.
      addOption("--concurrent-fragments", "4")
      addOption("--buffer-size", "16K")
      addOption("--http-chunk-size", "10M")
      if (cookiesPath != null) {
        addOption("--cookies", cookiesPath)
      }
      // TikTok impersonator workaround: prefer the web extraction path. For photo/slideshow
      // posts, additionally declare the media type so the image pipeline is selected.
      if (url.contains("tiktok.com", ignoreCase = true)) {
        if (isTikTokPhotoUrl(url)) {
          addOption("--extractor-args", "tiktok:web_fallback=true;media_type=image")
        } else {
          addOption("--extractor-args", "tiktok:web_fallback=true")
        }
      }
      applyFormat(quality)
    }
    // ffmpeg (from the youtubedl-android ffmpeg module) is auto-discovered for merging.
    YoutubeDL.execute(request, jobId) { progress, etaInSeconds, line ->
      onProgress(progress, etaInSeconds, line)
    }
  }

  /** Kill the yt-dlp (+ffmpeg) process tree for a job. */
  fun cancel(jobId: String): Boolean = YoutubeDL.destroyProcessById(jobId)

  /** Cookies the system WebView holds for [url], or null. Backs the login flow. */
  fun getCookies(url: String): String? = CookieManager.getInstance().getCookie(url)

  /** The plain URL a share/deep-link intent carries, or null. */
  fun extractSharedUrl(intent: Intent?): String? {
    intent ?: return null
    return when (intent.action) {
      Intent.ACTION_SEND ->
        intent.getStringExtra(Intent.EXTRA_TEXT)?.let { firstUrl(it) }
      Intent.ACTION_VIEW -> intent.dataString
      else -> null
    }
  }

  private fun firstUrl(text: String): String? =
    Regex("""https?://\S+""").find(text)?.value

  private fun YoutubeDLRequest.applyFormat(quality: Quality) {
    when (quality) {
      Quality.BEST -> {
        addOption("-f", "bv*+ba/b")
        addOption("--merge-output-format", "mp4")
      }
      Quality.P2160, Quality.P1440, Quality.P1080, Quality.P720, Quality.P480 -> {
        val h = quality.id
        // Trailing `/b` falls back to the best available stream when nothing sits at or
        // below the requested height, so a download never hard-fails on low-res sources.
        addOption("-f", "bv*[height<=$h]+ba/b[height<=$h]/b")
        addOption("--merge-output-format", "mp4")
      }
      Quality.IMAGE -> {
        addOption("-f", "bestimage/best")
        addOption("--merge-output-format", "jpg")
      }
      Quality.MP3 -> {
        addOption("-f", "ba/b")
        addOption("-x")
        addOption("--audio-format", "mp3")
        addOption("--audio-quality", "0")
      }
      Quality.M4A -> {
        addOption("-f", "ba[ext=m4a]/ba/b")
        addOption("-x")
        addOption("--audio-format", "m4a")
      }
    }
  }
}

/** Quality options — mirror the desktop dropdown 1:1 via the same format selectors. */
enum class Quality(val id: String) {
  BEST("best"),
  P2160("2160"),
  P1440("1440"),
  P1080("1080"),
  P720("720"),
  P480("480"),
  IMAGE("image"),
  MP3("mp3"),
  M4A("m4a");

  companion object {
    fun fromId(id: String): Quality = entries.firstOrNull { it.id == id } ?: BEST
  }
}

// --- URL handling (port of V1 Platforms.kt normalization) --------------------------------

private val TIKTOK_HOST =
  Regex("""^(https?://)(?:m\.|www\.)?tiktok\.com/""", RegexOption.IGNORE_CASE)

private val TIKTOK_VIDEO_QUERY = Regex(
  """^(https?://[\w.]*tiktok\.com/@[\w.-]+/video/\d+)\?.*$""",
  RegexOption.IGNORE_CASE,
)

private val TIKTOK_PHOTO_QUERY = Regex(
  """^(https?://[\w.]*tiktok\.com/@[\w.-]+/photo/\d+)\?.*$""",
  RegexOption.IGNORE_CASE,
)

private val TIKTOK_PHOTO_PATH =
  Regex("""tiktok\.com/@[\w.-]+/photo/\d+""", RegexOption.IGNORE_CASE)

/**
 * Canonicalise a URL for yt-dlp: force a literal `www.` on TikTok hosts and strip tracking
 * query params from /@user/video|photo/<id> (they confuse the extractor).
 */
fun normalizeForEngine(url: String): String {
  val normalized = TIKTOK_HOST.replace(url) { "${it.groupValues[1]}www.tiktok.com/" }
  val noVideoQuery = TIKTOK_VIDEO_QUERY.replace(normalized) { it.groupValues[1] }
  return TIKTOK_PHOTO_QUERY.replace(noVideoQuery) { it.groupValues[1] }
}

/** True if [url] is a TikTok photo/slideshow post (/@user/photo/<id>). */
fun isTikTokPhotoUrl(url: String): Boolean = TIKTOK_PHOTO_PATH.containsMatchIn(url)

// --- yt-dlp --newline parsing (port of V1 Formatters.kt) ----------------------------------

private val SPEED_REGEX =
  Regex("""at\s+([\d.]+)\s*([KMG]?i?B)/s""", RegexOption.IGNORE_CASE)

private val DEST_REGEX = Regex("""\[download]\s+Destination:\s+(.+)""")

/** Bytes/sec parsed from a yt-dlp line, or null when the line has no speed token. */
fun parseSpeedBytesPerSec(line: String): Float? {
  val m = SPEED_REGEX.find(line) ?: return null
  val value = m.groupValues[1].toFloatOrNull() ?: return null
  return value * unitMultiplier(m.groupValues[2])
}

/** Best-effort title from a "Destination:" line (filename without extension). */
fun parseTitle(line: String): String? {
  val dest = DEST_REGEX.find(line)?.groupValues?.get(1)?.trim() ?: return null
  return dest.substringAfterLast('/').substringAfterLast('\\').substringBeforeLast('.')
}

/** Placeholder title derived from a URL before the first progress line arrives. */
fun shortTitleFrom(url: String): String =
  url.substringAfter("://").substringBefore('/').ifBlank { "Download" }

/** "2.50 MB/s" style formatting; returns "—" when unknown. */
fun formatSpeed(bytesPerSec: Float): String {
  if (bytesPerSec <= 0f) return "—"
  val mb = bytesPerSec / (1024f * 1024f)
  return if (mb >= 1f) String.format("%.2f MB/s", mb)
  else String.format("%.0f KB/s", bytesPerSec / 1024f)
}

/**
 * A never-blank, maximally-informative string for a failure: the exception type, its message,
 * and the first stack line. yt-dlp's error detail (extractor, HTTP status, etc.) lives in the
 * message; this guarantees it survives the native→JS bridge instead of collapsing to a bare
 * "Analysis failed".
 */
fun exceptionDetail(e: Throwable): String {
  val type = e::class.simpleName ?: "Exception"
  val message = e.message?.trim()?.takeIf { it.isNotBlank() } ?: "no message"
  val frame = e.stackTrace?.firstOrNull()?.toString()
  return if (frame != null) "$type: $message @ $frame" else "$type: $message"
}

/**
 * Heuristic: does this yt-dlp error look like the bundled binary has gone stale against a
 * site's changes (as opposed to a genuine bad URL / network error)? These are the signatures
 * that an `updateYoutubeDL()` + retry typically resolves.
 */
fun isStaleEngineError(message: String?): Boolean {
  val m = message?.lowercase() ?: return false
  return listOf(
    "precondition check failed",
    "unable to extract",
    "http error 400",
    "http error 403",
    "confirm you are on the latest version",
    "nsig extraction failed",
    "unable to download api page",
    "sign in to confirm",
    "please report this issue",
    "requested format is not available",
    "no video formats found",
    "format not found",
    "incomplete data received",
    "unable to download video",
    "impersonator",
    "sign in to",
    "login required",
    "not a bot",
    "captcha",
    "verify you are human",
  ).any { m.contains(it) }
}

private fun unitMultiplier(unit: String): Float = when (unit.uppercase().replace("I", "")) {
  "GB" -> 1024f * 1024f * 1024f
  "MB" -> 1024f * 1024f
  "KB" -> 1024f
  else -> 1f
}