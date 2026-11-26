# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a self-contained, client-side SPA using plain HTML, CSS, and Vanilla JavaScript. The app records expense transactions, displays them in a scrollable list, tracks a running balance, and visualises category spending in a Chart.js pie chart. All state is persisted to `localStorage`; no build tool or server is required.

## Tasks

- [x] 1. Set up project structure and static HTML entry point
  - Create `index.html` at the project root with semantic markup: `#expense-form`, `#transaction-list`, `#balance`, `#spending-chart` (`<canvas>`), `#form-error`, and a `<div id="storage-banner">` for non-blocking notices
  - Add a `<script>` CDN tag for Chart.js and a `<link>` for `css/style.css`
  - Create `css/style.css` with minimal reset, flex/grid layout, readable typography, and scrollable list styles
  - Create an empty `js/app.js` and wire it into `index.html` with a `<script defer src="js/app.js">` tag
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.4_

- [x] 2. Implement data model, ID generation, and localStorage utilities
  - [x] 2.1 Define the `Transaction` shape and `CATEGORY_COLORS` constant in `js/app.js`
    - Declare the `STORAGE_KEY` constant and `CATEGORY_COLORS` map (`Food`, `Transport`, `Fun`)
    - Implement `generateId()` using `crypto.randomUUID()` with a fallback for older Safari
    - _Requirements: 7.2_

  - [x] 2.2 Implement `saveToStorage` and `loadFromStorage`
    - `saveToStorage(transactions)`: serialises the array to JSON and writes to `localStorage`; catches `SecurityError` / quota errors and shows the storage banner
    - `loadFromStorage()`: reads and parses the JSON; returns `[]` and shows the storage banner on any error
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.3 Write property test for JSON round-trip (Property 1)
    - **Property 1: Serialisation round-trip preserves all transaction data**
    - **Validates: Requirements 1.2, 6.1, 6.2, 6.3**
    - Use fast-check to generate arbitrary valid transaction arrays; assert deserialise ∘ serialise = identity for `id`, `name`, `amount`, `category`

- [x] 3. Implement form validation and transaction creation
  - [ ] 3.1 Implement `validateForm(name, amount, category)`
    - Return `{ valid: false, errors: [...] }` when name is empty/whitespace, amount is non-numeric, zero, or negative, or category is not in the allowed set
    - Return `{ valid: true, errors: [] }` for all valid inputs
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Write property test for `validateForm` (Property 2)
    - **Property 2: Invalid input is rejected and leaves state unchanged**
    - **Validates: Requirements 1.3, 1.4**
    - Use fast-check to generate whitespace-only names, non-positive amounts, and non-numeric strings; assert `valid === false` for all

  - [x] 3.3 Implement `addTransaction`, `showFormError`, `hideFormError`, and `resetForm`
    - `addTransaction()`: reads form values, calls `validateForm`, shows errors or creates a new `Transaction` object, pushes to `transactions`, calls `saveToStorage`, then `render()`
    - `resetForm()`: clears all form fields to their defaults after a successful submission
    - Wire the `submit` event on `#expense-form`
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 4. Implement the render orchestrator and balance display
  - [ ] 4.1 Implement `formatCurrency(amount)` and `renderBalance(transactions)`
    - `formatCurrency` formats any non-negative number as `$X,XXX.XX`
    - `renderBalance` sums all amounts and writes the formatted value to `#balance`; shows `$0.00` for an empty array
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 4.2 Write property test for `formatCurrency` and balance sum (Property 3)
    - **Property 3: Balance equals the arithmetic sum of all amounts**
    - **Validates: Requirements 4.1, 4.3, 4.4**
    - Use fast-check to generate arrays of positive floats; assert the displayed string equals the correctly rounded sum

  - [x] 4.3 Implement `render()` orchestrator (skeleton)
    - Define `render()` that calls `renderList`, `renderBalance`, and `renderChart` with the current `transactions` array
    - Implement `renderList(transactions)` as a stub returning an empty `<ul>` to keep the app runnable while other components are built
    - _Requirements: 2.4, 4.2_

