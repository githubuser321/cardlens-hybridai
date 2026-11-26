package io.cardlens.app.ai

import io.cardlens.app.model.Category
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CardLensControllerTest {
    @Test fun pixel6ProPath_unavailableThenCloudSample() = runTest {
        val engine = FakeAiEngine(status = { RawModelStatus.UNAVAILABLE })
        val c = CardLensController(engine, this)
        c.refreshStatus(); advanceUntilIdle()
        assertEquals(ModelStatus.Unavailable(ModelStatus.Reason.DEVICE_NOT_SUPPORTED), c.state.value.modelStatus)
        assertEquals(0, engine.warmUpCalls) // no warm-up when on-device is unavailable

        c.runSample(); advanceUntilIdle()
        val done = c.state.value.sample as SampleState.Done
        assertEquals(InferenceSourceLabel.CLOUD, done.source)
        assertEquals(Category.GROCERIES, done.transactions[0].category)
        assertEquals(Category.OTHER, done.transactions[1].category)
    }

    @Test fun checkStatusThrowing_doesNotSpinForever() = runTest {
        val c = CardLensController(FakeAiEngine(status = { error("boom") }), this)
        c.refreshStatus(); advanceUntilIdle()
        assertEquals(ModelStatus.Unavailable(ModelStatus.Reason.CHECK_FAILED, "boom"), c.state.value.modelStatus)
    }

    @Test fun checkStatusHanging_timesOut() = runTest {
        val engine = object : AiEngine by FakeAiEngine() {
            override suspend fun checkStatus(): RawModelStatus = awaitCancellation()
        }
        val c = CardLensController(engine, this, checkTimeoutMs = 1_000)
        c.refreshStatus(); advanceTimeBy(1_500); advanceUntilIdle()
        assertEquals(ModelStatus.Unavailable(ModelStatus.Reason.CHECK_TIMED_OUT), c.state.value.modelStatus)
    }

    @Test fun available_triggersWarmUp_andOnDeviceBadge() = runTest {
        val engine = FakeAiEngine(
            status = { RawModelStatus.AVAILABLE },
            result = { AiResult("```json\n[{\"i\":0,\"category\":\"groceries\"}]\n```", InferenceSourceLabel.ON_DEVICE) },
        )
        val c = CardLensController(engine, this)
        c.refreshStatus(); advanceUntilIdle()
        assertEquals(1, engine.warmUpCalls)
        assertTrue(c.state.value.warmedUp)
        c.runSample(); advanceUntilIdle()
        assertEquals(InferenceSourceLabel.ON_DEVICE, (c.state.value.sample as SampleState.Done).source)
    }

    @Test fun downloadFlow_reachesAvailable() = runTest {
        val engine = FakeAiEngine(
            status = { RawModelStatus.DOWNLOADABLE },
            downloadEvents = listOf(DownloadEvent.Started(100), DownloadEvent.InProgress(50), DownloadEvent.Completed),
        )
        val c = CardLensController(engine, this)
        c.refreshStatus(); advanceUntilIdle()
        assertEquals(ModelStatus.Downloadable, c.state.value.modelStatus)
        c.startDownload(); advanceUntilIdle()
        assertEquals(ModelStatus.Available, c.state.value.modelStatus)
        assertEquals(1, engine.warmUpCalls)
    }

    @Test fun firebaseNotConfigured_isTerminalState() = runTest {
        val c = CardLensController(UnconfiguredAiEngine(), this)
        assertEquals(ModelStatus.FirebaseNotConfigured, c.state.value.modelStatus)
        c.refreshStatus(); advanceUntilIdle()
        assertEquals(ModelStatus.FirebaseNotConfigured, c.state.value.modelStatus)
        c.runSample(); advanceUntilIdle()
        assertTrue(c.state.value.sample is SampleState.Error)
    }

    @Test fun generateFailure_showsError() = runTest {
        val c = CardLensController(FakeAiEngine(result = { throw RuntimeException("quota") }), this)
        c.runSample(); advanceUntilIdle()
        assertEquals(SampleState.Error("quota"), c.state.value.sample)
    }
}
