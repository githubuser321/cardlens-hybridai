package io.cardlens.app.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelStatusMapperTest {
    @Test fun unavailableMapsToCloudFallbackMessage() {
        val status = ModelStatusMapper.fromRaw(RawModelStatus.UNAVAILABLE)
        assertEquals(ModelStatus.Unavailable(ModelStatus.Reason.DEVICE_NOT_SUPPORTED), status)
        assertEquals("On-device model not available on this device, using cloud.", ModelStatusMapper.message(status))
        assertEquals("Using cloud", ModelStatusMapper.title(status))
        assertTrue(ModelStatusMapper.usesCloud(status))
    }

    @Test fun rawStatusesMapOneToOne() {
        assertEquals(ModelStatus.Available, ModelStatusMapper.fromRaw(RawModelStatus.AVAILABLE))
        assertEquals(ModelStatus.Downloadable, ModelStatusMapper.fromRaw(RawModelStatus.DOWNLOADABLE))
        assertTrue(ModelStatusMapper.fromRaw(RawModelStatus.DOWNLOADING) is ModelStatus.Downloading)
        assertFalse(ModelStatusMapper.usesCloud(ModelStatus.Available))
    }

    @Test fun checkErrorsBecomeUnavailableNotCrash() {
        val s = ModelStatusMapper.fromCheckError(IllegalStateException("AICore missing"))
        assertEquals(ModelStatus.Unavailable(ModelStatus.Reason.CHECK_FAILED, "AICore missing"), s)
        assertTrue(ModelStatusMapper.message(s).endsWith("Using cloud."))
        assertEquals(ModelStatus.FirebaseNotConfigured, ModelStatusMapper.fromCheckError(FirebaseNotConfiguredException()))
    }

    @Test fun downloadProgressReducer() {
        var s: ModelStatus = ModelStatus.Downloadable
        s = ModelStatusMapper.reduce(s, DownloadEvent.Started(1_000))
        assertEquals(0f, (s as ModelStatus.Downloading).progress)
        s = ModelStatusMapper.reduce(s, DownloadEvent.InProgress(250))
        assertEquals(0.25f, (s as ModelStatus.Downloading).progress!!, 0.0001f)
        assertTrue(ModelStatusMapper.message(s).contains("25%"))
        s = ModelStatusMapper.reduce(s, DownloadEvent.Completed)
        assertEquals(ModelStatus.Available, s)
        val failed = ModelStatusMapper.reduce(ModelStatus.Downloading(), DownloadEvent.Failed("disk full"))
        assertEquals(ModelStatus.Unavailable(ModelStatus.Reason.DOWNLOAD_FAILED, "disk full"), failed)
    }

    @Test fun unknownTotalGivesIndeterminateProgress() {
        val s = ModelStatusMapper.reduce(ModelStatus.Downloading(), DownloadEvent.InProgress(10))
        assertNull((s as ModelStatus.Downloading).progress)
    }
}