- [x] 5. Implement the transaction list and delete functionality
  - [x] 5.1 Implement `renderList(transactions)`
    - Clears `#transaction-list` and re-renders one `<li>` per transaction containing name, formatted amount, category badge, and a `<button data-id="...">Delete</button>`
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 5.2 Write property test for `renderList` output (Property 5)
    - **Property 5: Rendered list items expose all required fields and a delete control**
    - **Validates: Requirements 2.1, 2.5**
    - Use fast-check to generate arrays of valid transactions; assert one `<li>` per transaction with correct name, amount, category, and `data-id` on the delete button

  - [x] 5.3 Implement `deleteTransaction(id)` and wire the delete event
    - `deleteTransaction(id)`: filters the transaction with the given `id` from `transactions`, calls `saveToStorage`, then `render()`
    - Use event delegation on `#transaction-list` to handle delete button clicks
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.4 Write property test for `deleteTransaction` (Property 4)
    - **Property 4: Delete removes the transaction from both state and storage**
    - **Validates: Requirements 3.1, 3.2**
    - Use fast-check to generate non-empty arrays; pick a random transaction, call delete, assert it is absent from both the in-memory array and the deserialised storage value

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the pie chart
  - [x] 7.1 Implement `buildChartData(transactions)`
    - Groups transactions by category, sums amounts per group
    - Returns `{ labels: string[], data: number[], colors: string[] }` using `CATEGORY_COLORS`
    - Returns empty arrays when no transactions exist
    - _Requirements: 5.1, 5.5_

  - [x] 7.2 Write property test for `buildChartData` (Property 6)
    - **Property 6: Pie chart data matches per-category totals**
    - **Validates: Requirements 5.1**
    - Use fast-check to generate non-empty transaction arrays; assert labels equal distinct categories present and each data value equals the sum for its category

  - [x] 7.3 Implement `renderChart(transactions)` with Chart.js
    - Create the Chart.js `Pie` instance on first call and store it in `chartInstance`; call `chart.update()` on subsequent renders to avoid flickering
    - Pass `buildChartData` output to the chart; handle Chart.js CDN unavailability gracefully (canvas stays blank, `window.onerror` logs the failure)
    - Render an empty/placeholder state when `transactions` is empty
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 8. Wire page load, localStorage initialisation, and storage error banner
  - On `DOMContentLoaded`, call `loadFromStorage()`, assign the result to `transactions`, then call `render()`
  - Show `#storage-banner` with a non-blocking message when `loadFromStorage` or `saveToStorage` encounters an error; the app continues working in-memory
  - _Requirements: 2.3, 6.3, 6.4_

- [ ] 9. Write example-based integration tests
  - [x] 9.1 Test: form submit updates DOM list
    - Submit the form via jsdom and assert the new item appears in `#transaction-list`
    - _Requirements: 1.2, 2.4_

  - [ ] 9.2 Test: balance shows `$0.00` with no transactions
    - Assert `#balance` content equals `$0.00` after `render()` is called with an empty array
    - _Requirements: 4.3_

  - [ ] 9.3 Test: delete control removes item from DOM
    - Add a transaction, trigger delete, assert the `<li>` is gone from `#transaction-list`
    - _Requirements: 3.1_

  - [ ] 9.4 Test: page load reads from mocked localStorage
    - Mock `localStorage.getItem` to return a serialised array; assert `#transaction-list` renders the expected items after `DOMContentLoaded`
    - _Requirements: 2.3, 6.3_

  - [ ] 9.5 Test: localStorage unavailable — banner appears
    - Mock `localStorage.setItem` to throw; submit a form, assert `#storage-banner` becomes visible
    - _Requirements: 6.4_

  - [ ] 9.6 Test: pie chart renders without error on empty list
    - Call `renderChart([])` with a mocked Chart.js; assert no uncaught exception and canvas remains in document
    - _Requirements: 5.5_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation at sensible boundaries.
- Property tests (fast-check, ≥100 iterations each) validate the six correctness properties from the design document.
- Unit/integration tests (Jest + jsdom) validate DOM behaviour and example-based scenarios.
- The production app has zero runtime dependencies beyond the Chart.js CDN; `jest` and `fast-check` are devDependencies used only for running tests.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2", "5.3"] },
    { "id": 10, "tasks": ["5.4"] },
    { "id": 11, "tasks": ["6"] },
    { "id": 12, "tasks": ["7.1"] },
    { "id": 13, "tasks": ["7.2", "7.3"] },
    { "id": 14, "tasks": ["8"] },
    { "id": 15, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 16, "tasks": ["10"] }
  ]
}
```
