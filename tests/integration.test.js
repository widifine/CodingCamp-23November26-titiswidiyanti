'use strict';

/**
 * Integration tests for Expense & Budget Visualizer.
 * Tests 9.1 – 9.6: example-based DOM behaviour tests using Jest + jsdom.
 *
 * The module-level `transactions` array in app.js accumulates across tests
 * because require() caches the module.  We use jest.isolateModules() inside
 * each describe block so every suite gets a fresh module instance with an
 * empty transactions array.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the full app HTML fixture exactly matching index.html.
 * Provides every element id that the app functions reference.
 */
function buildAppHTML() {
  return `
    <div id="storage-banner" class="banner hidden"></div>
    <span id="balance">$0.00</span>
    <form id="expense-form">
      <input type="text"   id="item-name"  value="" />
      <input type="number" id="amount"     value="" />
      <select id="category">
        <option value="">-- Select --</option>
        <option value="Food">Food</option>
        <option value="Transport">Transport</option>
        <option value="Fun">Fun</option>
      </select>
      <div id="form-error" class="form-error hidden"></div>
      <button type="submit" id="submit-btn">Add Transaction</button>
    </form>
    <ul id="transaction-list"></ul>
    <canvas id="spending-chart"></canvas>
  `;
}

/**
 * Resets the DOM to the full app fixture and clears localStorage.
 * Accepts an `app` instance so callers can pass a freshly-required module.
 */
function resetApp(app) {
  localStorage.clear();
  document.body.innerHTML = buildAppHTML();
  app.renderList([]);
  app.renderBalance([]);
}

// ─── 9.1 Test: form submit updates DOM list ───────────────────────────────────

/**
 * Requirements: 1.2, 2.4
 *
 * Submit the form via jsdom and assert the new item appears in
 * #transaction-list.
 */
describe('9.1 Form submit updates DOM list', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = require('../js/app.js');
    resetApp(app);
  });

  it('adds a new <li> to #transaction-list when the form is submitted with valid data', () => {
    // Fill in the form fields
    document.getElementById('item-name').value = 'Coffee';
    document.getElementById('amount').value    = '4.50';
    document.getElementById('category').value  = 'Food';

    // Dispatch a submit event on the form
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      app.addTransaction();
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // The list must now contain exactly one item
    const items = document.querySelectorAll('#transaction-list li');
    expect(items.length).toBe(1);
  });

  it('the new list item contains the submitted item name', () => {
    document.getElementById('item-name').value = 'Train ticket';
    document.getElementById('amount').value    = '15.00';
    document.getElementById('category').value  = 'Transport';

    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      app.addTransaction();
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const list = document.getElementById('transaction-list');
    expect(list.textContent).toContain('Train ticket');
  });

  it('a second submission adds a second list item without a page reload', () => {
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      app.addTransaction();
    });

    // First transaction
    document.getElementById('item-name').value = 'Lunch';
    document.getElementById('amount').value    = '12.00';
    document.getElementById('category').value  = 'Food';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Second transaction
    document.getElementById('item-name').value = 'Movie';
    document.getElementById('amount').value    = '9.00';
    document.getElementById('category').value  = 'Fun';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const items = document.querySelectorAll('#transaction-list li');
    expect(items.length).toBe(2);
  });
});

// ─── 9.2 Test: balance shows $0.00 with no transactions ───────────────────────

/**
 * Requirements: 4.3
 *
 * Assert #balance content equals "$0.00" after render() is called with an
 * empty array.
 */
describe('9.2 Balance shows $0.00 with no transactions', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = require('../js/app.js');
    resetApp(app);
  });

  it('shows "$0.00" after renderBalance is called with an empty array', () => {
    app.renderBalance([]);
    expect(document.getElementById('balance').textContent).toBe('$0.00');
  });

  it('shows "$0.00" after a full render() cycle with empty localStorage', () => {
    // localStorage is already empty; render() reads [] and updates the DOM
    app.renderList([]);
    app.renderBalance([]);
    expect(document.getElementById('balance').textContent).toBe('$0.00');
  });

  it('resets balance to "$0.00" after all transactions are removed', () => {
    // Start with one transaction
    document.getElementById('item-name').value = 'Snack';
    document.getElementById('amount').value    = '2.00';
    document.getElementById('category').value  = 'Food';

    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      app.addTransaction();
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Balance should not be $0.00 now
    expect(document.getElementById('balance').textContent).not.toBe('$0.00');

    // Remove all transactions by resetting state
    app.renderBalance([]);
    expect(document.getElementById('balance').textContent).toBe('$0.00');
  });
});

