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
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

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

    inner class Bridge {
        @JavascriptInterface
        fun exit() { runOnUiThread { finish() } }

        @JavascriptInterface
        fun retry() { runOnUiThread { web.loadUrl(startUrl) } }

        /** true on a TV, false on a phone or tablet */
        @JavascriptInterface
        fun isTV(): Boolean = tv
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

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); updater?.onResume() }

    override fun onDestroy() {
        updater?.close()
        updater = null
        super.onDestroy()
    }
}
