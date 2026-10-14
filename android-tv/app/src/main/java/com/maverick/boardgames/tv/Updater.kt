package com.maverick.boardgames.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.DialogInterface
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.widget.Toast
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Self-update for the sideloaded Fire TV app.
 * On launch and whenever the app comes back to the front (at most once every 6 hours) it reads tv/version.json from
 * the website. When that lists a newer versionCode it asks; on Install it downloads the APK into the app's own storage,
 * checks its SHA-256 and hands it to the system installer. Every failure is silent or a short toast: the games never
 * wait on this.
 */
class Updater(private val act: Activity, private val focusBack: View) {

    companion object {
        private const val SITE = "https://maverick5150.github.io/board-games/"
        private const val VERSION_URL = SITE + "tv/version.json"
        private const val PREFS = "updater"
        private const val KEY_LAST_CHECK = "lastCheck"
        /** versionCode the user said Install to before being sent to the "Install unknown apps" setting (0 = none). */
        private const val KEY_PENDING = "pendingCode"
        private const val CHECK_EVERY_MS = 6L * 60 * 60 * 1000
        private const val TIMEOUT_MS = 8000
        private const val DOWNLOAD_READ_TIMEOUT_MS = 20000
        private const val FAILED = "The update didn't download. Try again later."
        private const val SKIPPED = "Update skipped. Turn on Install unknown apps for Board Games to get updates."
        private val DIALOG_THEME = android.R.style.Theme_Material_Dialog_Alert
        private val SHA256_HEX = Regex("[0-9a-f]{64}")

        const val APK_NAME = "BoardGamesTV.apk"
        const val APK_MIME = "application/vnd.android.package-archive"

        /** Where the update is downloaded: private storage on API 24+ (served by [ApkProvider]); before 24 the
         *  installer only takes file:// URIs, so it goes to the app's external files dir, which the installer can read. */
        fun apkFile(ctx: Context): File? {
            val dir: File = if (Build.VERSION.SDK_INT >= 24) ctx.filesDir else (ctx.getExternalFilesDir(null) ?: return null)
            return File(File(dir, "update"), APK_NAME)
        }

        private fun hex(bytes: ByteArray): String {
            val digits = "0123456789abcdef"
            val sb = StringBuilder(bytes.size * 2)
            for (b in bytes) {
                val v = b.toInt() and 0xff
                sb.append(digits[v shr 4]).append(digits[v and 0x0f])
            }
            return sb.toString()
        }
    }

    private class Release(val code: Int, val name: String, val apk: String, val sha256: String)

    private val main = Handler(Looper.getMainLooper())
    @Volatile private var closed = false
    @Volatile private var cancelDownload = false
    private var busy = false                       // a check or a download is running (main thread only)
    private var dialog: AlertDialog? = null
    private var waitingForPermission: Release? = null

    private fun prefs(): SharedPreferences = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Called from onCreate (and from [onResume]). Runs off the UI thread; at most one completed check every 6 hours,
     *  except while an update the user already said Install to is waiting for the "Install unknown apps" setting. */
    fun checkOnLaunch() {
        if (BuildConfig.DEBUG || busy || closed) return    // a debug build can't take a release-signed update
        val prefs = prefs()
        val pending = prefs.getInt(KEY_PENDING, 0)
        val since = System.currentTimeMillis() - prefs.getLong(KEY_LAST_CHECK, 0L)
        if (pending <= 0 && since in 0L until CHECK_EVERY_MS) return
        busy = true
        Thread(Runnable {
            val rel = try { fetchRelease() } catch (e: Exception) { null }
            main.post {
                busy = false
                if (closed || rel == null) return@post    // offline / bad JSON: try again next launch, say nothing
                prefs.edit().putLong(KEY_LAST_CHECK, System.currentTimeMillis()).remove(KEY_PENDING).apply()
                when {
                    rel.code <= BuildConfig.VERSION_CODE -> apkFile(act)?.delete()
                    // Back from "Install unknown apps" after Fire OS 8 (Android 11) restarted the app for it: the user
                    // already chose Install for this version, so carry on with it.
                    rel.code == pending && canInstall() -> download(rel)
                    rel.code == pending -> toast(SKIPPED)
                    else -> offer(rel)
                }
            }
        }, "update-check").start()
    }

