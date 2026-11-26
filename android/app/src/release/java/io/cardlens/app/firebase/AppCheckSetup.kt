package io.cardlens.app.firebase

import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

/** RELEASE builds only (src/release): Play Integrity attestation. */
object AppCheckSetup {
    const val PROVIDER_NAME = "playintegrity"

    fun install() {
        Firebase.appCheck.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
    }
}
