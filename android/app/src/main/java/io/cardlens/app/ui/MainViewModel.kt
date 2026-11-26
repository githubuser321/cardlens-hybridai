package io.cardlens.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.cardlens.app.ai.AiEngine
import io.cardlens.app.ai.CardLensController
import io.cardlens.app.ai.UiState
import kotlinx.coroutines.flow.StateFlow

class MainViewModel(engine: AiEngine) : ViewModel() {
    private val controller = CardLensController(engine, viewModelScope)
    val state: StateFlow<UiState> = controller.state

    init {
        controller.refreshStatus()
    }

    fun refreshStatus() = controller.refreshStatus()
    fun download() = controller.startDownload()
    fun runSample() = controller.runSample()

    class Factory(private val engine: AiEngine) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = MainViewModel(engine) as T
    }
}