    /** Called from onResume: carries on after the user was sent to the "Install unknown apps" setting; otherwise
     *  checks again (same 6-hour limit), because Fire TV usually brings the running app back instead of restarting it. */
    fun onResume() {
        val rel = waitingForPermission
        if (rel == null) {
            if (dialog == null) checkOnLaunch()
            return
        }
        waitingForPermission = null
        prefs().edit().putLong(KEY_LAST_CHECK, System.currentTimeMillis()).remove(KEY_PENDING).apply()
        if (canInstall()) download(rel) else toast(SKIPPED)
    }

    /** Called from onDestroy. */
    fun close() {
        closed = true
        cancelDownload = true
        waitingForPermission = null
        main.removeCallbacksAndMessages(null)
        val d = dialog
        dialog = null
        try { d?.dismiss() } catch (e: Exception) { }
    }

    private fun connect(url: String, readTimeoutMs: Int): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = TIMEOUT_MS
        c.readTimeout = readTimeoutMs
        c.useCaches = false
        c.instanceFollowRedirects = true
        c.setRequestProperty("Cache-Control", "no-cache")
        return c
    }

    /** Background thread. Returns null on any network or format problem. */
    private fun fetchRelease(): Release? {
        val c = connect(VERSION_URL + "?t=" + System.currentTimeMillis(), TIMEOUT_MS)   // ?t= skips the CDN cache
        try {
            if (c.responseCode != HttpURLConnection.HTTP_OK) return null
            val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
            val code = j.optInt("versionCode", 0)
            val apk = j.optString("apk", "")
            val sha = j.optString("sha256", "").trim().lowercase()
            if (code <= 0 || !apk.startsWith(SITE) || !SHA256_HEX.matches(sha)) return null
            val name = j.optString("versionName", "").ifBlank { "1.$code" }
            return Release(code, name, apk, sha)
        } finally {
            c.disconnect()
        }
    }

    private fun canInstall(): Boolean =
        Build.VERSION.SDK_INT < 26 || act.packageManager.canRequestPackageInstalls()

    private fun toast(msg: String) {
        if (!closed && !act.isFinishing) Toast.makeText(act, msg, Toast.LENGTH_LONG).show()
    }

    /** Shows a D-pad friendly dialog: the positive button has focus, Back and Escape close it. */
    private fun show(b: AlertDialog.Builder): AlertDialog? {
        if (closed || act.isFinishing || act.isDestroyed) return null
        dialog?.dismiss()
        val d = b.create()
        d.setOnKeyListener { di, keyCode, ev ->
            if (keyCode == KeyEvent.KEYCODE_ESCAPE) {
                if (ev.action == KeyEvent.ACTION_UP) di.cancel()
                true
            } else false
        }
        d.setOnDismissListener {
            if (dialog === d) {
                dialog = null
                focusBack.requestFocus()
            }
        }
        dialog = d
        try {
            d.show()
        } catch (e: Exception) {      // the window went away (activity closing)
            dialog = null
            return null
        }
        d.getButton(DialogInterface.BUTTON_POSITIVE)?.requestFocus()
        return d
    }

    private fun offer(rel: Release) {
        show(AlertDialog.Builder(act, DIALOG_THEME)
            .setTitle("Board Games")
            .setMessage("Update available - version ${rel.name}. Install now?")
            .setPositiveButton("Install") { _, _ -> main.post { install(rel) } }
            .setNegativeButton("Later", null))
    }

    private fun install(rel: Release) {
        if (canInstall()) download(rel) else askForPermission(rel)
    }

    private fun askForPermission(rel: Release) {
        show(AlertDialog.Builder(act, DIALOG_THEME)
            .setTitle("Allow Board Games to update itself")
            .setMessage("The Fire TV needs your OK once.\n\n" +
                "Settings > My Fire TV > Developer Options > Install unknown apps > Board Games: ON\n\n" +
                "Then come back to Board Games and the update carries on.")
            .setPositiveButton("Open Settings") { _, _ -> openInstallSettings(rel) }
            .setNegativeButton("Later", null))
    }

    @SuppressLint("ApplySharedPref")
    private fun openInstallSettings(rel: Release) {
        if (Build.VERSION.SDK_INT < 26) return
        waitingForPermission = rel     // also covers the user getting there on their own
        // Fire OS 8 (Android 11) kills the app when this setting is turned on, which loses the line above: keep the
        // choice on disk as well (written now, before Settings opens) so checkOnLaunch() carries on after the restart.
        prefs().edit().putInt(KEY_PENDING, rel.code).commit()
        val intents = listOf(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.packageName)),
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
        )
        for (i in intents) {
            try {
                act.startActivity(i)
                return
            } catch (e: ActivityNotFoundException) {
            } catch (e: SecurityException) {
            }
        }
        toast("Open Settings > My Fire TV > Developer Options > Install unknown apps, and turn on Board Games.")
    }

    private fun download(rel: Release) {
        if (busy || closed) return
        val file = apkFile(act)
        if (file == null) {
            toast(FAILED)
            return
        }
        val progress = show(AlertDialog.Builder(act, DIALOG_THEME)
            .setTitle("Updating Board Games")
            .setMessage("Downloading version ${rel.name}...")
            .setNegativeButton("Cancel") { _, _ -> cancelDownload = true }
            .setOnCancelListener { cancelDownload = true }) ?: return
        busy = true
        cancelDownload = false
        Thread(Runnable {
            val error = try {
                fetchApk(rel, file) { pct ->
                    main.post { if (dialog === progress) progress.setMessage("Downloading version ${rel.name}... $pct%") }
                }
            } catch (e: Exception) {
                FAILED
            }
            main.post {
                busy = false
                if (dialog === progress) progress.dismiss()
                when {
                    closed -> { }
                    cancelDownload -> file.delete()
                    error != null -> { file.delete(); toast(error) }
                    else -> launchInstaller(file)
                }
            }
        }, "update-download").start()
    }

    /** Background thread. Downloads the APK into [file]; null when it is complete and its SHA-256 matches, else a short message. */
    private fun fetchApk(rel: Release, file: File, onProgress: (Int) -> Unit): String? {
        val dir = file.parentFile
        if (dir != null && !dir.isDirectory && !dir.mkdirs()) return FAILED
        if (file.exists() && !file.delete()) return FAILED
        val sep = if (rel.apk.contains('?')) "&" else "?"
        val c = connect(rel.apk + sep + "v=" + rel.code, DOWNLOAD_READ_TIMEOUT_MS)   // ?v= skips a stale CDN copy
        try {
            if (c.responseCode != HttpURLConnection.HTTP_OK) return FAILED
            val total = c.contentLength.toLong()
            val md = MessageDigest.getInstance("SHA-256")
            var done = 0L
            var lastPct = -1
            c.inputStream.use { input ->
                FileOutputStream(file).use { out ->
                    val buf = ByteArray(16 * 1024)
                    while (true) {
                        if (cancelDownload || closed) return "Update cancelled."
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        md.update(buf, 0, n)
                        done += n
                        if (total > 0) {
                            val pct = (done * 100 / total).toInt()
                            if (pct != lastPct) {
                                lastPct = pct
                                onProgress(pct)
                            }
                        }
                    }
                }
            }
            if (hex(md.digest()) != rel.sha256) return "The update didn't download correctly. Try again later."
            return null
        } finally {
            c.disconnect()
        }
    }

    private fun launchInstaller(file: File) {
        val i = Intent(Intent.ACTION_VIEW)
        if (Build.VERSION.SDK_INT >= 24) {
            i.setDataAndType(ApkProvider.uri(act), APK_MIME)
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } else {
            i.setDataAndType(Uri.fromFile(file), APK_MIME)
        }
        try {
            act.startActivity(i)
        } catch (e: ActivityNotFoundException) {
            toast("This TV couldn't open the installer. Get the new version with the Downloader app.")
        } catch (e: SecurityException) {
            toast("This TV couldn't open the installer. Get the new version with the Downloader app.")
        }
    }
}
