package io.cardlens.app.firebase

import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

/**
 * DEBUG builds only (src/debug). Logs a debug secret on first run:
 *   D DebugAppCheckProvider: Enter this debug secret into the allow list ...
 * Register it in Firebase console > Security > App Check > Apps > Manage debug tokens.
 * Never commit that token.
 */
object AppCheckSetup {
    const val PROVIDER_NAME = "debug"

    fun install() {
        Firebase.appCheck.installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance())
    }
}
