package io.cardlens.app.model

import kotlinx.serialization.descriptors.elementNames
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Keeps [Transaction] aligned with the shared schema at the repo root.
 *
 * Gradle sets `cardlens.schemaDir` to `android/../shared/schema`. If that property
 * is absent, the test walks up from the working directory until it finds
 * `shared/schema/`. The JSON is not copied into `android/`.
 */
class SchemaContractTest {
    private val schemaDir: File by lazy { locateSharedSchemaDir() }

    private val schema: JsonObject by lazy {
        Json.parseToJsonElement(File(schemaDir, "transaction.schema.json").readText()).jsonObject
    }

    private val categories: List<String> by lazy {
        Json.parseToJsonElement(File(schemaDir, "categories.json").readText())
            .jsonArray
            .map { it.jsonPrimitive.content }
    }

    @Test fun readsSharedSchemaFiles() {
        val schemaFile = File(schemaDir, "transaction.schema.json").canonicalFile
        val categoriesFile = File(schemaDir, "categories.json").canonicalFile
        assertTrue(schemaFile.path.endsWith("/shared/schema/transaction.schema.json"))
        assertTrue(categoriesFile.path.endsWith("/shared/schema/categories.json"))
        assertTrue(schemaFile.isFile)
        assertTrue(categoriesFile.isFile)
        assertFalse(schemaFile.path.contains("/android/schema/"))
    }

    @Test fun propertiesMatchKotlinModel() {
        val schemaProps = schema["properties"]!!.jsonObject.keys
        val kotlinProps = Transaction.serializer().descriptor.elementNames.toSet()
        assertEquals(schemaProps, kotlinProps)
    }

    @Test fun requiredMatchesNonOptionalFields() {
        val required = schema["required"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet()
        val descriptor = Transaction.serializer().descriptor
        val kotlinRequired = (0 until descriptor.elementsCount)
            .filterNot { descriptor.isElementOptional(it) }
            .map { descriptor.getElementName(it) }
            .toSet()
        assertEquals(required, kotlinRequired)
        assertEquals(schema["properties"]!!.jsonObject.keys, required)
    }

    @Test fun categoryEnumMatchesSchemaAndCategoriesFile() {
        val enumValues = schema["properties"]!!.jsonObject["category"]!!.jsonObject["enum"]!!.jsonArray
            .map { it.jsonPrimitive.content }
        assertEquals(enumValues, categories)
        assertEquals(enumValues, Category.entries.map { it.wireName })
        val descriptor = Category.serializer().descriptor
        assertEquals(enumValues, (0 until descriptor.elementsCount).map { descriptor.getElementName(it) })
    }

    @Test fun typesAndFormatsMatchTheModel() {
        assertEquals(
            "https://json-schema.org/draft/2020-12/schema",
            schema.getValue("\$schema").jsonPrimitive.content,
        )
        assertEquals(false, schema["additionalProperties"]!!.jsonPrimitive.boolean)
        val props = schema["properties"]!!.jsonObject
        assertEquals("string", props.typeOf("date"))
        assertEquals("date", props.obj("date")["format"]!!.jsonPrimitive.content)
        assertEquals("string", props.typeOf("merchant"))
        assertEquals(1, props.obj("merchant")["minLength"]!!.jsonPrimitive.int)
        assertEquals("number", props.typeOf("amount"))
        assertEquals("string", props.typeOf("currency"))
        assertEquals("^[A-Z]{3}$", props.obj("currency")["pattern"]!!.jsonPrimitive.content)
        assertEquals(Transaction.CURRENCY.pattern, props.obj("currency")["pattern"]!!.jsonPrimitive.content)
        assertEquals("string", props.typeOf("category"))
        assertEquals("boolean", props.typeOf("isRecurring"))
    }

    @Test fun canonicalTransactionRoundTrips() {
        val raw = """
            {"date":"2026-01-15","merchant":"WHOLE FOODS MARKET","amount":42.18,"currency":"USD","category":"groceries","isRecurring":false}
        """.trim()
        val tx = TransactionJson.parse(raw)
        assertEquals("2026-01-15", tx.date)
        assertEquals("WHOLE FOODS MARKET", tx.merchant)
        assertEquals(42.18, tx.amount, 0.001)
        assertEquals("USD", tx.currency)
        assertEquals(Category.GROCERIES, tx.category)
        assertFalse(tx.isRecurring)
        assertEquals(tx, TransactionJson.parse(TransactionJson.encode(tx)))
    }
}

private fun JsonObject.typeOf(name: String): String =
    getValue(name).jsonObject.getValue("type").jsonPrimitive.content

private fun JsonObject.obj(name: String): JsonObject = getValue(name).jsonObject

private fun locateSharedSchemaDir(): File {
    val configured = System.getProperty("cardlens.schemaDir")
    if (!configured.isNullOrBlank()) {
        return File(configured).also(::requireSharedSchema)
    }
    var cursor: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
    repeat(8) {
        val current = cursor ?: return@repeat
        val candidate = File(current, "shared/schema")
        if (isSharedSchemaDir(candidate)) return candidate
        cursor = current.parentFile
    }
    error(
        "Could not find shared/schema (transaction.schema.json and categories.json) " +
            "from ${System.getProperty("user.dir")}. Set -Dcardlens.schemaDir.",
    )
}

private fun requireSharedSchema(dir: File) {
    check(isSharedSchemaDir(dir)) {
        "cardlens.schemaDir ($dir) must be the shared schema directory containing " +
            "transaction.schema.json and categories.json"
    }
}

private fun isSharedSchemaDir(dir: File): Boolean =
    File(dir, "transaction.schema.json").isFile && File(dir, "categories.json").isFile