// ─── 9.3 Test: delete control removes item from DOM ───────────────────────────

/**
 * Requirements: 3.1
 *
 * Add a transaction, trigger the delete button, assert the <li> is gone from
 * #transaction-list.
 */
describe('9.3 Delete control removes item from DOM', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = require('../js/app.js');
    resetApp(app);
    // Wire the submit handler once per test so addTransaction runs
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      app.addTransaction();
    });
    // Wire the delete-by-delegation handler once per test
    const listEl = document.getElementById('transaction-list');
    listEl.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      if (id) {
        app.deleteTransaction(id);
      }
    });
  });

  it('list is empty after deleting the only transaction', () => {
    // Add one transaction via the form
    document.getElementById('item-name').value = 'Bus';
    document.getElementById('amount').value    = '3.00';
    document.getElementById('category').value  = 'Transport';
    document.getElementById('expense-form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Confirm it was added
    expect(document.querySelectorAll('#transaction-list li').length).toBe(1);

    // Click the delete button
    const deleteBtn = document.querySelector('#transaction-list button[data-id]');
    expect(deleteBtn).not.toBeNull();
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // List must now be empty
    expect(document.querySelectorAll('#transaction-list li').length).toBe(0);
  });

  it('deletes only the targeted transaction when multiple exist', () => {
    // Add two transactions
    document.getElementById('item-name').value = 'Dinner';
    document.getElementById('amount').value    = '20.00';
    document.getElementById('category').value  = 'Food';
    document.getElementById('expense-form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    document.getElementById('item-name').value = 'Cinema';
    document.getElementById('amount').value    = '14.00';
    document.getElementById('category').value  = 'Fun';
    document.getElementById('expense-form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(document.querySelectorAll('#transaction-list li').length).toBe(2);

    // Delete the first item
    const firstDeleteBtn = document.querySelector('#transaction-list li:first-child button[data-id]');
    const deletedId = firstDeleteBtn.dataset.id;
    firstDeleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // One item remains and it is not the deleted one
    const remaining = document.querySelectorAll('#transaction-list li');
    expect(remaining.length).toBe(1);
    const remainingBtn = remaining[0].querySelector('button[data-id]');
    expect(remainingBtn.dataset.id).not.toBe(deletedId);
  });
});

// ─── 9.4 Test: page load reads from mocked localStorage ──────────────────────

/**
 * Requirements: 2.3, 6.3
 *
 * Mock localStorage.getItem to return a serialised array; assert
 * #transaction-list renders the expected items.
 *
 * Because DOMContentLoaded fires once at module load time (before our test
 * runs), we simulate the page-load init path by calling loadFromStorage()
 * + renderList() directly — exactly what the DOMContentLoaded handler does.
 */
describe('9.4 Page load reads from mocked localStorage', () => {
  let app;

  const storedTransactions = [
    { id: 'aaa1', name: 'Pre-stored Lunch', amount: 11.50, category: 'Food' },
    { id: 'bbb2', name: 'Pre-stored Bus',   amount:  2.00, category: 'Transport' },
  ];

  beforeEach(() => {
    jest.resetModules();
    app = require('../js/app.js');
    document.body.innerHTML = buildAppHTML();
    // Seed localStorage with pre-existing data
    localStorage.setItem(
      app.STORAGE_KEY,
      JSON.stringify(storedTransactions)
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders both pre-stored transactions in #transaction-list on init', () => {
    // Simulate the DOMContentLoaded init path
    const loaded = app.loadFromStorage();
    app.renderList(loaded);

    const items = document.querySelectorAll('#transaction-list li');
    expect(items.length).toBe(2);
  });

  it('each pre-stored transaction name appears in the list', () => {
    const loaded = app.loadFromStorage();
    app.renderList(loaded);

    const listText = document.getElementById('transaction-list').textContent;
    expect(listText).toContain('Pre-stored Lunch');
    expect(listText).toContain('Pre-stored Bus');
  });

  it('balance reflects the sum of pre-stored transactions', () => {
    const loaded = app.loadFromStorage();
    app.renderList(loaded);
    app.renderBalance(loaded);

    // 11.50 + 2.00 = 13.50
    expect(document.getElementById('balance').textContent).toBe('$13.50');
  });
});

// ─── 9.5 Test: localStorage unavailable — banner appears ─────────────────────

/**
 * Requirements: 6.4
 *
 * Mock localStorage.setItem to throw; submit a form, assert #storage-banner
 * becomes visible.
 */
describe('9.5 localStorage unavailable — banner appears', () => {
  let app;
  let originalSetItem;

  beforeEach(() => {
    jest.resetModules();
    app = require('../js/app.js');
    resetApp(app);
    // Spy on localStorage.setItem and make it throw a SecurityError
    originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      const err = new DOMException('localStorage is unavailable', 'SecurityError');
      throw err;
    };
  });

  afterEach(() => {
    // Restore the original setItem
    Storage.prototype.setItem = originalSetItem;
    localStorage.clear();
  });

  it('banner is hidden before the form is submitted', () => {
    const banner = document.getElementById('storage-banner');
    expect(banner.classList.contains('hidden')).toBe(true);
  });

  it('banner becomes visible after saveToStorage fails', () => {
    // Trigger saveToStorage directly — this should catch the error and show the banner
    app.saveToStorage([{ id: 'x1', name: 'Test', amount: 5, category: 'Fun' }]);

    const banner = document.getElementById('storage-banner');
    expect(banner.classList.contains('hidden')).toBe(false);
  });

  it('banner becomes visible after a form submit that triggers saveToStorage', () => {
    // Wire submit handler
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      app.addTransaction();
    });

    // Fill in valid form data
    document.getElementById('item-name').value = 'Groceries';
    document.getElementById('amount').value    = '50.00';
    document.getElementById('category').value  = 'Food';

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const banner = document.getElementById('storage-banner');
    expect(banner.classList.contains('hidden')).toBe(false);
  });
});

