package io.cardlens.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import java.time.DateTimeException
import java.time.LocalDate

/**
 * Transaction model for the shared schema.
 *
 * Field names, types, required fields, and the category enum match
 * `shared/schema/transaction.schema.json`. Category wire values and their order
 * also match `shared/schema/categories.json`. The schema contract test reads
 * those files from the repo; do not copy them under `android/`.
 *
 * `date` is an ISO-8601 calendar date (`YYYY-MM-DD`, JSON Schema format `date`).
 * `currency` matches `^[A-Z]{3}$`. `merchant` has `minLength` 1. `amount` is a
 * JSON number; the shared schema does not constrain its sign.
 */

@Serializable
enum class Category {
    @SerialName("groceries") GROCERIES,
    @SerialName("dining") DINING,
    @SerialName("transport") TRANSPORT,
    @SerialName("fuel") FUEL,
    @SerialName("utilities") UTILITIES,
    @SerialName("subscriptions") SUBSCRIPTIONS,
    @SerialName("shopping") SHOPPING,
    @SerialName("health") HEALTH,
    @SerialName("entertainment") ENTERTAINMENT,
    @SerialName("travel") TRAVEL,
    @SerialName("education") EDUCATION,
    @SerialName("insurance") INSURANCE,
    @SerialName("fees") FEES,
    @SerialName("transfers") TRANSFERS,
    @SerialName("other") OTHER;

    /** Wire value used in JSON and prompts. Declaration order is the schema enum order. */
    val wireName: String
        get() = serializer().descriptor.getElementName(ordinal)

    companion object {
        /** Tolerant lookup for model prose. Strict JSON parsing does not use this. */
        fun fromWire(value: String?): Category =
            entries.firstOrNull { it.wireName == value?.trim()?.lowercase() } ?: OTHER
    }
}

@Serializable
data class Transaction(
    /** ISO-8601 calendar date, `YYYY-MM-DD`. */
    val date: String,
    /** Non-empty merchant name. */
    val merchant: String,
    val amount: Double,
    /** ISO-4217 alphabetic code, three uppercase letters. */
    val currency: String,
    val category: Category,
    @SerialName("isRecurring") val isRecurring: Boolean,
) {
    init {
        require(DATE.matches(date) && isCalendarDate(date)) {
            "date must be an ISO-8601 calendar date (YYYY-MM-DD)"
        }
        require(merchant.isNotEmpty()) { "merchant must be non-empty" }
        require(CURRENCY.matches(currency)) { "currency must match ^[A-Z]{3}$" }
    }

    companion object {
        /** JSON Schema format `date`: RFC 3339 full-date. */
        val DATE: Regex = Regex("""^\d{4}-\d{2}-\d{2}$""")

        /** JSON Schema pattern on `currency`. */
        val CURRENCY: Regex = Regex("""^[A-Z]{3}$""")

        private fun isCalendarDate(value: String): Boolean =
            try {
                LocalDate.parse(value)
                true
            } catch (_: DateTimeException) {
                false
            }
    }
}

object TransactionJson {
    val json: Json = Json {
        ignoreUnknownKeys = false // schema has additionalProperties=false
        explicitNulls = false
        encodeDefaults = false
    }

    fun parse(text: String): Transaction {
        // kotlinx.serialization accepts quoted numbers and booleans. The schema types do not.
        val element = json.parseToJsonElement(text)
        require(element is JsonObject) { "transaction must be a JSON object" }
        element.requireString("date")
        element.requireString("merchant")
        element.requireNumber("amount")
        element.requireString("currency")
        element.requireString("category")
        element.requireBoolean("isRecurring")
        return json.decodeFromJsonElement(Transaction.serializer(), element)
    }

    fun encode(tx: Transaction): String = json.encodeToString(Transaction.serializer(), tx)

    private fun JsonObject.requireString(name: String) {
        val value = this[name] ?: return
        require(value is JsonPrimitive && value.isString) { "$name must be a string" }
    }

    private fun JsonObject.requireNumber(name: String) {
        val value = this[name] ?: return
        require(value is JsonPrimitive && !value.isString && value.booleanOrNull == null && value.doubleOrNull != null) {
            "$name must be a number"
        }
    }

    private fun JsonObject.requireBoolean(name: String) {
        val value = this[name] ?: return
        require(value is JsonPrimitive && !value.isString && value.booleanOrNull != null) {
            "$name must be a boolean"
        }
    }
}
