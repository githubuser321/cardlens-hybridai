package io.cardlens.app.ai

import kotlinx.coroutines.flow.Flow

/** SDK-free mirror of com.google.firebase.ai.ondevice.OnDeviceModelStatus. */
enum class RawModelStatus { UNAVAILABLE, DOWNLOADABLE, DOWNLOADING, AVAILABLE }

/** SDK-free mirror of com.google.firebase.ai.ondevice.DownloadStatus. */
sealed interface DownloadEvent {
    data class Started(val bytesToDownload: Long) : DownloadEvent
    data class InProgress(val totalBytesDownloaded: Long) : DownloadEvent
    data object Completed : DownloadEvent
    data class Failed(val message: String?) : DownloadEvent
}

/** Where a response was produced (from GenerateContentResponse.inferenceSource). */
enum class InferenceSourceLabel(val badge: String) {
    ON_DEVICE("ON-DEVICE"),
    CLOUD("CLOUD"),
    UNKNOWN("UNKNOWN"),
}

data class AiResult(val text: String, val source: InferenceSourceLabel)

/**
 * Everything the UI needs from Firebase AI Logic, behind an interface so the
 * state logic can be unit-tested with a fake (see FakeAiEngine in tests).
 */
interface AiEngine {
    /** False when FirebaseApp could not be initialized (no google-services.json). */
    val isFirebaseConfigured: Boolean

    /** May throw; callers must handle exceptions. */
    suspend fun checkStatus(): RawModelStatus

    fun download(): Flow<DownloadEvent>

    /** Loads the on-device model into memory. No-op / may throw if unavailable. */
    suspend fun warmUp()

    /** Hybrid generation (PREFER_ON_DEVICE, falls back to cloud). */
    suspend fun generate(prompt: String): AiResult
}

/** Used when Firebase is not configured: never crashes, explains what's missing. */
class UnconfiguredAiEngine : AiEngine {
    override val isFirebaseConfigured: Boolean = false
    override suspend fun checkStatus(): RawModelStatus = throw FirebaseNotConfiguredException()
    override fun download(): Flow<DownloadEvent> = kotlinx.coroutines.flow.flowOf(DownloadEvent.Failed("Firebase not configured"))
    override suspend fun warmUp() = Unit
    override suspend fun generate(prompt: String): AiResult = throw FirebaseNotConfiguredException()
}

class FirebaseNotConfiguredException :
    IllegalStateException("Firebase is not configured: add app/google-services.json and rebuild.")
