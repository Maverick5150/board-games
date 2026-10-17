package com.maverick.boardgames.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.app.UiModeManager
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Board Games: the hub, every game and Party Mode (the pages themselves live on GitHub Pages).
 * On a TV (Fire TV, Android TV) it opens the 10-foot layout: ?tv=1, the window.AndroidTV bridge, landscape.
 * On a phone or tablet it opens the phone layout and turns with the device. The pages switch to the TV layout whenever they
 * see window.AndroidTV, so there the same bridge is called window.BoardGamesApp.
 */
class MainActivity : Activity() {

    companion object {
        const val SITE = "https://maverick5150.github.io/board-games/"

        /** A TV: the TV UI mode, the leanback feature, a Fire TV, or no touch screen at all (every phone and tablet has one). */
        fun isTv(ctx: Context): Boolean {
            val ui = ctx.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
            if (ui?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION) return true
            val pm = ctx.packageManager
            return pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK) ||
                pm.hasSystemFeature("amazon.hardware.fire_tv") ||
                !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN)
        }
    }

    private lateinit var web: WebView
    private var updater: Updater? = null
    private var tv = true
    private var startUrl = SITE + "?tv=1"

    // The announcers' voices (Motocross War; the page side is ui/voice.js): Android's own text to speech behind the bridge, because a
    // WebView has no speechSynthesis. Optional everywhere: no speech engine, no English voice or a failed start = ttsReady() stays
    // false and the page shows captions only. The bridge methods run on the WebView's JavaBridge thread (TextToSpeech's speak / stop
    // are safe from any thread); the start and the end callbacks come back on the UI thread.
    @Volatile private var tts: TextToSpeech? = null
    @Volatile private var ttsOk = false
    @Volatile private var destroyed = false
    @Volatile private var voiceA: Voice? = null
    @Volatile private var voiceB: Voice? = null
    private var voiceNow: String? = null
    private var ttsVol = 1f
    private var utterSeq = 0

    inner class Bridge {
        @JavascriptInterface
        fun exit() { runOnUiThread { finish() } }

        @JavascriptInterface
        fun retry() { runOnUiThread { web.loadUrl(startUrl) } }

        /** true on a TV, false on a phone or tablet */
        @JavascriptInterface
        fun isTV(): Boolean = tv

        /** ui/voice.js: speak one line ("a" = the lead caller, "b" = the analyst). Returns the line's id, or "" when speech is unavailable
         *  (the page then shows the caption only). flush = drop anything still queued first (the page plays one line at a time anyway). */
        @JavascriptInterface
        fun speak(text: String?, who: String?, rate: Float, pitch: Float, flush: Boolean): String = speakLine(text, who, rate, pitch, flush)

        /** stop the line being spoken and anything queued */
        @JavascriptInterface
        fun stop() { stopSpeech() }

        /** the device's installed English voices as JSON: [{"name","lang","quality"}] */
        @JavascriptInterface
        fun voices(): String = voiceList()

        /** true once the speech engine has started with a usable voice */
        @JavascriptInterface
        fun ttsReady(): Boolean = ttsOk && tts != null

        /** the announcers' volume, 0..1 */
        @JavascriptInterface
        fun ttsVolume(v: Float) { ttsVol = v.coerceIn(0f, 1f) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tv = isTv(this)
        startUrl = if (tv) SITE + "?tv=1" else SITE
        // A TV stays landscape. A phone or tablet turns with the device (portrait or landscape); the system's rotation lock still holds.
        requestedOrientation = if (tv) ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#080a15"))
        setContentView(web)

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false   // the music starts with the page, no tap needed
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.useWideViewPort = true
        s.loadWithOverviewMode = true

        web.addJavascriptInterface(Bridge(), if (tv) "AndroidTV" else "BoardGamesApp")
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) view.loadUrl("file:///android_asset/offline.html")
            }

            @Suppress("OVERRIDE_DEPRECATION")
            override fun onReceivedError(view: WebView, errorCode: Int, description: String?, failingUrl: String?) {
                if (failingUrl == startUrl || failingUrl?.startsWith("https://maverick5150.github.io") == true) {
                    view.loadUrl("file:///android_asset/offline.html")
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                // stay inside the app for our own site; ignore links to anywhere else
                return !(host.endsWith("github.io") || request.url.scheme == "file")
            }
        }

        web.isFocusable = true
        web.requestFocus()
        if (savedInstanceState == null) web.loadUrl(startUrl) else web.restoreState(savedInstanceState)

        // self-update: asks when a newer version is on the website (checked on every launch and again from onResume), never blocks the games
        updater = Updater(this, web, tv).also { it.checkOnLaunch(true) }

        // the announcers' voices start in the background (onTtsInit); until then ttsReady() is false and the page shows captions
        try {
            tts = TextToSpeech(applicationContext) { status -> onTtsInit(status) }
        } catch (e: Exception) {
            tts = null
        }
    }

    /** the speech engine has started (or failed): English, two voices, and the end-of-line callback to the page */
    private fun onTtsInit(status: Int) {
        val t = tts
        if (destroyed || t == null || status != TextToSpeech.SUCCESS) {
            ttsOk = false
            return
        }
        try {
            // The announcers speak English: US English first, then any English. No English at all (no voice either) = no speech:
            // ttsReady() stays false and the page shows captions (an engine left on German would read English text in a German voice).
            var english = t.setLanguage(Locale.US) >= TextToSpeech.LANG_AVAILABLE
            if (!english) english = t.setLanguage(Locale.ENGLISH) >= TextToSpeech.LANG_AVAILABLE
            pickVoices(t)
            if (!english && voiceA == null) {
                ttsOk = false
                return
            }
            t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}

                override fun onDone(utteranceId: String?) { lineEvent("done", utteranceId) }

                @Suppress("OVERRIDE_DEPRECATION")
                override fun onError(utteranceId: String?) { lineEvent("error", utteranceId) }

                override fun onStop(utteranceId: String?, interrupted: Boolean) { lineEvent("stop", utteranceId) }
            })
            ttsOk = true
        } catch (e: Exception) {
            ttsOk = false
        }
    }

    /** an English voice that is on the device and works offline (never a network voice, never one whose data is not installed) */
    private fun usable(v: Voice): Boolean =
        v.locale?.language == "en" && !v.isNetworkConnectionRequired &&
            v.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true

    /** two different usable voices: the lead caller "a" and the analyst "b" (another accent when there is one); with one voice both use
     *  it and the page sets them apart by pitch */
    private fun pickVoices(t: TextToSpeech) {
        val all: Set<Voice> = try { t.voices ?: emptySet() } catch (e: Exception) { emptySet() }
        // both characters are men: a voice named "male" (the Google engine's "#male_1") ranks above its "female" neighbour
        val ok = all.filter { v -> usable(v) }.sortedByDescending { v ->
            val n = v.name.lowercase()
            v.quality + (if (v.locale?.country == "US") 40 else if (v.locale?.country == "GB") 30 else 0) +
                (if (n.contains("female")) -10 else if (n.contains("male")) 10 else 0)
        }
        val a = ok.firstOrNull()
        voiceA = a
        voiceB = ok.firstOrNull { it.name != a?.name && it.locale?.country != a?.locale?.country } ?: ok.firstOrNull { it.name != a?.name }
    }

    /** speak one line (on the JavaBridge thread): the speaker's voice, rate and pitch, then queue it under its own id */
    private fun speakLine(text: String?, who: String?, rate: Float, pitch: Float, flush: Boolean): String {
        val t = tts ?: return ""
        val tx = (text ?: "").trim()
        if (!ttsOk || destroyed || tx.isEmpty()) return ""
        return try {
            val v = if (who == "b") (voiceB ?: voiceA) else voiceA
            if (v != null && v.name != voiceNow && t.setVoice(v) == TextToSpeech.SUCCESS) voiceNow = v.name
            t.setSpeechRate(if (rate > 0f) rate.coerceIn(0.5f, 2f) else 1f)
            t.setPitch(if (pitch > 0f) pitch.coerceIn(0.5f, 2f) else 1f)
            utterSeq += 1
            val id = "bg$utterSeq"
            val params = Bundle()
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, ttsVol)
            val mode = if (flush) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            if (t.speak(tx.take(400), mode, params, id) == TextToSpeech.SUCCESS) id else ""
        } catch (e: Exception) {
            ""
        }
    }

    private fun stopSpeech() {
        try { tts?.stop() } catch (e: Exception) { }
    }

    private fun voiceList(): String {
        val t = tts ?: return "[]"
        if (!ttsOk) return "[]"
        return try {
            val list = JSONArray()
            val all: Set<Voice> = t.voices ?: emptySet()
            all.filter { usable(it) }.forEach { v ->
                list.put(JSONObject().put("name", v.name).put("lang", v.locale.toLanguageTag()).put("quality", v.quality))
            }
            list.toString()
        } catch (e: Exception) {
            "[]"
        }
    }

    /** a line ended: tell the page (window.__bgTts in ui/voice.js) on the UI thread (the listener runs on a binder thread) */
    private fun lineEvent(ev: String, id: String?) {
        if (id == null || destroyed) return
        val js = "window.__bgTts&&window.__bgTts('" + ev + "','" + id.replace("'", "") + "')"
        runOnUiThread {
            if (!destroyed) {
                try { web.evaluateJavascript(js, null) } catch (e: Exception) { }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onBackPressed() {
        // let the page decide (close a sheet / the Menu / back to the hub / Exit app)
        web.evaluateJavascript("(window.__tvBack?(window.__tvBack(),'ok'):'none')") { r ->
            if (r == null || r.contains("none")) {
                // A page with no Back step of its own. On a TV, and on the hub, Back closes the app (as before). On a phone the
                // other pages (the Party controller, the offline page) go back a page, or to the hub.
                if (tv || atHub()) finish() else if (web.canGoBack()) web.goBack() else web.loadUrl(startUrl)
            }
        }
    }

    private fun atHub(): Boolean {
        val u = web.url ?: return true
        if (!u.startsWith(SITE)) return true
        val path = u.substring(SITE.length).substringBefore('#').substringBefore('?')
        return path.isEmpty() || path == "index.html"
    }

    override fun onPause() { super.onPause(); web.onPause(); stopSpeech() }
    override fun onResume() { super.onResume(); web.onResume(); updater?.onResume() }

    override fun onDestroy() {
        destroyed = true
        ttsOk = false
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) { }
        tts = null
        updater?.close()
        updater = null
        super.onDestroy()
    }
}
