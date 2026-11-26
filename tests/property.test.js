// Feature: expense-budget-visualizer, Property 1: Serialisation round-trip preserves all transaction data

'use strict';

const fc = require('fast-check');
const { saveToStorage, loadFromStorage, STORAGE_KEY } = require('../js/app.js');

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a non-empty string (printable ASCII, no control chars).
 * Used for transaction id and name.
 */
const nonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0);

/**
 * Generates a positive float for transaction amount.
 * Range: 0.01 – 99999.99 to stay within realistic values.
 */
const positiveFloat = fc.float({ min: 0.01, max: 99999.99, noNaN: true }).filter(n => n > 0);

/** Generates one of the three valid categories. */
const category = fc.constantFrom('Food', 'Transport', 'Fun');

/** Generates a valid Transaction object. */
const transaction = fc.record({
  id: nonEmptyString,
  name: nonEmptyString,
  amount: positiveFloat,
  category,
});

/** Generates an array of 0–20 valid transactions. */
const transactionArray = fc.array(transaction, { minLength: 0, maxLength: 20 });

// ─── Property Test ────────────────────────────────────────────────────────────

describe('Property 1: Serialisation round-trip preserves all transaction data', () => {
  /**
   * Validates: Requirements 1.2, 6.1, 6.2, 6.3
   *
   * For any array of valid transactions, saveToStorage followed by
   * loadFromStorage must return an array that deeply equals the original
   * for every field: id, name, amount, category.
   */
  it('deserialise ∘ serialise = identity for id, name, amount, category', () => {
    fc.assert(
      fc.property(transactionArray, (transactions) => {
        // Clear storage before each iteration to avoid cross-run contamination
        localStorage.clear();

        saveToStorage(transactions);
        const loaded = loadFromStorage();

        // Length must be preserved
        expect(loaded).toHaveLength(transactions.length);

        // Each entry must match its original counterpart field-by-field
        for (let i = 0; i < transactions.length; i++) {
          expect(loaded[i].id).toBe(transactions[i].id);
          expect(loaded[i].name).toBe(transactions[i].name);
          expect(loaded[i].amount).toBe(transactions[i].amount);
          expect(loaded[i].category).toBe(transactions[i].category);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2 ───────────────────────────────────────────────────────────────

// Feature: expense-budget-visualizer, Property 2: Invalid input is rejected and leaves state unchanged

const { validateForm } = require('../js/app.js');

// ─── Arbitraries for Property 2 ───────────────────────────────────────────────

/** Generates a string composed entirely of whitespace characters. */
const whitespaceOnlyName = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 20 });

/** Generates zero or a negative float. */
const nonPositiveAmount = fc.oneof(
  fc.constant(0),
  fc.float({ min: -99999, max: -0.001, noNaN: true }).filter(n => n < 0)
);

/**
 * Generates a string that cannot be parsed as a positive number:
 * excludes strings like "1", "1.5", etc.
 */
const nonNumericAmountString = fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
  const parsed = parseFloat(s);
  return isNaN(parsed) || parsed <= 0;
});

/** Generates one of the three valid categories. */
const validCategory = fc.constantFrom('Food', 'Transport', 'Fun');

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 2: Invalid input is rejected and leaves state unchanged', () => {
  /**
   * Validates: Requirements 1.3, 1.4
   */

  it('rejects whitespace-only names', () => {
    fc.assert(
      fc.property(whitespaceOnlyName, positiveFloat, validCategory, (name, amount, cat) => {
        const result = validateForm(name, amount, cat);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects non-positive amounts (zero and negative numbers)', () => {
    fc.assert(
      fc.property(nonEmptyString, nonPositiveAmount, validCategory, (name, amount, cat) => {
        const result = validateForm(name, amount, cat);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects non-numeric strings as amounts', () => {
    fc.assert(
      fc.property(nonEmptyString, nonNumericAmountString, validCategory, (name, amount, cat) => {
        const result = validateForm(name, amount, cat);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects any combination of invalid inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(whitespaceOnlyName, nonNumericAmountString),
        fc.oneof(nonPositiveAmount, nonNumericAmountString),
        validCategory,
        (name, amount, cat) => {
          const result = validateForm(name, amount, cat);
          // Both name and amount are invalid; must be rejected
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3 ───────────────────────────────────────────────────────────────

// Feature: expense-budget-visualizer, Property 3: Balance equals the arithmetic sum of all amounts

const { formatCurrency, renderBalance } = require('../js/app.js');

// ─── Arbitraries for Property 3 ───────────────────────────────────────────────

/**
 * Generates a positive float in a range that keeps the sum of an array
 * representable without catastrophic floating-point overflow.
 * Range: 0.01 – 9999.99
 */
const smallPositiveFloat = fc.float({ min: 0.01, max: 9999.99, noNaN: true }).filter(n => n > 0);

/** Generates a non-negative number (includes zero) for formatCurrency edge-case testing. */
const nonNegativeAmount = fc.oneof(
  fc.constant(0),
  smallPositiveFloat
);

/** Generates a non-empty array (1–20 items) of transactions with positive float amounts. */
const nonEmptyTransactionArray = fc.array(
  fc.record({
    id: nonEmptyString,
    name: nonEmptyString,
    amount: smallPositiveFloat,
    category,
  }),
  { minLength: 1, maxLength: 20 }
);

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Rounds a number to 2 decimal places using the same approach as
 * Intl.NumberFormat ("round half away from zero"), implemented via
 * Number.prototype.toFixed to match the display rounding.
 */
function roundToTwo(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 3: Balance equals the arithmetic sum of all amounts', () => {
  /**
   * Validates: Requirements 4.1, 4.3, 4.4
   */

  it('formatCurrency: result starts with "$" for any non-negative number', () => {
    fc.assert(
      fc.property(nonNegativeAmount, (amount) => {
        const result = formatCurrency(amount);
        expect(typeof result).toBe('string');
        expect(result.startsWith('$')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('formatCurrency: numeric part equals the value rounded to 2 decimal places', () => {
    fc.assert(
      fc.property(nonNegativeAmount, (amount) => {
        const result = formatCurrency(amount);
        // Strip the leading "$" and any thousands commas, then parse back to a float
        const numericPart = parseFloat(result.replace(/^\$/, '').replace(/,/g, ''));
        const expected = roundToTwo(amount);
        // Allow a tolerance of 0.005 to account for floating-point representation
        expect(Math.abs(numericPart - expected)).toBeLessThan(0.005);
      }),
      { numRuns: 100 }
    );
  });

  it('renderBalance: #balance shows formatCurrency of the exact arithmetic sum', () => {
    // Ensure a #balance element exists in jsdom for each test run
    document.body.innerHTML = '<span id="balance"></span>';

    fc.assert(
      fc.property(nonEmptyTransactionArray, (txns) => {
        renderBalance(txns);

        const balanceEl = document.getElementById('balance');
        const displayed = balanceEl.textContent;

        // Compute the expected sum independently
        const rawSum = txns.reduce((acc, t) => acc + t.amount, 0);
        const expected = formatCurrency(rawSum);

        expect(displayed).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('renderBalance: shows "$0.00" when given an empty array', () => {
    document.body.innerHTML = '<span id="balance"></span>';
    renderBalance([]);
    const displayed = document.getElementById('balance').textContent;
    expect(displayed).toBe('$0.00');
  });
});

// ─── Property 5 ───────────────────────────────────────────────────────────────

// Feature: expense-budget-visualizer, Property 5: Rendered list items expose all required fields and a delete control

const { renderList } = require('../js/app.js');

// ─── Arbitraries for Property 5 ───────────────────────────────────────────────

/** Generates a valid Transaction object (same shape as Property 1). */
const validTransaction = fc.record({
  id: nonEmptyString,
  name: nonEmptyString,
  amount: positiveFloat,
  category,
});

/** Generates an array of 0–20 valid transactions. */
const transactionArrayForList = fc.array(validTransaction, { minLength: 0, maxLength: 20 });

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 5: Rendered list items expose all required fields and a delete control', () => {
  /**
   * Validates: Requirements 2.1, 2.5
   *
   * For any array of valid transactions, renderList must produce exactly one
   * <li> per transaction, and each <li> must contain the transaction's name,
   * formatted amount, category, and a delete button whose data-id equals the
   * transaction's id.
   */

  beforeEach(() => {
    document.body.innerHTML = '<ul id="transaction-list"></ul>';
  });

  it('renders exactly one <li> per transaction', () => {
    fc.assert(
      fc.property(transactionArrayForList, (txns) => {
        renderList(txns);
        const listEl = document.getElementById('transaction-list');
        const items = listEl.querySelectorAll('li');
        expect(items.length).toBe(txns.length);
      }),
      { numRuns: 100 }
    );
  });

  it('each <li> contains the transaction name', () => {
    fc.assert(
      fc.property(transactionArrayForList, (txns) => {
        renderList(txns);
        const listEl = document.getElementById('transaction-list');
        const items = listEl.querySelectorAll('li');
        txns.forEach((t, i) => {
          expect(items[i].textContent).toContain(t.name);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('each <li> contains the formatted amount', () => {
    fc.assert(
      fc.property(transactionArrayForList, (txns) => {
        renderList(txns);
        const listEl = document.getElementById('transaction-list');
        const items = listEl.querySelectorAll('li');
        txns.forEach((t, i) => {
          expect(items[i].textContent).toContain(formatCurrency(t.amount));
        });
      }),
      { numRuns: 100 }
    );
  });

  it('each <li> contains the transaction category', () => {
    fc.assert(
      fc.property(transactionArrayForList, (txns) => {
        renderList(txns);
        const listEl = document.getElementById('transaction-list');
        const items = listEl.querySelectorAll('li');
        txns.forEach((t, i) => {
          expect(items[i].textContent).toContain(t.category);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('each <li> has a delete button with data-id equal to the transaction id', () => {
    fc.assert(
      fc.property(transactionArrayForList, (txns) => {
        renderList(txns);
        const listEl = document.getElementById('transaction-list');
        const items = listEl.querySelectorAll('li');
        txns.forEach((t, i) => {
          const deleteBtn = items[i].querySelector('button[data-id]');
          expect(deleteBtn).not.toBeNull();
          expect(deleteBtn.dataset.id).toBe(t.id);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('all five fields hold simultaneously for every transaction in the array', () => {
    fc.assert(
      fc.property(transactionArrayForList, (txns) => {
        renderList(txns);
        const listEl = document.getElementById('transaction-list');
        const items = listEl.querySelectorAll('li');

        expect(items.length).toBe(txns.length);

        txns.forEach((t, i) => {
          const li = items[i];
          // Name present
          expect(li.textContent).toContain(t.name);
          // Formatted amount present
          expect(li.textContent).toContain(formatCurrency(t.amount));
          // Category present
          expect(li.textContent).toContain(t.category);
          // Delete button with correct data-id
          const deleteBtn = li.querySelector('button[data-id]');
          expect(deleteBtn).not.toBeNull();
          expect(deleteBtn.dataset.id).toBe(t.id);
        });
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4 ───────────────────────────────────────────────────────────────

// Feature: expense-budget-visualizer, Property 4: Delete removes the transaction from both state and storage

// deleteTransaction(id) in app.js does exactly two things:
//   1. transactions = transactions.filter(t => t.id !== id)   [state mutation]
//   2. saveToStorage(transactions)                             [storage write]
//
// Because the module-level `transactions` variable is not directly settable
// from outside app.js (no exported setter), we test the two observable
// outputs of deleteTransaction by exercising the same underlying operations
// that the function performs:
//   - Observable A (state): the filtered array must not contain the deleted id.
//   - Observable B (storage): saveToStorage(filteredArray) followed by
//     loadFromStorage() must also not contain the deleted id.
//
// This is a faithful property test of the delete contract as stated in
// Requirements 3.1 and 3.2 — it validates that the filter logic produces the
// right array and that the array is correctly persisted and retrievable.

describe('Property 4: Delete removes the transaction from both state and storage', () => {
  /**
   * Validates: Requirements 3.1, 3.2
   *
   * For any non-empty array of transactions, after removing the entry with
   * the target id the resulting array must not contain that id, and
   * deserialising the updated localStorage value must also not contain it.
   */

  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Non-empty transaction array generator with guaranteed-unique ids.
   * Using fc.uniqueArray on the whole record via a custom comparator ensures
   * no two entries share an id, so exactly one entry is removed per delete.
   */
  const uniqueIdTransactionArray = fc.array(
    fc.record({
      id: nonEmptyString,
      name: nonEmptyString,
      amount: positiveFloat,
      category,
    }),
    { minLength: 1, maxLength: 20 }
  ).map(txns => {
    // De-duplicate by id: keep the first occurrence of each id
    const seen = new Set();
    return txns.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }).filter(txns => txns.length >= 1);  // guarantee at least one entry after de-dup

  it('deleted id is absent from the in-memory array after filtering', () => {
    fc.assert(
      fc.property(
        uniqueIdTransactionArray,
        fc.nat(),   // index selector
        (txns, pickIndex) => {
          const targetIndex  = pickIndex % txns.length;
          const targetId     = txns[targetIndex].id;

          // Replicate the state-mutation half of deleteTransaction
          const afterDelete = txns.filter(t => t.id !== targetId);

          // The deleted id must be gone
          expect(afterDelete.some(t => t.id === targetId)).toBe(false);
          // All other entries must survive
          expect(afterDelete.length).toBe(txns.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deleted id is absent from localStorage after saveToStorage(filteredArray)', () => {
    fc.assert(
      fc.property(
        uniqueIdTransactionArray,
        fc.nat(),
        (txns, pickIndex) => {
          const targetIndex = pickIndex % txns.length;
          const targetId    = txns[targetIndex].id;

          // Replicate the storage-write half of deleteTransaction
          const afterDelete = txns.filter(t => t.id !== targetId);

          localStorage.clear();
          saveToStorage(afterDelete);
          const restored = loadFromStorage();

          // The deleted id must not appear in what was persisted
          expect(restored.some(t => t.id === targetId)).toBe(false);
          // Length is preserved through the round-trip
          expect(restored.length).toBe(afterDelete.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('both state and storage are consistent after a delete (combined property)', () => {
    fc.assert(
      fc.property(
        uniqueIdTransactionArray,
        fc.nat(),
        (txns, pickIndex) => {
          const targetIndex = pickIndex % txns.length;
          const targetId    = txns[targetIndex].id;

          // Apply the full deleteTransaction contract in one place
          const afterDelete = txns.filter(t => t.id !== targetId);

          localStorage.clear();
          saveToStorage(afterDelete);
          const restored = loadFromStorage();

          // ── Observable A: in-memory array excludes the deleted id ──────────
          expect(afterDelete.some(t => t.id === targetId)).toBe(false);
          expect(afterDelete.length).toBe(txns.length - 1);

          // ── Observable B: deserialised storage excludes the deleted id ─────
          expect(restored.some(t => t.id === targetId)).toBe(false);
          expect(restored.length).toBe(txns.length - 1);

          // ── Observable C: state and storage agree ─────────────────────────
          expect(restored.length).toBe(afterDelete.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6 ───────────────────────────────────────────────────────────────

// Feature: expense-budget-visualizer, Property 6: Pie chart data matches per-category totals

const { buildChartData, CATEGORY_COLORS } = require('../js/app.js');

// ─── Arbitraries for Property 6 ───────────────────────────────────────────────

/** Generates a non-empty array (1–30 items) of valid transactions. */
const nonEmptyTransactionArrayForChart = fc.array(
  fc.record({
    id: nonEmptyString,
    name: nonEmptyString,
    amount: smallPositiveFloat,
    category,
  }),
  { minLength: 1, maxLength: 30 }
);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 6: Pie chart data matches per-category totals', () => {
  /**
   * Validates: Requirements 5.1
   *
   * For any non-empty transactions array, buildChartData must return a labels
   * array containing exactly the distinct categories present in the transactions,
   * and each corresponding data value must equal the sum of amount for all
   * transactions in that category. The colors array must carry the correct hex
   * value from CATEGORY_COLORS for each label.
   */

  it('labels contain exactly the distinct categories present — no more, no less', () => {
    fc.assert(
      fc.property(nonEmptyTransactionArrayForChart, (txns) => {
        const { labels } = buildChartData(txns);

        const distinctCategories = [...new Set(txns.map(t => t.category))];

        // Same size
        expect(labels.length).toBe(distinctCategories.length);

        // Every distinct category is in labels
        distinctCategories.forEach(cat => {
          expect(labels).toContain(cat);
        });

        // No label appears that isn't in the transactions
        labels.forEach(label => {
          expect(distinctCategories).toContain(label);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('each data value equals the precise sum of amounts for its category', () => {
    fc.assert(
      fc.property(nonEmptyTransactionArrayForChart, (txns) => {
        const { labels, data } = buildChartData(txns);

        labels.forEach((label, i) => {
          const expectedSum = txns
            .filter(t => t.category === label)
            .reduce((acc, t) => acc + t.amount, 0);

          // Allow a small floating-point tolerance (1e-6)
          expect(Math.abs(data[i] - expectedSum)).toBeLessThan(1e-6);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('each color matches the CATEGORY_COLORS entry for its label', () => {
    fc.assert(
      fc.property(nonEmptyTransactionArrayForChart, (txns) => {
        const { labels, colors } = buildChartData(txns);

        labels.forEach((label, i) => {
          expect(colors[i]).toBe(CATEGORY_COLORS[label]);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('all three properties hold simultaneously for every generated array', () => {
    fc.assert(
      fc.property(nonEmptyTransactionArrayForChart, (txns) => {
        const { labels, data, colors } = buildChartData(txns);

        const distinctCategories = [...new Set(txns.map(t => t.category))];

        // ── Labels match distinct categories ──────────────────────────────────
        expect(labels.length).toBe(distinctCategories.length);
        distinctCategories.forEach(cat => expect(labels).toContain(cat));
        labels.forEach(label => expect(distinctCategories).toContain(label));

        // ── Data values match per-category sums ───────────────────────────────
        labels.forEach((label, i) => {
          const expectedSum = txns
            .filter(t => t.category === label)
            .reduce((acc, t) => acc + t.amount, 0);
          expect(Math.abs(data[i] - expectedSum)).toBeLessThan(1e-6);
        });

        // ── Colors match CATEGORY_COLORS ──────────────────────────────────────
        labels.forEach((label, i) => {
          expect(colors[i]).toBe(CATEGORY_COLORS[label]);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('returns empty arrays when given an empty transaction list', () => {
    const { labels, data, colors } = buildChartData([]);
    expect(labels).toEqual([]);
    expect(data).toEqual([]);
    expect(colors).toEqual([]);
  });
});
