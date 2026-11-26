package io.cardlens.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.cardlens.app.ai.InferenceSourceLabel
import io.cardlens.app.ai.ModelStatus
import io.cardlens.app.ai.ModelStatusMapper
import io.cardlens.app.ai.SampleState
import io.cardlens.app.ai.UiState
import io.cardlens.app.model.SampleData

@Composable
fun MainScreen(viewModel: MainViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MainContent(state, viewModel::refreshStatus, viewModel::download, viewModel::runSample)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainContent(state: UiState, onRefresh: () -> Unit, onDownload: () -> Unit, onTrySample: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("CardLens") }) }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ModelStatusCard(state, onRefresh, onDownload)
            SampleCard(state, onTrySample)
        }
    }
}

@Composable
private fun ModelStatusCard(state: UiState, onRefresh: () -> Unit, onDownload: () -> Unit) {
    val status = state.modelStatus
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (status == ModelStatus.Checking) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text(ModelStatusMapper.title(status), style = MaterialTheme.typography.titleMedium)
            }
            Text(ModelStatusMapper.message(status), style = MaterialTheme.typography.bodyMedium)
            if (status is ModelStatus.Downloading) {
                val p = status.progress
                if (p != null) LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth())
                else LinearProgressIndicator(Modifier.fillMaxWidth())
            }
            if (status == ModelStatus.Available && state.warmedUp) {
                Text("Model warmed up.", style = MaterialTheme.typography.labelMedium)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (status == ModelStatus.Downloadable) {
                    Button(onClick = onDownload) { Text("Download on-device model") }
                }
                if (status !is ModelStatus.Downloading && status != ModelStatus.Checking &&
                    status != ModelStatus.FirebaseNotConfigured
                ) {
                    OutlinedButton(onClick = onRefresh) { Text("Re-check") }
                }
            }
        }
    }
}

@Composable
private fun SampleCard(state: UiState, onTrySample: () -> Unit) {
    val sample = state.sample
    val enabled = state.modelStatus != ModelStatus.FirebaseNotConfigured &&
        state.modelStatus != ModelStatus.Checking && sample != SampleState.Running
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Demo: categorize sample transactions", style = MaterialTheme.typography.titleMedium)
            Text("Fictional data only.", style = MaterialTheme.typography.bodySmall)
            Button(onClick = onTrySample, enabled = enabled) {
                if (sample == SampleState.Running) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text("Try sample")
            }
            when (sample) {
                SampleState.Idle, SampleState.Running -> Unit
                is SampleState.Error -> Text(
                    "Request failed: ${sample.message}",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
                is SampleState.Done -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Result", style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.width(8.dp))
                        SourceBadge(sample.source)
                    }
                    sample.transactions.forEach { tx ->
                        Column(Modifier.fillMaxWidth()) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(
                                    "${tx.date} · ${tx.merchant} · ${tx.amount} ${tx.currency}",
                                    Modifier.weight(1f),
                                )
                                Text(tx.category.wireName, fontWeight = FontWeight.SemiBold)
                            }
                            if (tx.isRecurring) {
                                Text("Recurring", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                    Text(sample.rawText.take(400), fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun SourceBadge(source: InferenceSourceLabel) {
    val color = when (source) {
        InferenceSourceLabel.ON_DEVICE -> Color(0xFF1B873F)
        InferenceSourceLabel.CLOUD -> Color(0xFF1565C0)
        InferenceSourceLabel.UNKNOWN -> Color.Gray
    }
    Surface(
        color = color,
        contentColor = Color.White,
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.semantics { contentDescription = "Inference source: ${source.badge}" },
    ) {
        Text(source.badge, Modifier.padding(horizontal = 8.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall)
    }
}

@Preview(showBackground = true)
@Composable
private fun PreviewCloudFallback() {
    CardLensTheme {
        MainContent(
            UiState(
                modelStatus = ModelStatus.Unavailable(ModelStatus.Reason.DEVICE_NOT_SUPPORTED),
                sample = SampleState.Done(SampleData.transactions, InferenceSourceLabel.CLOUD, "[{\"i\":0,\"category\":\"groceries\"}]"),
            ),
            {}, {}, {},
        )
    }
}
