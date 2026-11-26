package io.cardlens.app.ai

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class FakeAiEngine(
    override val isFirebaseConfigured: Boolean = true,
    var status: () -> RawModelStatus = { RawModelStatus.UNAVAILABLE },
    var downloadEvents: List<DownloadEvent> = emptyList(),
    var result: (String) -> AiResult = { AiResult("""[{"i":0,"category":"groceries"}]""", InferenceSourceLabel.CLOUD) },
) : AiEngine {
    var warmUpCalls = 0
    val prompts = mutableListOf<String>()

    override suspend fun checkStatus(): RawModelStatus = status()
    override fun download(): Flow<DownloadEvent> = flow { downloadEvents.forEach { emit(it) } }
    override suspend fun warmUp() { warmUpCalls++ }
    override suspend fun generate(prompt: String): AiResult { prompts += prompt; return result(prompt) }
}
