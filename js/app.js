// Expense & Budget Visualizer — app logic

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'expense_visualizer_transactions';
const THEME_KEY   = 'expense_visualizer_theme';
const LIMIT_KEY   = 'expense_visualizer_limit';

const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Array<{id: string, name: string, amount: number, category: string}>} */
let transactions = [];

/** Current sort mode for the transaction list. */
let currentSort = 'newest';

/** Spending limit in dollars, or null when no limit is set. */
let spendingLimit = null;

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generates a unique ID using crypto.randomUUID() when available,
 * falling back to a timestamp+random string for older Safari.
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Storage Banner ───────────────────────────────────────────────────────────

/**
 * Makes the storage-error banner visible.
 */
function showStorageBanner() {
  const banner = document.getElementById('storage-banner');
  if (banner) {
    banner.classList.remove('hidden');
  }
}

// ─── localStorage Utilities ───────────────────────────────────────────────────

/**
 * Serialises the transactions array to JSON and writes it to localStorage.
 * Shows the storage banner and silently continues on SecurityError or quota error.
 * @param {Array} transactions
 */
function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    // SecurityError (private browsing) or QuotaExceededError
    showStorageBanner();
  }
}

/**
 * Reads and parses the transactions array from localStorage.
 * Returns an empty array and shows the storage banner on any error.
 * @returns {Array}
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      showStorageBanner();
      return [];
    }
    return parsed;
  } catch (err) {
    // JSON parse error or localStorage access error
    showStorageBanner();
    return [];
  }
}

// ─── Form Validation ──────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Validates the three form inputs before creating a transaction.
 * @param {string} name
 * @param {string|number} amount
 * @param {string} category
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateForm(name, amount, category) {
  const errors = [];

  // Validate name: must be non-empty after trimming whitespace
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Item name is required.');
  }

  // Validate amount: must be a positive number
  const parsedAmount = parseFloat(amount);
  if (amount === '' || amount === null || amount === undefined || isNaN(parsedAmount)) {
    errors.push('Amount must be a valid number.');
  } else if (parsedAmount <= 0) {
    errors.push('Amount must be a positive number.');
  }

  // Validate category: must be one of the allowed values
  if (!VALID_CATEGORIES.includes(category)) {
    errors.push('Please select a valid category (Food, Transport, or Fun).');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Form Error Display ───────────────────────────────────────────────────────

/**
 * Displays an error message in the #form-error element.
 * @param {string} message
 */