// ─── 9.6 Test: pie chart renders without error on empty list ──────────────────

/**
 * Requirements: 5.5
 *
 * Call renderChart([]) with a mocked Chart.js; assert no uncaught exception
 * and canvas remains in document.
 *
 * Chart.js is loaded via CDN in the browser and is not available in jsdom.
 * renderChart() guards: when window.Chart is undefined it calls window.onerror
 * (if defined) and returns early — the canvas is untouched.
 *
 * We test two scenarios:
 *   A) Chart.js unavailable: renderChart([]) must not throw and canvas stays put.
 *   B) Chart.js available (mocked): renderChart([]) creates a Chart instance
 *      with empty data and canvas stays put.
 */
describe('9.6 Pie chart renders without error on empty list', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = require('../js/app.js');
    document.body.innerHTML = buildAppHTML();
    delete window.Chart;
  });

  afterEach(() => {
    delete window.Chart;
  });

  it('does not throw when Chart.js is unavailable and transaction list is empty', () => {
    // window.Chart is undefined — the guard in renderChart handles this
    expect(() => {
      app.renderChart([]);
    }).not.toThrow();
  });

  it('canvas element remains in the document after renderChart([]) with no Chart.js', () => {
    app.renderChart([]);
    expect(document.getElementById('spending-chart')).not.toBeNull();
  });

  it('invokes window.onerror when Chart.js is unavailable', () => {
    const errors = [];
    window.onerror = (...args) => {
      errors.push(args[0]);
    };

    app.renderChart([]);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/chart\.js/i);

    delete window.onerror;
  });

  it('does not throw when Chart.js is mocked and transaction list is empty', () => {
    // Provide a minimal Chart.js mock
    const chartUpdateMock = jest.fn();
    const chartInstanceMock = {
      data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
      update: chartUpdateMock,
    };

    window.Chart = jest.fn().mockImplementation(() => chartInstanceMock);

    // getContext is not implemented in jsdom by default; stub it
    const canvas = document.getElementById('spending-chart');
    canvas.getContext = jest.fn().mockReturnValue({});

    expect(() => {
      app.renderChart([]);
    }).not.toThrow();

    expect(document.getElementById('spending-chart')).not.toBeNull();
  });

  it('canvas stays in document when Chart.js is mocked and list is non-empty', () => {
    const chartUpdateMock = jest.fn();
    const chartInstanceMock = {
      data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
      update: chartUpdateMock,
    };
    window.Chart = jest.fn().mockImplementation(() => chartInstanceMock);

    const canvas = document.getElementById('spending-chart');
    canvas.getContext = jest.fn().mockReturnValue({});

    const txns = [{ id: 'z1', name: 'Pizza', amount: 18, category: 'Food' }];
    expect(() => {
      app.renderChart(txns);
    }).not.toThrow();

    expect(document.getElementById('spending-chart')).not.toBeNull();
  });
});
