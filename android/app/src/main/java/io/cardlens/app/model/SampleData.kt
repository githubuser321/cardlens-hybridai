package io.cardlens.app.model

/**
 * Fictional transactions for the "Try sample" demo. Never put real statement data here.
 * Category is intentionally OTHER: the model is asked to fill it in.
 */
object SampleData {
    val transactions: List<Transaction> = listOf(
        Transaction(
            date = "2026-10-03",
            merchant = "Greenleaf Market #12",
            amount = 54.20,
            currency = "USD",
            category = Category.OTHER,
            isRecurring = false,
        ),
        Transaction(
            date = "2026-10-07",
            merchant = "StreamBox Premium",
            amount = 15.99,
            currency = "USD",
            category = Category.OTHER,
            isRecurring = true,
        ),
        Transaction(
            date = "2026-10-11",
            merchant = "Metro Transit Card",
            amount = 23.75,
            currency = "USD",
            category = Category.OTHER,
            isRecurring = false,
        ),
    )
}