function showFormError(message) {
  const errorEl = document.getElementById('form-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

/**
 * Hides the #form-error element.
 */
function hideFormError() {
  const errorEl = document.getElementById('form-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
}

// ─── Form Reset ────────────────────────────────────────────────────────────────

/**
 * Resets all form fields to their default empty state.
 */
function resetForm() {
  const form = document.getElementById('expense-form');
  if (form) {
    form.reset();
  }
}

// ─── Add Transaction ──────────────────────────────────────────────────────────

/**
 * Reads form values, validates them, and — if valid — creates a new transaction,
 * persists it to localStorage, and triggers a re-render.
 */
function addTransaction() {
  const nameEl     = document.getElementById('item-name');
  const amountEl   = document.getElementById('amount');
  const categoryEl = document.getElementById('category');

  const name     = nameEl     ? nameEl.value     : '';
  const amount   = amountEl   ? amountEl.value   : '';
  const category = categoryEl ? categoryEl.value : '';

  const { valid, errors } = validateForm(name, amount, category);

  if (!valid) {
    showFormError(errors.join(' '));
    return;
  }

  hideFormError();

  const transaction = {
    id:       generateId(),
    name:     name.trim(),
    amount:   parseFloat(amount),
    category: category,
  };

  transactions.push(transaction);
  saveToStorage(transactions);
  render();
  resetForm();
}

// ─── Balance Display ──────────────────────────────────────────────────────────

/**
 * Formats a non-negative number as a USD currency string.
 * Examples: formatCurrency(1234.5) → "$1,234.50", formatCurrency(0) → "$0.00"
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Sums the `amount` field of all transactions and writes the formatted
 * result to the #balance DOM element. Shows "$0.00" for an empty array.
 * @param {Array<{amount: number}>} transactions
 */
function renderBalance(transactions) {
  const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
  const balanceEl = document.getElementById('balance');
  if (balanceEl) {
    balanceEl.textContent = formatCurrency(sum);
  }
}

// ─── Transaction List ─────────────────────────────────────────────────────────

/**
 * Clears and re-renders the #transaction-list element.
 * Each transaction gets its own <li> containing the name, formatted amount,
 * a category badge, and a delete button with the transaction id in data-id.
 * @param {Array<{id: string, name: string, amount: number, category: string}>} transactions
 */
function renderList(transactions) {
  const listEl = document.getElementById('transaction-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  transactions.forEach(function (t) {
    const li = document.createElement('li');

    // Left column: name + category badge
    const infoDiv = document.createElement('div');
    infoDiv.className = 'tx-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = t.name;

    const badge = document.createElement('span');
    badge.className = 'tx-meta';
    badge.textContent = t.category;
    badge.style.color = CATEGORY_COLORS[t.category] || '#666';

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(badge);

    // Amount
    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = formatCurrency(t.amount);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.dataset.id = t.id;
    deleteBtn.setAttribute('aria-label', 'Delete ' + t.name);

    li.appendChild(infoDiv);
    li.appendChild(amountSpan);
    li.appendChild(deleteBtn);

    listEl.appendChild(li);
  });
}

// ─── Delete Transaction ───────────────────────────────────────────────────────

/**
 * Removes the transaction with the given id from the transactions array,
 * persists the updated list, and triggers a re-render.
 * @param {string} id
 */
function deleteTransaction(id) {
  transactions = transactions.filter(function (t) { return t.id !== id; });
  saveToStorage(transactions);
  render();
}

// ─── Sort Transactions (Optional Challenge) ───────────────────────────────────

/**
 * Returns a sorted copy of the transactions array. The original array
 * (and the order stored in localStorage) is never mutated.
 * @param {Array<{amount: number, category: string, name: string}>} list
 * @param {string} mode  'newest' | 'oldest' | 'amount-desc' | 'amount-asc' | 'category'
 * @returns {Array}
 */
function sortTransactions(list, mode) {
  const copy = list.slice();

  switch (mode) {
    case 'oldest':
      return copy;
    case 'amount-desc':
      return copy.sort(function (a, b) { return b.amount - a.amount; });
    case 'amount-asc':
      return copy.sort(function (a, b) { return a.amount - b.amount; });
    case 'category':
      return copy.sort(function (a, b) {
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      });
    case 'newest':
    default:
      return copy.reverse();
  }
}

// ─── Spending Limit (Optional Challenge) ──────────────────────────────────────

/**
 * Reads the saved spending limit from localStorage.
 * @returns {number|null}
 */
function loadLimit() {
  try {
    const raw = localStorage.getItem(LIMIT_KEY);
    if (raw === null) return null;
    const value = parseFloat(raw);
    return !isNaN(value) && value > 0 ? value : null;
  } catch (err) {
    return null;
  }
}

/**
 * Persists the spending limit (or removes it when null).
 * @param {number|null} limit
 */
function saveLimit(limit) {
  try {
    if (limit === null) {
      localStorage.removeItem(LIMIT_KEY);
    } else {
      localStorage.setItem(LIMIT_KEY, String(limit));
    }
  } catch (err) {
    showStorageBanner();
  }
}

/**
 * Sets a new spending limit from user input. Empty, zero, or invalid
 * values remove the limit.
 * @param {string|number} value
 */
function setLimit(value) {
  const parsed = parseFloat(value);
  spendingLimit = !isNaN(parsed) && parsed > 0 ? parsed : null;
  saveLimit(spendingLimit);
  render();
}

/**
 * Highlights the balance and shows a warning when total spending
 * exceeds the spending limit.
 * @param {Array<{amount: number}>} transactions
 */
function renderLimit(transactions) {
  const total     = transactions.reduce(function (acc, t) { return acc + t.amount; }, 0);
  const balanceEl = document.getElementById('balance');
  const warningEl = document.getElementById('limit-warning');
  const statusEl  = document.getElementById('limit-status');
  const inputEl   = document.getElementById('limit-input');

  const isOver = spendingLimit !== null && total > spendingLimit;

  if (balanceEl) {
    balanceEl.classList.toggle('over-limit', isOver);
  }

  if (warningEl) {
    if (isOver) {
      warningEl.textContent = '⚠️ Over limit by ' + formatCurrency(total - spendingLimit) +
        ' (limit ' + formatCurrency(spendingLimit) + ')';
      warningEl.classList.remove('hidden');
    } else {
      warningEl.textContent = '';
      warningEl.classList.add('hidden');
    }
  }

  if (statusEl) {
    if (spendingLimit === null) {
      statusEl.textContent = 'No limit set. Leave empty or 0 to remove the limit.';
    } else {
      const remaining = spendingLimit - total;
      statusEl.textContent = 'Limit: ' + formatCurrency(spendingLimit) + ' — ' +
        (remaining >= 0
          ? formatCurrency(remaining) + ' remaining.'
          : formatCurrency(-remaining) + ' over the limit.');
    }
  }

  if (inputEl && document.activeElement !== inputEl) {
    inputEl.value = spendingLimit === null ? '' : String(spendingLimit);
  }
}

// ─── Dark / Light Mode (Optional Challenge) ───────────────────────────────────

/**
 * Returns true when the dark theme is active.
 * @returns {boolean}
 */
function isDarkMode() {
  return typeof document !== 'undefined' && document.body.classList.contains('dark');
}

/**
 * Reads the saved theme, falling back to the operating system preference.
 * @returns {'dark'|'light'}
 */
function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (err) {
    // ignore and fall back to system preference
  }
  if (typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Applies the given theme to the page, the toggle button, and the chart.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark', dark);

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = dark ? '☀️ Light' : '🌙 Dark';
    toggleBtn.setAttribute('aria-pressed', String(dark));
  }

  if (chartInstance) {
    chartInstance.options.plugins.legend.labels.color = dark ? '#e4e6eb' : '#1a1a2e';
    chartInstance.data.datasets[0].borderColor = dark ? '#1f2940' : '#ffffff';
    chartInstance.update();
  }
}

/**
 * Switches between dark and light mode and remembers the choice.
 */
function toggleTheme() {
  const next = isDarkMode() ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (err) {
    showStorageBanner();
  }
}

// ─── Pie Chart ────────────────────────────────────────────────────────────────

/** @type {import('chart.js').Chart|null} */
let chartInstance = null;

/**
 * Groups transactions by category, sums amounts per group, and returns the
 * arrays needed to feed a Chart.js Pie chart.
 * Returns empty arrays when no transactions exist.
 * @param {Array<{amount: number, category: string}>} transactions
 * @returns {{ labels: string[], data: number[], colors: string[] }}
 */
function buildChartData(transactions) {
  if (!transactions || transactions.length === 0) {
    return { labels: [], data: [], colors: [] };
  }

  /** @type {Record<string, number>} */
  const totals = {};

  transactions.forEach(function (t) {
    if (totals[t.category] === undefined) {
      totals[t.category] = 0;
    }
    totals[t.category] += t.amount;
  });

  const labels = Object.keys(totals);
  const data   = labels.map(function (label) { return totals[label]; });
  const colors = labels.map(function (label) { return CATEGORY_COLORS[label] || '#999999'; });

  return { labels: labels, data: data, colors: colors };
}

/**
 * Creates a Chart.js Pie instance on first call (stored in `chartInstance`).
 * On subsequent calls, updates the existing instance in-place to avoid flickering.
 * Gracefully handles Chart.js CDN unavailability — canvas stays blank and the
 * failure is reported via window.onerror.
 * Shows an empty/placeholder state when `transactions` is empty.
 * @param {Array<{amount: number, category: string}>} transactions
 */
function renderChart(transactions) {
  // Placeholder text when there is nothing to chart
  const emptyEl = document.getElementById('chart-empty');
  if (emptyEl) {
    emptyEl.classList.toggle('hidden', transactions.length > 0);
  }

  // Guard: Chart.js may not be available if the CDN failed to load
  if (typeof window === 'undefined' || typeof window.Chart === 'undefined') {
    if (typeof window !== 'undefined' && typeof window.onerror === 'function') {
      window.onerror('Chart.js is not available. The spending chart cannot be rendered.', '', 0, 0, new Error('Chart.js unavailable'));
    }
    return;
  }

  const canvas = document.getElementById('spending-chart');
  if (!canvas) return;

  const { labels, data, colors } = buildChartData(transactions);

  if (chartInstance === null) {
    // First call: create the Chart.js instance
    const ctx = canvas.getContext('2d');
    chartInstance = new window.Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: isDarkMode() ? '#1f2940' : '#ffffff',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDarkMode() ? '#e4e6eb' : '#1a1a2e',
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.label + ': ' + formatCurrency(context.parsed);
              },
            },
          },
        },
      },
    });
  } else {
    // Subsequent calls: update in-place to avoid flickering
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  }
}

