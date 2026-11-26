package io.cardlens.app.firebase

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp

object FirebaseBootstrap {
    private const val TAG = "CardLensFirebase"

    /**
     * Initializes Firebase if google-services.json was present at build time.
     * Returns null (no crash) when the app was built without it.
     */
    fun init(context: Context): FirebaseApp? {
        val app = try {
            FirebaseApp.getApps(context).firstOrNull() ?: FirebaseApp.initializeApp(context)
        } catch (e: Exception) {
            Log.w(TAG, "Firebase init failed", e)
            null
        }
        if (app == null) {
            Log.w(TAG, "Firebase not configured (no google-services.json at build time).")
            return null
        }
        try {
            AppCheckSetup.install()
            Log.i(TAG, "App Check provider installed: ${AppCheckSetup.PROVIDER_NAME}")
        } catch (e: Exception) {
            Log.e(TAG, "App Check install failed", e)
        }
        return app
    }
}
