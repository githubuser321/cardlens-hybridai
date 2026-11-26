package io.cardlens.app

import android.app.Application
import io.cardlens.app.ai.AiEngine
import io.cardlens.app.ai.FirebaseAiEngine
import io.cardlens.app.ai.UnconfiguredAiEngine
import io.cardlens.app.firebase.FirebaseBootstrap

class CardLensApp : Application() {
    lateinit var aiEngine: AiEngine
        private set

    override fun onCreate() {
        super.onCreate()
        val app = FirebaseBootstrap.init(this)
        aiEngine = if (app != null) FirebaseAiEngine(app) else UnconfiguredAiEngine()
    }
}
