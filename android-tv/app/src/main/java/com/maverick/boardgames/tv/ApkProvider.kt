package com.maverick.boardgames.tv

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Read-only content:// access to the downloaded update APK, for the system installer (Android 7+ refuses file:// URIs).
 * Same idea as androidx FileProvider, without the extra dependency. Not exported: the installer only gets in through
 * the one-off FLAG_GRANT_READ_URI_PERMISSION on the install intent, and it can only ever see that one file.
 */
class ApkProvider : ContentProvider() {

    companion object {
        fun uri(ctx: Context): Uri = Uri.parse("content://" + ctx.packageName + ".updates/" + Updater.APK_NAME)
    }

    private fun fileFor(uri: Uri): File? {
        val ctx = context ?: return null
        val f = Updater.apkFile(ctx) ?: return null
        return if (uri.lastPathSegment == f.name && f.isFile) f else null
    }

    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String = Updater.APK_MIME

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode.contains('w') || mode.contains('t')) throw FileNotFoundException("read only")
        val f = fileFor(uri) ?: throw FileNotFoundException(uri.toString())
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    override fun query(
        uri: Uri, projection: Array<String>?, selection: String?,
        selectionArgs: Array<String>?, sortOrder: String?
    ): Cursor? {
        val f = fileFor(uri) ?: return null
        val names = ArrayList<String>()
        val values = ArrayList<Any>()
        for (col in projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)) {
            when (col) {
                OpenableColumns.DISPLAY_NAME -> { names.add(col); values.add(f.name) }
                OpenableColumns.SIZE -> { names.add(col); values.add(f.length()) }
            }
        }
        val cursor = MatrixCursor(names.toTypedArray(), 1)
        cursor.addRow(values)
        return cursor
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int = 0

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = 0
}
