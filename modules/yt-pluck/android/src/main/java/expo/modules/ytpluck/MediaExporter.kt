package expo.modules.ytpluck

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import java.io.File

/**
 * Publishes a finished download into the device's public media collections so it shows up in
 * the gallery / music player — routed by type: video to Movies, image to Pictures, audio to
 * Music, each under a "Video Plucker" sub-folder. Port of the V1 exporter.
 */
object MediaExporter {

  /** Public sub-folder name used across all three media roots. */
  const val ALBUM = "Video Plucker"

  private data class Target(
    val collection: Uri,
    val publicDir: String, // Environment.DIRECTORY_*
  )

  fun mimeOf(file: File): String {
    val ext = file.extension.lowercase()
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
      ?: when (ext) {
        "mkv" -> "video/x-matroska"
        "m4a" -> "audio/mp4"
        "opus" -> "audio/opus"
        else -> "application/octet-stream"
      }
  }

  private fun targetFor(mime: String): Target = when {
    mime.startsWith("image") -> Target(
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI, Environment.DIRECTORY_PICTURES,
    )
    mime.startsWith("audio") -> Target(
      MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, Environment.DIRECTORY_MUSIC,
    )
    else -> Target(
      MediaStore.Video.Media.EXTERNAL_CONTENT_URI, Environment.DIRECTORY_MOVIES,
    )
  }

  /**
   * Copy [source] into the appropriate public collection. Returns the content Uri of the saved
   * item, or null on failure. Streams disk-to-disk.
   */
  fun export(context: Context, source: File, mime: String = mimeOf(source)): Uri? {
    val target = targetFor(mime)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      exportViaMediaStore(context, source, mime, target)
    } else {
      exportLegacy(context, source, mime, target)
    }
  }

  private fun exportViaMediaStore(context: Context, source: File, mime: String, target: Target): Uri? {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, source.name)
      put(MediaStore.MediaColumns.MIME_TYPE, mime)
      put(MediaStore.MediaColumns.RELATIVE_PATH, "${target.publicDir}/$ALBUM")
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = resolver.insert(target.collection, values) ?: return null
    return try {
      resolver.openOutputStream(uri)?.use { out ->
        source.inputStream().use { it.copyTo(out, DEFAULT_BUFFER_SIZE) }
      } ?: throw IllegalStateException("null output stream")
      values.clear()
      values.put(MediaStore.MediaColumns.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
      uri
    } catch (e: Exception) {
      resolver.delete(uri, null, null) // roll back the pending row
      null
    }
  }

  @Suppress("DEPRECATION")
  private fun exportLegacy(context: Context, source: File, mime: String, target: Target): Uri? {
    val dir = File(Environment.getExternalStoragePublicDirectory(target.publicDir), ALBUM)
    if (!dir.exists() && !dir.mkdirs()) return null
    val dest = File(dir, source.name)
    return try {
      source.inputStream().use { input -> dest.outputStream().use { input.copyTo(it) } }
      android.media.MediaScannerConnection.scanFile(
        context, arrayOf(dest.absolutePath), arrayOf(mime),
      ) { _, uri -> }
      Uri.fromFile(dest)
    } catch (e: Exception) {
      null
    }
  }

  // --- History (backing the History tab) ----------------------------------------------------

  private val collections = listOf(
    MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
  )

  /**
   * Everything this app has exported to the public gallery, newest first. Dismissed URIs are
   * filtered on the JS side (they're per-user UI state kept in AsyncStorage).
   */
  fun queryHistory(context: Context): List<Map<String, Any?>> {
    val out = ArrayList<Map<String, Any?>>()
    val projection = arrayOf(
      MediaStore.MediaColumns._ID,
      MediaStore.MediaColumns.DISPLAY_NAME,
      MediaStore.MediaColumns.MIME_TYPE,
      MediaStore.MediaColumns.SIZE,
      MediaStore.MediaColumns.DATE_ADDED,
    )
    val (selection, args) = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      "${MediaStore.MediaColumns.RELATIVE_PATH} LIKE ?" to arrayOf("%$ALBUM%")
    } else {
      @Suppress("DEPRECATION")
      val dataCol = MediaStore.MediaColumns.DATA
      "$dataCol LIKE ?" to arrayOf("%$ALBUM%")
    }
    for (collection in collections) {
      runCatching {
        context.contentResolver.query(collection, projection, selection, args, null)?.use { c ->
          val idCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
          val nameCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
          val mimeCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
          val sizeCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
          val dateCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
          while (c.moveToNext()) {
            val id = c.getLong(idCol)
            val uri = android.content.ContentUris.withAppendedId(collection, id)
            out += mapOf(
              "uri" to uri.toString(),
              "name" to (c.getString(nameCol) ?: "(unknown)"),
              "mime" to (c.getString(mimeCol) ?: "application/octet-stream"),
              "sizeBytes" to c.getLong(sizeCol),
              "dateAddedSec" to c.getLong(dateCol),
            )
          }
        }
      }
    }
    return out.sortedByDescending { (it["dateAddedSec"] as? Long) ?: 0L }
  }
}