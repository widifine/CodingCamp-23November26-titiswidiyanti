# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that helps users track personal expenses and visualize spending patterns. Users can add transactions with a name, amount, and category; view a scrollable transaction list; monitor a live total balance; and see a pie chart that breaks down spending by category. All data is stored in the browser's Local Storage — no backend or server is required. The application is built with HTML, CSS, and Vanilla JavaScript only, and must run correctly in Chrome, Firefox, Edge, and Safari.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense record consisting of an item name, a monetary amount, and a category.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Input_Form**: The form component through which a user enters and submits a new transaction.
- **Balance_Display**: The UI element at the top of the page that shows the computed total of all transaction amounts.
- **Pie_Chart**: The visual chart component that shows spending distribution across categories.
- **Local_Storage**: The browser's Web Storage API used to persist transaction data client-side.
- **Category**: One of three fixed labels — Food, Transport, or Fun — that classifies a transaction.
- **Chart_Library**: A JavaScript charting library (such as Chart.js) used to render the Pie_Chart.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in an item name, amount, and category and submit the form, so that I can record a new expense transaction quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name, a numeric field for the amount, and a dropdown selector containing the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled, THE App SHALL add a new Transaction to the Transaction_List and persist it to Local_Storage.
3. IF the user submits the Input_Form with one or more empty fields, THEN THE Input_Form SHALL display a validation error message indicating which fields are required and SHALL NOT create a Transaction.
4. IF the user submits the Input_Form with an amount that is not a positive number, THEN THE Input_Form SHALL display a validation error message and SHALL NOT create a Transaction.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty state.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction's item name, amount, and category.
2. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible viewport area.
3. THE App SHALL load all Transactions stored in Local_Storage and render them in the Transaction_List on page load.
4. WHEN a new Transaction is added, THE Transaction_List SHALL update immediately to include the new entry without requiring a page reload.
5. THE Transaction_List SHALL display each Transaction with a delete control.

---

### Requirement 3: Delete Transaction

**User Story:** As a user, I want to remove a transaction from the list, so that I can correct mistakes or clean up my expense history.

#### Acceptance Criteria

1. WHEN the user activates the delete control for a Transaction, THE App SHALL remove that Transaction from the Transaction_List.
2. WHEN a Transaction is deleted, THE App SHALL remove it from Local_Storage so it does not reappear on page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update immediately to reflect the new total.
4. WHEN a Transaction is deleted, THE Pie_Chart SHALL update immediately to reflect the new category distribution.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total spending at a glance, so that I can monitor how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL be positioned at the top of the page and SHALL show the sum of all Transaction amounts.
2. WHEN a Transaction is added, THE Balance_Display SHALL update automatically to reflect the new total without requiring a page reload.
3. WHEN all Transactions are deleted, THE Balance_Display SHALL show a value of zero.
4. THE Balance_Display SHALL format amounts with a currency symbol and two decimal places.

---

### Requirement 5: Spending Distribution Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money goes at a glance.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display one segment per Category that has at least one Transaction, sized proportionally to the total amount for that Category.
2. WHEN a Transaction is added, THE Pie_Chart SHALL update automatically to reflect the new category totals without requiring a page reload.
3. WHEN a Transaction is deleted, THE Pie_Chart SHALL update automatically to reflect the revised category totals without requiring a page reload.
4. THE Pie_Chart SHALL render using Chart_Library and SHALL be contained within the single JavaScript file in the js/ directory.
5. WHEN no Transactions exist, THE Pie_Chart SHALL display an empty or placeholder state rather than an error.

---

### Requirement 6: Local Storage Persistence

**User Story:** As a user, I want my transaction data to be saved between sessions, so that I do not lose my expense history when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE App SHALL write the updated Transaction dataset to Local_Storage before the operation completes.
2. WHEN a Transaction is deleted, THE App SHALL write the updated Transaction dataset to Local_Storage before the operation completes.
3. WHEN the App initialises, THE App SHALL read all Transactions from Local_Storage and populate the Transaction_List, Balance_Display, and Pie_Chart with the stored data.
4. IF Local_Storage is unavailable or returns a parse error on initialisation, THEN THE App SHALL start with an empty Transaction dataset and SHALL display a non-blocking notice to the user.

---

### Requirement 7: File and Code Structure

**User Story:** As a developer, I want the project to follow a strict single-file-per-type structure, so that the codebase stays clean and maintainable.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located in the css/ directory.
2. THE App SHALL contain exactly one JavaScript file located in the js/ directory.
3. THE App SHALL contain one HTML entry-point file at the project root that links the single CSS file and the single JavaScript file.
4. THE App SHALL not require a backend server, build tool, or package manager to run.

---

### Requirement 8: Browser Compatibility and Performance

**User Story:** As a user, I want the app to load fast and respond without lag in any modern browser, so that the experience feels smooth on any device I use.

#### Acceptance Criteria

1. THE App SHALL function correctly in the latest stable releases of Chrome, Firefox, Edge, and Safari without polyfills or browser-specific workarounds.
2. WHEN the page is loaded, THE App SHALL render the initial UI within 2 seconds on a standard broadband connection.
3. WHEN the user adds or deletes a Transaction, THE App SHALL update the Balance_Display, Transaction_List, and Pie_Chart within 100 milliseconds.
4. THE App SHALL present a clean and minimal interface with clear visual hierarchy and readable typography, requiring no configuration or setup steps from the user.
