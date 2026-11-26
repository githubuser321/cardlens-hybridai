package io.cardlens.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/** Builds a short categorization prompt and parses the model's JSON-ish answer. */
object Categorizer {
    /** On-device guidance: keep output short (<=256 tokens). */
    const val MAX_OUTPUT_TOKENS = 256

    @Serializable
    private data class Item(@SerialName("i") val index: Int, val category: String? = null)

    private val lenientJson = Json { ignoreUnknownKeys = true; isLenient = true }

    fun buildPrompt(transactions: List<Transaction>): String = buildString {
        append("Categorize each credit card transaction.\n")
        append("Allowed categories: ")
        append(Category.entries.joinToString("|") { it.wireName })
        append(".\nReply ONLY with a JSON array like [{\"i\":0,\"category\":\"groceries\"}], one object per line item, no prose.\n")
        transactions.forEachIndexed { i, tx ->
            val recurrence = if (tx.isRecurring) "recurring" else "one-time"
            append("$i: ${tx.date} ${tx.merchant} | ${tx.amount} ${tx.currency} | $recurrence\n")
        }
    }

    /**
     * Applies the model answer to [transactions]. Tolerates ``` fences and surrounding prose.
     * Unknown categories / missing items fall back to [Category.OTHER].
     * @throws IllegalArgumentException if no JSON array can be found or decoded.
     */
    fun applyResponse(transactions: List<Transaction>, responseText: String): List<Transaction> {
        val start = responseText.indexOf('[')
        val end = responseText.lastIndexOf(']')
        require(start >= 0 && end > start) { "No JSON array in model response" }
        val items = try {
            lenientJson.decodeFromString(ListSerializer(Item.serializer()), responseText.substring(start, end + 1))
        } catch (e: Exception) {
            throw IllegalArgumentException("Malformed JSON in model response", e)
        }
        val byIndex = items.associateBy { it.index }
        return transactions.mapIndexed { i, tx ->
            tx.copy(category = Category.fromWire(byIndex[i]?.category))
        }
    }
}
