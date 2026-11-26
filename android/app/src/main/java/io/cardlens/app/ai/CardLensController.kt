package io.cardlens.app.ai

import io.cardlens.app.model.Categorizer
import io.cardlens.app.model.SampleData
import io.cardlens.app.model.Transaction
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

sealed interface SampleState {
    data object Idle : SampleState
    data object Running : SampleState
    data class Done(val transactions: List<Transaction>, val source: InferenceSourceLabel, val rawText: String) : SampleState
    data class Error(val message: String) : SampleState
}

data class UiState(
    val modelStatus: ModelStatus = ModelStatus.Checking,
    val warmedUp: Boolean = false,
    val sample: SampleState = SampleState.Idle,
)

/** Plain-Kotlin state holder (wrapped by MainViewModel) so it is unit-testable. */
class CardLensController(
    private val engine: AiEngine,
    private val scope: CoroutineScope,
    private val checkTimeoutMs: Long = 15_000,
) {
    private val _state = MutableStateFlow(
        UiState(modelStatus = if (engine.isFirebaseConfigured) ModelStatus.Checking else ModelStatus.FirebaseNotConfigured),
    )
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var downloadJob: Job? = null

    fun refreshStatus() {
        if (!engine.isFirebaseConfigured) {
            _state.update { it.copy(modelStatus = ModelStatus.FirebaseNotConfigured) }
            return
        }
        _state.update { it.copy(modelStatus = ModelStatus.Checking) }
        scope.launch {
            val status = try {
                ModelStatusMapper.fromRaw(withTimeout(checkTimeoutMs) { engine.checkStatus() })
            } catch (e: TimeoutCancellationException) {
                ModelStatusMapper.fromCheckError(e)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                ModelStatusMapper.fromCheckError(e)
            }
            _state.update { it.copy(modelStatus = status) }
            if (status == ModelStatus.Available) warmUp()
        }
    }

    fun startDownload() {
        if (downloadJob?.isActive == true) return
        _state.update { it.copy(modelStatus = ModelStatus.Downloading()) }
        downloadJob = scope.launch {
            try {
                engine.download().collect { event ->
                    _state.update { it.copy(modelStatus = ModelStatusMapper.reduce(it.modelStatus, event)) }
                }
                // Flow ended without a terminal event: re-check instead of spinning forever.
                if (_state.value.modelStatus is ModelStatus.Downloading) refreshStatus()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                _state.update {
                    it.copy(modelStatus = ModelStatus.Unavailable(ModelStatus.Reason.DOWNLOAD_FAILED, e.message))
                }
            }
            if (_state.value.modelStatus == ModelStatus.Available) warmUp()
        }
    }

    private suspend fun warmUp() {
        try {
            engine.warmUp()
            _state.update { it.copy(warmedUp = true) }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Throwable) {
            // Warm-up is only a latency optimization; inference still works (or falls back).
        }
    }

    fun runSample(transactions: List<Transaction> = SampleData.transactions) {
        if (_state.value.sample == SampleState.Running) return
        _state.update { it.copy(sample = SampleState.Running) }
        scope.launch {
            val next = try {
                val result = engine.generate(Categorizer.buildPrompt(transactions))
                val categorized = try {
                    Categorizer.applyResponse(transactions, result.text)
                } catch (_: IllegalArgumentException) {
                    transactions // still show the badge + raw text even if JSON was off
                }
                SampleState.Done(categorized, result.source, result.text)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                SampleState.Error(e.message ?: e::class.simpleName ?: "Unknown error")
            }
            _state.update { it.copy(sample = next) }
        }
    }
}
