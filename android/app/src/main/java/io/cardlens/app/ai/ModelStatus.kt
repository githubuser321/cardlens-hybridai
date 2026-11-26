package io.cardlens.app.ai

/** UI-facing on-device model status. */
sealed interface ModelStatus {
    data object Checking : ModelStatus
    data object Downloadable : ModelStatus
    data class Downloading(val bytesDownloaded: Long = 0, val bytesTotal: Long? = null) : ModelStatus {
        /** 0f..1f, or null when the total size is unknown (indeterminate progress). */
        val progress: Float?
            get() = bytesTotal?.takeIf { it > 0 }?.let { (bytesDownloaded.toFloat() / it).coerceIn(0f, 1f) }
    }
    data object Available : ModelStatus
    data class Unavailable(val reason: Reason, val detail: String? = null) : ModelStatus
    data object FirebaseNotConfigured : ModelStatus

    enum class Reason { DEVICE_NOT_SUPPORTED, CHECK_FAILED, CHECK_TIMED_OUT, DOWNLOAD_FAILED }
}

object ModelStatusMapper {
    fun fromRaw(raw: RawModelStatus): ModelStatus = when (raw) {
        RawModelStatus.UNAVAILABLE -> ModelStatus.Unavailable(ModelStatus.Reason.DEVICE_NOT_SUPPORTED)
        RawModelStatus.DOWNLOADABLE -> ModelStatus.Downloadable
        RawModelStatus.DOWNLOADING -> ModelStatus.Downloading()
        RawModelStatus.AVAILABLE -> ModelStatus.Available
    }

    fun fromCheckError(t: Throwable): ModelStatus = when (t) {
        is FirebaseNotConfiguredException -> ModelStatus.FirebaseNotConfigured
        is kotlinx.coroutines.TimeoutCancellationException ->
            ModelStatus.Unavailable(ModelStatus.Reason.CHECK_TIMED_OUT)
        else -> ModelStatus.Unavailable(ModelStatus.Reason.CHECK_FAILED, t.message ?: t::class.simpleName)
    }

    /** Folds a download event into the current status. */
    fun reduce(current: ModelStatus, event: DownloadEvent): ModelStatus = when (event) {
        is DownloadEvent.Started -> ModelStatus.Downloading(0, event.bytesToDownload.takeIf { it > 0 })
        is DownloadEvent.InProgress -> ModelStatus.Downloading(
            bytesDownloaded = event.totalBytesDownloaded,
            bytesTotal = (current as? ModelStatus.Downloading)?.bytesTotal,
        )
        DownloadEvent.Completed -> ModelStatus.Available
        is DownloadEvent.Failed -> ModelStatus.Unavailable(ModelStatus.Reason.DOWNLOAD_FAILED, event.message)
    }

    /** True when requests will (or should be expected to) go to the cloud model. */
    fun usesCloud(status: ModelStatus): Boolean = status !is ModelStatus.Available

    fun title(status: ModelStatus): String = when (status) {
        ModelStatus.Checking -> "Checking on-device model…"
        ModelStatus.Downloadable -> "On-device model can be downloaded"
        is ModelStatus.Downloading -> "Downloading on-device model…"
        ModelStatus.Available -> "On-device model ready"
        is ModelStatus.Unavailable -> "Using cloud"
        ModelStatus.FirebaseNotConfigured -> "Firebase not configured"
    }

    fun message(status: ModelStatus): String = when (status) {
        ModelStatus.Checking -> "Asking AICore whether Gemini Nano is available on this device."
        ModelStatus.Downloadable ->
            "This device supports Gemini Nano. Download it to run analysis privately on-device. Until then, requests use the cloud."
        is ModelStatus.Downloading -> status.progress?.let { "Downloading… ${(it * 100).toInt()}%. Requests use the cloud until it finishes." }
            ?: "Downloading… Requests use the cloud until it finishes."
        ModelStatus.Available -> "Requests run on-device first (PREFER_ON_DEVICE), with cloud fallback."
        is ModelStatus.Unavailable -> when (status.reason) {
            ModelStatus.Reason.DEVICE_NOT_SUPPORTED -> CLOUD_FALLBACK_MESSAGE
            ModelStatus.Reason.CHECK_FAILED -> "Couldn't check the on-device model${status.detail?.let { " ($it)" } ?: ""}. Using cloud."
            ModelStatus.Reason.CHECK_TIMED_OUT -> "On-device model check timed out. Using cloud."
            ModelStatus.Reason.DOWNLOAD_FAILED -> "On-device model download failed${status.detail?.let { " ($it)" } ?: ""}. Using cloud."
        }
        ModelStatus.FirebaseNotConfigured ->
            "Add app/google-services.json from the Firebase console and rebuild to enable AI features."
    }

    const val CLOUD_FALLBACK_MESSAGE = "On-device model not available on this device, using cloud."
}
