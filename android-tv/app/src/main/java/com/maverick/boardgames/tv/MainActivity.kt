package com.maverick.boardgames.tv

import android.annotation.SuppressLint
import android.app.Activity
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

/** Full-screen TV host for Board Games Party Mode (the page itself lives on GitHub Pages). */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var updater: Updater? = null
    private val startUrl = "https://maverick5150.github.io/board-games/firestick/?tv=1"

    inner class Bridge {
        @JavascriptInterface
        fun exit() { runOnUiThread { finish() } }

        @JavascriptInterface
        fun retry() { runOnUiThread { web.loadUrl(startUrl) } }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#0e1630"))
        setContentView(web)

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.useWideViewPort = true
        s.loadWithOverviewMode = true

        web.addJavascriptInterface(Bridge(), "AndroidTV")
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

        // self-update: asks when a newer version is on the website (checked again from onResume), never blocks the games
        updater = Updater(this, web).also { it.checkOnLaunch() }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onBackPressed() {
        // let the page decide (Quit game / back to picker / Exit app)
        web.evaluateJavascript("(window.__tvBack?(window.__tvBack(),'ok'):'none')") { r ->
            if (r == null || r.contains("none")) finish()
        }
    }

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); updater?.onResume() }

    override fun onDestroy() {
        updater?.close()
        updater = null
        super.onDestroy()
    }
}
