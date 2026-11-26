package io.cardlens.app.ai

import android.util.Log
import com.google.firebase.Firebase
import com.google.firebase.FirebaseApp
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.ai
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.type.FirebaseAIOnDeviceInvalidRequestException
import com.google.firebase.ai.type.FirebaseAIOnDeviceNotAvailableException
import com.google.firebase.ai.type.FirebaseAIOnDeviceUnknownException
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.generationConfig
import io.cardlens.app.model.Categorizer
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map

/**
 * Firebase AI Logic hybrid engine (Gemini Developer API backend).
 *
 * APIs verified against firebase-ai 18.2.0 / firebase-ai-ondevice 16.0.0-beta08 class files:
 *  - GenerativeModel.onDeviceExtension: OnDeviceExtension? (com.google.firebase.ai)
 *      .checkStatus(): com.google.firebase.ai.OnDeviceModelStatus (suspend)
 *      .download(): Flow<com.google.firebase.ai.DownloadStatus>
 *      .warmUp() (suspend)
 *    The docs' FirebaseAIOnDevice.checkStatus()/download() (com.google.firebase.ai.ondevice)
 *    still exist in beta08 but are @Deprecated("Use GenerativeModel.OnDeviceExtension").
 *  - GenerateContentResponse.inferenceSource: InferenceSource (ON_DEVICE / IN_CLOUD)
 */
@OptIn(PublicPreviewAPI::class)
class FirebaseAiEngine(app: FirebaseApp) : AiEngine {
    override val isFirebaseConfigured: Boolean = true

    private val ai = Firebase.ai(
        app = app,
        backend = GenerativeBackend.googleAI(),
        // Limited-use App Check tokens (replay protection) for AI Logic requests.
        useLimitedUseAppCheckTokens = true,
    )

    private val cloudConfig = generationConfig {
        maxOutputTokens = Categorizer.MAX_OUTPUT_TOKENS
        temperature = 0.1f
        responseMimeType = "application/json"
    }

    private val hybridModel: GenerativeModel by lazy {
        ai.generativeModel(
            modelName = CLOUD_MODEL,
            generationConfig = cloudConfig,
            onDeviceConfig = OnDeviceConfig(
                mode = InferenceMode.PREFER_ON_DEVICE,
                maxOutputTokens = Categorizer.MAX_OUTPUT_TOKENS,
            ),
        )
    }

    /** Used only if the hybrid call throws an on-device error instead of falling back. */
    private val cloudOnlyModel: GenerativeModel by lazy {
        ai.generativeModel(
            modelName = CLOUD_MODEL,
            generationConfig = cloudConfig,
            onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD),
        )
    }

    override suspend fun checkStatus(): RawModelStatus {
        val ext = hybridModel.onDeviceExtension ?: return RawModelStatus.UNAVAILABLE
        return mapStatus(ext.checkStatus())
    }

    private fun mapStatus(s: OnDeviceModelStatus): RawModelStatus = when (s) {
        OnDeviceModelStatus.AVAILABLE -> RawModelStatus.AVAILABLE
        OnDeviceModelStatus.DOWNLOADABLE -> RawModelStatus.DOWNLOADABLE
        OnDeviceModelStatus.DOWNLOADING -> RawModelStatus.DOWNLOADING
        OnDeviceModelStatus.UNAVAILABLE -> RawModelStatus.UNAVAILABLE
        else -> {
            Log.w(TAG, "Unknown on-device status $s; treating as unavailable")
            RawModelStatus.UNAVAILABLE
        }
    }

    override fun download(): Flow<DownloadEvent> {
        val ext = hybridModel.onDeviceExtension
            ?: return flowOf(DownloadEvent.Failed("On-device extension not available"))
        return ext.download().map { s -> mapDownload(s) }
    }

    private fun mapDownload(s: DownloadStatus): DownloadEvent = run {
        when (s) {
            is DownloadStatus.DownloadStarted -> DownloadEvent.Started(s.bytesToDownload)
            is DownloadStatus.DownloadInProgress -> DownloadEvent.InProgress(s.totalBytesDownloaded)
            is DownloadStatus.DownloadCompleted -> DownloadEvent.Completed
            is DownloadStatus.DownloadFailed -> DownloadEvent.Failed(s.exception.message)
            else -> DownloadEvent.Failed("Unknown download status: $s")
        }
    }

    override suspend fun warmUp() {
        hybridModel.onDeviceExtension?.warmUp()
    }

    override suspend fun generate(prompt: String): AiResult {
        val response = try {
            hybridModel.generateContent(prompt)
        } catch (e: FirebaseAIOnDeviceNotAvailableException) {
            Log.w(TAG, "On-device not available at request time; retrying in cloud", e)
            cloudOnlyModel.generateContent(prompt)
        } catch (e: FirebaseAIOnDeviceUnknownException) {
            Log.w(TAG, "On-device inference failed; retrying in cloud", e)
            cloudOnlyModel.generateContent(prompt)
        } catch (e: FirebaseAIOnDeviceInvalidRequestException) {
            Log.w(TAG, "Request not supported on-device; retrying in cloud", e)
            cloudOnlyModel.generateContent(prompt)
        }
        val source = when (response.inferenceSource) {
            InferenceSource.ON_DEVICE -> InferenceSourceLabel.ON_DEVICE
            InferenceSource.IN_CLOUD -> InferenceSourceLabel.CLOUD
            else -> InferenceSourceLabel.UNKNOWN
        }
        return AiResult(response.text.orEmpty(), source)
    }

    companion object {
        private const val TAG = "CardLensAI"
        /** Gemini Developer API free-tier model from the hackathon plan. */
        const val CLOUD_MODEL = "gemini-3.5-flash-lite"
    }
}
