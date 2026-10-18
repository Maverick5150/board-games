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
import android.os.Handler
import android.os.Looper
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
    // WebView has no speechSynthesis. THE ANNOUNCERS ARE MEN (the CEO, 2026-10-18): only a voice known to be a man's is ever used (MenVoices.kt
    // chooses), two different men when the device has them. Optional everywhere: no speech engine, no English voice, no man's voice or a
    // failed start = ttsReady() stays false, ttsStatus() says why and the page shows captions only. The bridge methods run on the WebView's
    // JavaBridge thread (TextToSpeech's speak / stop are safe from any thread); the start and the end callbacks come back on the UI thread.
    @Volatile private var tts: TextToSpeech? = null
    @Volatile private var ttsOk = false
    @Volatile private var destroyed = false
    @Volatile private var voiceA: Voice? = null
    @Volatile private var voiceB: Voice? = null
    private var voiceNow: String? = null
    private var ttsVol = 1f
    private var utterSeq = 0
    @Volatile private var ttsState = "starting"          // starting | ready | no-male-voice | no-english | failed (ttsStatus() tells the page)
    @Volatile private var menList: List<Voice> = emptyList()   // every installed man's voice, best first (voices() tells the page)
    private var engineTried = false                      // Google's own engine is tried once when the default engine has no man's voice
    private var noMenState = ""                          // why the first engine had no man ("no-male-voice" or "no-english")
    private var engineName = ""                          // the speech engine in use ("" = not known yet)
    @Volatile private var ttsNote = ""                   // the engine and the English voices it listed (ttsInfo() tells the Menu what is on this device)

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

        /** the device's installed offline English MEN's voices as JSON, best first: [{"name","lang","quality","male":true}] */
        @JavascriptInterface
        fun voices(): String = voiceList()

        /** true once the speech engine has started with a man's voice */
        @JavascriptInterface
        fun ttsReady(): Boolean = ttsOk && tts != null

        /** "starting" | "ready" | "no-male-voice" | "no-english" | "failed": why speech is (not) available. The page shows captions for the
         *  last three and says why in the Menu. */
        @JavascriptInterface
        fun ttsStatus(): String = ttsState

        /** the two men in use as JSON: {"a":{"name","lang","quality"},"b":{...},"same":bool,"male":true} ("b" missing and "same" true when the
         *  device has only one man), or "" when there is none. An app WITHOUT this method is from before the men's-voices rule and picks its
         *  own voice, which may be a woman's: ui/voice.js does not use its speech. */
        @JavascriptInterface
        fun ttsChosen(): String = chosenJson()

        /** a short line for the Menu when there is no man's voice: the speech engine and the English voices it listed ("" until it started) */
        @JavascriptInterface
        fun ttsInfo(): String = ttsNote

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
            ttsState = "failed"
        }
    }

    /** the speech engine has started (or failed): English, the two men's voices, and the end-of-line callback to the page */
    private fun onTtsInit(status: Int) {
        val t = tts
        if (destroyed || t == null || status != TextToSpeech.SUCCESS) {
            ttsOk = false
            ttsState = if (noMenState.isNotEmpty()) noMenState else "failed"
            return
        }
        try {
            // The announcers speak English: US English first, then any English (an engine left on German would read English text in a German voice).
            val englishOk = t.setLanguage(Locale.US) >= TextToSpeech.LANG_AVAILABLE || t.setLanguage(Locale.ENGLISH) >= TextToSpeech.LANG_AVAILABLE
            if (engineName.isEmpty()) engineName = try { t.defaultEngine ?: "" } catch (e: Exception) { "" }
            val english = pickVoices(t)
            if (voiceA == null) {
                // No man's voice in this engine: no speech, the page shows captions and says why. A phone whose default engine is Samsung's
                // (or another) may still have Google's engine with men's voices: that is tried once. A woman's voice is never the fallback.
                noMenState = if (english > 0 || englishOk) "no-male-voice" else "no-english"
                if (!engineTried && tryGoogleEngine(t)) return
                ttsOk = false
                ttsState = noMenState
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
            ttsState = "ready"
        } catch (e: Exception) {
            ttsOk = false
            ttsState = "failed"
        }
    }

    /** an English voice that is on the device and works offline (never a network voice, never one whose data is not installed) */
    private fun usable(v: Voice): Boolean =
        v.locale?.language == "en" && !v.isNetworkConnectionRequired &&
            v.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true

    /** A second chance for a phone whose default speech engine has no man's voice: Google's own engine, when it is installed and is not the
     *  engine that was just tried. The new engine ends in onTtsInit again (engineTried stops a loop). Returns true when it was started. */
    private fun tryGoogleEngine(t: TextToSpeech): Boolean {
        engineTried = true
        return try {
            val google = "com.google.android.tts"
            if (t.defaultEngine == google || t.engines.none { it.name == google }) return false
            engineName = google
            tts = TextToSpeech(applicationContext, TextToSpeech.OnInitListener { status -> onTtsInit(status) }, google)
            Handler(Looper.getMainLooper()).post { try { t.shutdown() } catch (e: Exception) { } }
            true
        } catch (e: Exception) {
            false
        }
    }

    /** the two men (MenVoices.kt): the lead caller "a" and the analyst "b" (another man; none when the device has only one, both then use
     *  him and the page sets them apart by pitch). Returns how many offline English voices the engine has, men or not. */
    private fun pickVoices(t: TextToSpeech): Int {
        val all: Set<Voice> = try { t.voices ?: emptySet() } catch (e: Exception) { emptySet() }
        val english = all.filter { usable(it) }
        val pick = MenVoices.pick(english.map { MenVoices.Cand(it, it.name, it.locale?.toLanguageTag() ?: "", it.quality) })
        menList = pick.men.map { it.ref }
        voiceA = pick.a?.ref
        voiceB = pick.b?.ref
        voiceNow = null
        val names = english.map { it.name }.distinct().take(8).joinToString(", ")
        val part = (if (engineName.isEmpty()) "speech engine" else engineName) + ": " + (if (names.isEmpty()) "no English voice listed" else names)
        ttsNote = if (ttsNote.isEmpty()) part else ttsNote + " | " + part
        return english.size
    }

    /** speak one line (on the JavaBridge thread): the speaker's voice, rate and pitch, then queue it under its own id */
    private fun speakLine(text: String?, who: String?, rate: Float, pitch: Float, flush: Boolean): String {
        val t = tts ?: return ""
        val tx = (text ?: "").trim()
        if (!ttsOk || destroyed || tx.isEmpty()) return ""
        return try {
            val v = if (who == "b") (voiceB ?: voiceA) else voiceA
            if (v == null) return ""   // never the engine's own default voice: it may be a woman's
            if (v.name != voiceNow) {
                if (t.setVoice(v) == TextToSpeech.SUCCESS) voiceNow = v.name else return ""   // not the man's voice = no line (never another voice)
            }
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
        if (!ttsOk) return "[]"
        return try {
            val list = JSONArray()
            menList.forEach { v -> list.put(voiceJson(v).put("male", true)) }
            list.toString()
        } catch (e: Exception) {
            "[]"
        }
    }

    private fun voiceJson(v: Voice): JSONObject =
        JSONObject().put("name", v.name).put("lang", v.locale.toLanguageTag()).put("quality", v.quality)

    /** the two men in use (see Bridge.ttsChosen) */
    private fun chosenJson(): String {
        val a = voiceA ?: return ""
        return try {
            val o = JSONObject().put("a", voiceJson(a))
            val b = voiceB
            if (b != null) o.put("b", voiceJson(b))
            o.put("same", b == null).put("male", true)
            o.toString()
        } catch (e: Exception) {
            ""
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