// ─── Render Orchestrator ──────────────────────────────────────────────────────

/**
 * Full re-render from the current in-memory transactions array.
 * Called after every state mutation (add / delete / load).
 */
function render() {
  renderList(sortTransactions(transactions, currentSort));
  renderBalance(transactions);
  renderLimit(transactions);
  renderChart(transactions);
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(loadTheme());
    spendingLimit = loadLimit();
    transactions  = loadFromStorage();
    render();

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }

    const sortEl = document.getElementById('sort-select');
    if (sortEl) {
      sortEl.addEventListener('change', function () {
        currentSort = sortEl.value;
        render();
      });
    }

    const limitForm = document.getElementById('limit-form');
    if (limitForm) {
      limitForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const limitInput = document.getElementById('limit-input');
        setLimit(limitInput ? limitInput.value : '');
        if (limitInput) limitInput.blur();
      });
    }

    const form = document.getElementById('expense-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        addTransaction();
      });
    }

    const listEl = document.getElementById('transaction-list');
    if (listEl) {
      listEl.addEventListener('click', function (event) {
        const id = event.target.dataset.id;
        if (id) {
          deleteTransaction(id);
        }
      });
    }
  });
}

// Export for testing (Node.js / Jest environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    saveToStorage,
    loadFromStorage,
    validateForm,
    showFormError,
    hideFormError,
    resetForm,
    addTransaction,
    formatCurrency,
    renderBalance,
    renderList,
    deleteTransaction,
    render,
    buildChartData,
    renderChart,
    sortTransactions,
    setLimit,
    renderLimit,
    STORAGE_KEY,
    VALID_CATEGORIES,
    CATEGORY_COLORS,
  };
}
