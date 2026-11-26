package io.cardlens.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class TransactionTest {
    @Test fun parsesSchemaShapedJson() {
        val tx = TransactionJson.parse(
            """{"date":"2026-01-15","merchant":"WHOLE FOODS MARKET","amount":42.18,"currency":"USD","category":"groceries","isRecurring":false}""",
        )
        assertEquals("2026-01-15", tx.date)
        assertEquals("WHOLE FOODS MARKET", tx.merchant)
        assertEquals(42.18, tx.amount, 0.001)
        assertEquals("USD", tx.currency)
        assertEquals(Category.GROCERIES, tx.category)
        assertFalse(tx.isRecurring)
    }

    @Test fun encodesEveryRequiredField_andRoundTrips() {
        val tx = SampleData.transactions[1]
        assertTrue(tx.isRecurring)
        val encoded = TransactionJson.encode(tx)
        assertTrue(encoded.contains("\"isRecurring\":true"))
        assertTrue(encoded.contains("\"date\""))
        assertTrue(encoded.contains("\"merchant\""))
        assertTrue(encoded.contains("\"amount\""))
        assertTrue(encoded.contains("\"currency\""))
        assertTrue(encoded.contains("\"category\""))
        assertFalse(encoded.contains("raw_line"))
        assertFalse(encoded.contains("notes"))
        assertFalse(encoded.contains("income"))
        assertEquals(tx, TransactionJson.parse(encoded))
    }

    @Test fun everyCategoryRoundTrips() {
        Category.entries.forEach { category ->
            val tx = Transaction("2026-01-15", "Shop", 1.0, "EUR", category, isRecurring = category == Category.SUBSCRIPTIONS)
            val encoded = TransactionJson.encode(tx)
            assertTrue(encoded.contains("\"${category.wireName}\""))
            assertEquals(tx, TransactionJson.parse(encoded))
        }
    }

    @Test fun rejectsUnknownFieldsCategoriesAndBadFormats() {
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":1,"currency":"USD","category":"groceries","isRecurring":false,"extra":1}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":1,"currency":"USD","category":"groceries","isRecurring":false,"raw_line":"x"}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":1,"currency":"USD","category":"income","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":1,"currency":"USD","category":"crypto","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"01/15/2026","merchant":"x","amount":1,"currency":"USD","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-13-01","merchant":"x","amount":1,"currency":"USD","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-02-29","merchant":"x","amount":1,"currency":"USD","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":1,"currency":"usd","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"","amount":1,"currency":"USD","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","amount":1,"currency":"USD","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":"1","currency":"USD","category":"groceries","isRecurring":false}""")
        }
        assertThrows(Exception::class.java) {
            TransactionJson.parse("""{"date":"2026-10-07","merchant":"x","amount":1,"currency":"USD","category":"groceries","isRecurring":"false"}""")
        }
    }

    @Test fun categorizerPromptAndResponse() {
        val prompt = Categorizer.buildPrompt(SampleData.transactions)
        assertTrue(prompt.contains("groceries|dining|transport|fuel|"))
        assertTrue(prompt.contains("education|insurance|fees|transfers|other"))
        assertFalse(prompt.contains("income"))
        assertTrue(prompt.contains("0: 2026-10-03 Greenleaf Market #12"))
        assertTrue(prompt.contains("1: 2026-10-07 StreamBox Premium | 15.99 USD | recurring"))
        val out = Categorizer.applyResponse(
            SampleData.transactions,
            "Sure!\n```json\n[{\"i\":0,\"category\":\"groceries\"},{\"i\":1,\"category\":\"Subscriptions\"},{\"i\":2,\"category\":\"bogus\"}]\n```",
        )
        assertEquals(listOf(Category.GROCERIES, Category.SUBSCRIPTIONS, Category.OTHER), out.map { it.category })
        assertEquals(listOf(false, true, false), out.map { it.isRecurring })
        assertThrows(IllegalArgumentException::class.java) { Categorizer.applyResponse(SampleData.transactions, "no json") }
    }
}
