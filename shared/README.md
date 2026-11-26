# shared

Cross-client contracts for CardLens. The web app imports these files directly. Do not copy them into `/web` or `/android`.

| File | Purpose |
| --- | --- |
| `schema/transaction.schema.json` | JSON Schema draft 2020-12 for one statement transaction. Compact so it can be sent as an on-device `responseSchema`. |
| `schema/categories.json` | Category enum. Must stay identical to `transaction.schema.json` → `properties.category.enum`. |

`date` is an ISO 8601 calendar date (`YYYY-MM-DD`). `currency` is an ISO 4217 alphabetic code. `amount` is positive for a charge and negative for a credit or refund. `examples` are fictional transactions and must validate against the schema. Clients that send the schema to an on-device model should omit `examples`.
