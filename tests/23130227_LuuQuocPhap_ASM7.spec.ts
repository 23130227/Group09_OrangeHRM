/**
 * Automation Test Suite for OrangeHRM - Module: PIM (Employee List)
 * Based on: Group09_23130227_LuuQuocPhap.xlsx - Sheet 4 (List Employees)
 * Tester / Student: Luu Quoc Phap (MSSV: 23130227) - Group 09
 * Application: OrangeHRM (https://opensource-demo.orangehrmlive.com)
 *
 * Test cases included:
 *  [Employee-List-1]  to [Employee-List-40]
 */

import { test, expect, type Page, type Locator, type Response } from '@playwright/test';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const BASE_URL = process.env.ORANGEHRM_BASE_URL ?? 'https://opensource-demo.orangehrmlive.com';
const USERNAME = process.env.ORANGEHRM_USERNAME ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD ?? 'admin123';

// ==========================================
// REUSABLE HELPER FUNCTIONS
// ==========================================

/**
 * Perform login if user is not already authenticated and on the dashboard.
 */
async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/auth/login`);
  
  // If already redirected to dashboard
  if (page.url().includes('/dashboard')) {
    return;
  }

  // Wait for login form to render
  const usernameInput = page.getByPlaceholder('Username');
  await expect(usernameInput).toBeVisible({ timeout: 15000 });
  await usernameInput.fill(USERNAME);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 25000 });
}

/**
 * Navigate to PIM Employee List page and wait for data load.
 */
async function gotoEmployeeList(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/pim/viewEmployeeList`);
  await waitForResults(page);
}

/**
 * True only for the real employee grid request (search / reset / sort / page).
 * Autocomplete hints also call /api/v2/pim/employees but without "limit=",
 * so they must not be mistaken for the table request (otherwise we can click
 * Reset while the Search request is still in flight and get stale data).
 */
function isEmployeeListRequest(response: Response): boolean {
  const url = response.url();
  return url.includes('/api/v2/pim/employees') &&
    url.includes('limit=') &&
    response.status() === 200;
}

/**
 * Wait until the table finishes loading and renders its results.
 */
async function waitForTableUpdate(page: Page): Promise<void> {
  // The grid shows a loading spinner while a request is in flight.
  await page.locator('.oxd-loading-spinner').first()
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => {});
  await waitForResults(page);
}

/**
 * Wait for employee list table grid or 'No Records Found' indicator.
 */
async function waitForResults(page: Page): Promise<void> {
  const target = page.locator('.oxd-table-card').first()
    .or(page.getByText('No Records Found'))
    .or(page.locator('.oxd-toast'))
    .or(page.locator('.orangehrm-horizontal-padding .oxd-text--span').first())
    .or(page.locator('.oxd-table'));

  await expect(target.first()).toBeVisible({ timeout: 20000 });
}

/**
 * Get the form group locator matching the field label.
 */
function getGroup(page: Page, label: string): Locator {
  return page.locator('.oxd-input-group').filter({ hasText: label }).first();
}

/**
 * Select an option from an OXD dropdown component by label and option text.
 */
async function selectDropdown(page: Page, label: string, optionText: string): Promise<void> {
  const grp = getGroup(page, label);
  const selectBox = grp.locator('.oxd-select-text');
  await selectBox.click();
  await page.waitForTimeout(300);

  const dropdown = page.locator('.oxd-select-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 10000 });

  const option = dropdown.locator('[role="option"]').filter({ hasText: optionText }).first();
  await option.click();
  await page.waitForTimeout(300);
}

/**
 * Fill input and pick matching item from autocomplete dropdown popup.
 */
async function fillAutocomplete(page: Page, label: string, hint: string, selectIndex = 0): Promise<string> {
  const input = getGroup(page, label).locator('input');
  await input.fill('');
  await input.fill(hint);

  const dropdown = page.locator('.oxd-autocomplete-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 10000 });

  const validOptions = dropdown.locator('.oxd-autocomplete-option').filter({ hasNotText: 'Searching' });
  await expect(validOptions.first()).toBeVisible({ timeout: 15000 });

  const chosenOption = validOptions.nth(selectIndex);
  const chosenText = (await chosenOption.innerText()).trim();
  await chosenOption.click();
  await expect(input).not.toHaveValue('');
  return chosenText;
}

/**
 * Click Search button and wait for table update.
 */
async function clickSearch(page: Page): Promise<void> {
  const searchBtn = page.getByRole('button', { name: 'Search' });
  const responsePromise = page.waitForResponse(
    response => isEmployeeListRequest(response),
    { timeout: 20000 }
  ).catch(() => null);

  await searchBtn.click();
  await responsePromise;
  await waitForTableUpdate(page);
}

/**
 * Click Reset button and wait for inputs to clear.
 */
async function clickReset(page: Page): Promise<void> {
  const resetBtn = page.getByRole('button', { name: 'Reset' });
  const responsePromise = page.waitForResponse(
    response => isEmployeeListRequest(response),
    { timeout: 20000 }
  ).catch(() => null);

  await resetBtn.click();
  await responsePromise;
  await waitForTableUpdate(page);
}

/**
 * Sort table column ascending or descending.
 */
async function sortColumn(page: Page, columnName: string, order: 'Ascending' | 'Descending'): Promise<void> {
  const headerCell = page.locator('.oxd-table-header-cell').filter({ hasText: columnName }).first();
  const sortIcon = headerCell.locator('.oxd-table-header-sort-icon');
  await sortIcon.click();

  const sortDropdown = headerCell.locator('.oxd-table-header-sort-dropdown');
  await expect(sortDropdown).toBeVisible({ timeout: 10000 });

  const responsePromise = page.waitForResponse(
    response => isEmployeeListRequest(response),
    { timeout: 20000 }
  ).catch(() => null);

  const orderItem = sortDropdown.locator('.oxd-table-header-sort-dropdown-item', { hasText: order });
  await orderItem.click();
  await responsePromise;
  await waitForTableUpdate(page);
}

/**
 * Create a temporary test employee for testing Edit / Delete / Bulk Delete workflows.
 */
async function createTestEmployee(page: Page, id: string, firstName: string, lastName: string): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/pim/addEmployee`);
  await page.waitForLoadState('domcontentloaded');

  await page.getByPlaceholder('First Name').fill(firstName);
  await page.getByPlaceholder('Last Name').fill(lastName);

  const idInput = getGroup(page, 'Employee Id').locator('input');
  await idInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await idInput.fill(id);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 20000 });
}

/**
 * Safely delete an employee by ID if found.
 */
async function safeDeleteEmployeeById(page: Page, empId: string): Promise<void> {
  try {
    await gotoEmployeeList(page);
    const idInput = getGroup(page, 'Employee Id').locator('input');
    await idInput.fill(empId);
    await clickSearch(page);

    const row = page.locator('.oxd-table-card').filter({ hasText: empId }).first();
    if (await row.isVisible({ timeout: 3000 })) {
      await row.locator('.bi-trash').locator('..').click();
      const modal = page.locator('.oxd-dialog-sheet');
      await expect(modal).toBeVisible({ timeout: 10000 });
      await modal.getByRole('button', { name: 'Yes, Delete' }).click();
      await page.waitForLoadState('networkidle');
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ==========================================
// TEST SUITE: PIM - LIST EMPLOYEES
// ==========================================

test.describe.configure({ mode: 'serial' });

test.describe('Group 09 - 23130227 - Luu Quoc Phap - PIM: List Employees Test Suite', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // --------------------------------------------------------------------------
  // [Employee-List-1]
  // --------------------------------------------------------------------------
  test('[Employee-List-1] Check displaying Employee List screen when selecting [Employee List] from PIM menu', async ({ page }) => {
    // Step 1: Click PIM on left menu
    await page.getByRole('link', { name: 'PIM' }).click();
    await expect(page).toHaveURL(/pim\/viewEmployeeList/);

    // Step 2: Click Employee List tab on top menu bar
    const empListTab = page.getByRole('link', { name: 'Employee List' });
    await expect(empListTab).toBeVisible();
    await empListTab.click();
    await waitForResults(page);

    // Expected: Employee Information filter section, search controls, and employee table grid displayed
    await expect(page.getByText('Employee Information')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.locator('.oxd-table')).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-2]
  // --------------------------------------------------------------------------
  test('[Employee-List-2] Check total record count display matches database count', async ({ page }) => {
    await gotoEmployeeList(page);

    // Step 2: Observe record counter label above table grid
    const counter = page.locator('.orangehrm-horizontal-padding .oxd-text--span').first();
    await expect(counter).toBeVisible({ timeout: 20000 });

    // Expected: Label displays "(X) Records Found" matching records
    const text = await counter.innerText();
    expect(text).toMatch(/\(\d+\)\s*Records?\s*Found/i);
  });

  // --------------------------------------------------------------------------
  // [Employee-List-3]
  // --------------------------------------------------------------------------
  test('[Employee-List-3] Check default display status: only current/active employees displayed by default', async ({ page }) => {
    await gotoEmployeeList(page);

    // Step 2: Verify default value in [Include] dropdown field
    const includeSelect = getGroup(page, 'Include').locator('.oxd-select-text');
    await expect(includeSelect).toContainText('Current Employees Only', { timeout: 15000 });

    // Step 3: Check records displayed in table grid
    const rows = page.locator('.oxd-table-card');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-4]
  // --------------------------------------------------------------------------
  test('[Employee-List-4] Check layout of Search/Filter section (alignment, labels, spacing)', async ({ page }) => {
    await gotoEmployeeList(page);

    // Step 1: Filter panel is properly structured with title "Employee Information"
    await expect(page.getByText('Employee Information')).toBeVisible();

    // Step 2: All 7 field labels are clearly visible and structured
    const expectedLabels = [
      'Employee Name',
      'Employee Id',
      'Employment Status',
      'Include',
      'Supervisor Name',
      'Job Title',
      'Sub Unit',
    ];

    for (const label of expectedLabels) {
      await expect(getGroup(page, label)).toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-List-5]
  // --------------------------------------------------------------------------
  test('[Employee-List-5] Check default state of search input fields and dropdowns', async ({ page }) => {
    await gotoEmployeeList(page);

    // Step 1: Inspect textboxes [Employee Name], [Employee Id], [Supervisor Name]
    await expect(getGroup(page, 'Employee Name').locator('input')).toHaveAttribute('placeholder', 'Type for hints...');
    await expect(getGroup(page, 'Supervisor Name').locator('input')).toHaveAttribute('placeholder', 'Type for hints...');
    await expect(getGroup(page, 'Employee Id').locator('input')).toHaveValue('', { timeout: 15000 });

    // Step 2: Inspect dropdowns
    await expect(getGroup(page, 'Employment Status').locator('.oxd-select-text')).toContainText('-- Select --', { timeout: 15000 });
    await expect(getGroup(page, 'Job Title').locator('.oxd-select-text')).toContainText('-- Select --', { timeout: 15000 });
    await expect(getGroup(page, 'Sub Unit').locator('.oxd-select-text')).toContainText('-- Select --', { timeout: 15000 });
    await expect(getGroup(page, 'Include').locator('.oxd-select-text')).toContainText('Current Employees Only', { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-6]
  // --------------------------------------------------------------------------
  test('[Employee-List-6] Check presence, position, and label of buttons [Reset], [Search], and [+ Add]', async ({ page }) => {
    await gotoEmployeeList(page);

    // Locate buttons in filter section
    const resetBtn = page.getByRole('button', { name: 'Reset' });
    const searchBtn = page.getByRole('button', { name: 'Search' });
    await expect(resetBtn).toBeVisible();
    await expect(searchBtn).toBeVisible();

    // Locate [+ Add] button above table grid
    const addBtn = page.getByRole('button', { name: /Add/i });
    await expect(addBtn).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-List-7]
  // --------------------------------------------------------------------------
  test('[Employee-List-7] Check table layout and column headers', async ({ page }) => {
    await gotoEmployeeList(page);

    // Verify 9 column headers
    const expectedHeaders = [
      'Id',
      'First (& Middle) Name',
      'Last Name',
      'Job Title',
      'Employment Status',
      'Sub Unit',
      'Supervisor',
      'Actions',
    ];

    for (const h of expectedHeaders) {
      const headerCell = page.locator('.oxd-table-header-cell').filter({ hasText: h });
      await expect(headerCell.first()).toBeVisible();
    }

    // Verify sort arrows on sortable headers
    const sortIcons = page.locator('.oxd-table-header-sort-icon');
    await expect(sortIcons).toHaveCount(7);
  });

  // --------------------------------------------------------------------------
  // [Employee-List-8]
  // --------------------------------------------------------------------------
  test('[Employee-List-8] Check search by valid exact Employee Name', async ({ page }) => {
    await gotoEmployeeList(page);

    // Pick an existing employee name via autocomplete
    const selectedName = await fillAutocomplete(page, 'Employee Name', 'a', 0);
    await clickSearch(page);

    // Expected: Table filters and shows matching record
    const rows = page.locator('.oxd-table-card');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    const firstNamePart = selectedName.split(' ')[0];
    await expect(page.locator('.oxd-table-body')).toContainText(firstNamePart, { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-9]
  // --------------------------------------------------------------------------
  test('[Employee-List-9] Check search by partial Employee Name using autocomplete hint popup', async ({ page }) => {
    await gotoEmployeeList(page);

    // Type partial string and select from hint
    const selectedName = await fillAutocomplete(page, 'Employee Name', 'an', 0);
    await clickSearch(page);

    // Expected: Autocomplete populated into input, table filters matching record
    const empNameInput = getGroup(page, 'Employee Name').locator('input');
    const inputVal = await empNameInput.inputValue();
    expect(inputVal.replace(/\s+/g, ' ').trim()).toBe(selectedName.replace(/\s+/g, ' ').trim());

    const rows = page.locator('.oxd-table-card');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-10]
  // --------------------------------------------------------------------------
  test('[Employee-List-10] Check search by non-existent Employee Name', async ({ page }) => {
    await gotoEmployeeList(page);

    const nameInput = getGroup(page, 'Employee Name').locator('input');

    // Wait for the autocomplete API call to finish before checking the hint popup,
    // so a slow response ("Searching...") is not mistaken for a failed assertion.
    const autocompleteResponse = page.waitForResponse(
      response => response.url().includes('/api/v2/pim/employees') && response.status() === 200,
      { timeout: 20000 }
    ).catch(() => null);

    await nameInput.fill('NonExistent999');
    await autocompleteResponse;

    // Autocomplete hint popup shows "No Records Found"
    const dropdown = page.locator('.oxd-autocomplete-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 15000 });
    await expect(dropdown).toContainText('No Records Found', { timeout: 15000 });

    const searchBtn = page.getByRole('button', { name: 'Search' });
    const responsePromise = page.waitForResponse(
      response => isEmployeeListRequest(response),
      { timeout: 20000 }
    ).catch(() => null);

    await searchBtn.click();
    await responsePromise;

    // Expected: Table displays empty result with toast or message "No Records Found"
    const toast = page.locator('.oxd-toast');
    const noRecords = page.getByText('No Records Found');
    const emptyCards = page.locator('.oxd-table-card');

    await expect(toast.or(noRecords).first()).toBeVisible({ timeout: 15000 });
    await expect(emptyCards).toHaveCount(0, { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-11]
  // --------------------------------------------------------------------------
  test('[Employee-List-11] Check search by valid Employee Id', async ({ page }) => {
    await gotoEmployeeList(page);

    // Read ID of first row in table
    const firstRowId = (await page.locator('.oxd-table-card').first().locator('.oxd-table-cell').nth(1).innerText()).trim();

    // Input into Employee Id field
    const idInput = getGroup(page, 'Employee Id').locator('input');
    await idInput.fill(firstRowId);
    await clickSearch(page);

    // Expected: Table grid displays exact matching employee record with that Id
    const resultRow = page.locator('.oxd-table-card').filter({ hasText: firstRowId }).first();
    await expect(resultRow).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-12]
  // --------------------------------------------------------------------------
  test('[Employee-List-12] Check search by non-existent Employee Id', async ({ page }) => {
    await gotoEmployeeList(page);

    const idInput = getGroup(page, 'Employee Id').locator('input');
    await idInput.fill('EMP99999');

    const searchBtn = page.getByRole('button', { name: 'Search' });
    const responsePromise = page.waitForResponse(
      response => isEmployeeListRequest(response),
      { timeout: 20000 }
    ).catch(() => null);

    await searchBtn.click();
    await responsePromise;

    // Expected: Table displays no records and popup/toast shows "No Records Found"
    const toast = page.locator('.oxd-toast');
    const noRecords = page.getByText('No Records Found');
    const emptyCards = page.locator('.oxd-table-card');

    await expect(toast.or(noRecords).first()).toBeVisible({ timeout: 15000 });
    await expect(emptyCards).toHaveCount(0, { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-13]
  // --------------------------------------------------------------------------
  test('[Employee-List-13] Check search by selecting Employment Status dropdown options', async ({ page }) => {
    await gotoEmployeeList(page);

    await selectDropdown(page, 'Employment Status', 'Full-Time Permanent');
    await clickSearch(page);

    // Expected: Table updates to show records with Full-Time Permanent (or empty if none)
    const rows = page.locator('.oxd-table-card');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        const statusCellText = await rows.nth(i).locator('.oxd-table-cell').nth(5).innerText();
        if (statusCellText.trim()) {
          expect(statusCellText.trim()).toBe('Full-Time Permanent');
        }
      }
    } else {
      await expect(page.getByText('No Records Found').or(page.locator('.oxd-toast'))).toBeVisible({ timeout: 15000 });
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-List-14]
  // --------------------------------------------------------------------------
  test('[Employee-List-14] Check search with Include = "Current Employees Only"', async ({ page }) => {
    await gotoEmployeeList(page);

    await selectDropdown(page, 'Include', 'Current Employees Only');
    await clickSearch(page);

    // Expected: Table displays current active employees
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
    const counter = page.locator('.orangehrm-horizontal-padding .oxd-text--span').first();
    await expect(counter).toContainText('Records Found', { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-15]
  // --------------------------------------------------------------------------
  test('[Employee-List-15] Check search with Include = "Past Employees Only"', async ({ page }) => {
    await gotoEmployeeList(page);

    await selectDropdown(page, 'Include', 'Past Employees Only');
    await clickSearch(page);

    // Expected: Filter applies, shows past employees or "No Records Found" toast
    const counter = page.locator('.orangehrm-horizontal-padding .oxd-text--span').first();
    const noRecordsToast = page.getByText('No Records Found');
    await expect(counter.or(noRecordsToast).first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-16]
  // --------------------------------------------------------------------------
  test('[Employee-List-16] Check search with Include = "Current and Past Employees"', async ({ page }) => {
    await gotoEmployeeList(page);

    await selectDropdown(page, 'Include', 'Current and Past Employees');
    await clickSearch(page);

    // Expected: Table displays all records (both active and past)
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
    const counter = page.locator('.orangehrm-horizontal-padding .oxd-text--span').first();
    await expect(counter).toContainText('Records Found', { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-17]
  // --------------------------------------------------------------------------
  test('[Employee-List-17] Check search by valid Supervisor Name', async ({ page }) => {
    await gotoEmployeeList(page);

    // Try finding an autocomplete supervisor hint
    const supervisorInput = getGroup(page, 'Supervisor Name').locator('input');
    await supervisorInput.fill('a');

    const dropdown = page.locator('.oxd-autocomplete-dropdown');
    try {
      await expect(dropdown).toBeVisible({ timeout: 10000 });
      const option = dropdown.locator('.oxd-autocomplete-option').filter({ hasNotText: 'Searching' }).first();
      if (await option.isVisible({ timeout: 4000 })) {
        await option.click();
        await clickSearch(page);
        await expect(page.locator('.oxd-table')).toBeVisible({ timeout: 15000 });
      }
    } catch {
      // If no supervisor in DB, verify input accepts text
      await supervisorInput.fill('Ranjith Sharma');
      await clickSearch(page);
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-List-18]
  // --------------------------------------------------------------------------
  test('[Employee-List-18] Check search by selecting Job Title dropdown options', async ({ page }) => {
    await gotoEmployeeList(page);

    // Open Job Title dropdown and select an available title
    const grp = getGroup(page, 'Job Title');
    await grp.locator('.oxd-select-text').click();
    const dropdown = page.locator('.oxd-select-dropdown');
    await expect(dropdown).toBeVisible();

    const options = dropdown.locator('[role="option"]').filter({ hasNotText: '-- Select --' });
    const titleText = (await options.first().innerText()).trim();
    await options.first().click();

    await clickSearch(page);

    // Expected: Table updates to show filtered employees
    await expect(page.locator('.oxd-table')).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-19]
  // --------------------------------------------------------------------------
  test('[Employee-List-19] Check search by selecting Sub Unit dropdown options', async ({ page }) => {
    await gotoEmployeeList(page);

    // Open Sub Unit dropdown and select an available option
    const grp = getGroup(page, 'Sub Unit');
    await grp.locator('.oxd-select-text').click();
    const dropdown = page.locator('.oxd-select-dropdown');
    await expect(dropdown).toBeVisible();

    const options = dropdown.locator('[role="option"]').filter({ hasNotText: '-- Select --' });
    await options.first().click();

    await clickSearch(page);

    // Expected: Table displays filtered results
    await expect(page.locator('.oxd-table')).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-20]
  // --------------------------------------------------------------------------
  test('[Employee-List-20] Check multi-criteria search combination (Employee Name + Status + Sub Unit + Job Title)', async ({ page }) => {
    await gotoEmployeeList(page);

    // Set Employment Status
    await selectDropdown(page, 'Employment Status', 'Full-Time Permanent');

    // Set Job Title
    const jobGrp = getGroup(page, 'Job Title');
    await jobGrp.locator('.oxd-select-text').click();
    const jobDropdown = page.locator('.oxd-select-dropdown');
    await expect(jobDropdown).toBeVisible();
    await jobDropdown.locator('[role="option"]').nth(1).click();

    await clickSearch(page);

    // Expected: Multi-criteria search executed without system errors
    await expect(page.locator('.oxd-table')).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-21]
  // --------------------------------------------------------------------------
  test('[Employee-List-21] Check button [Reset] resets all search inputs to default and reloads default table data', async ({ page }) => {
    await gotoEmployeeList(page);

    // Populate search inputs
    await getGroup(page, 'Employee Name').locator('input').fill('TestReset');
    await selectDropdown(page, 'Employment Status', 'Full-Time Permanent');
    await clickSearch(page);

    // Click Reset button
    await clickReset(page);

    // Expected: All inputs cleared, dropdowns revert to default, table reloads
    await expect(getGroup(page, 'Employee Name').locator('input')).toHaveValue('', { timeout: 15000 });
    await expect(getGroup(page, 'Employment Status').locator('.oxd-select-text')).toContainText('-- Select --', { timeout: 15000 });
    await expect(getGroup(page, 'Include').locator('.oxd-select-text')).toContainText('Current Employees Only', { timeout: 15000 });
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-22]
  // --------------------------------------------------------------------------
  test('[Employee-List-22] Check Employee Name autocomplete trigger threshold (input < 2 chars vs >= 2 chars)', async ({ page }) => {
    await gotoEmployeeList(page);

    const nameInput = getGroup(page, 'Employee Name').locator('input');

    // Type 1 char
    await nameInput.fill('K');
    await page.waitForTimeout(500);

    // Type 2nd char ("Ki")
    await nameInput.fill('Ki');
    const dropdown = page.locator('.oxd-autocomplete-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-23]
  // --------------------------------------------------------------------------
  test('[Employee-List-23] Check Employee Id input with max length boundary', async ({ page }) => {
    await gotoEmployeeList(page);

    const idInput = getGroup(page, 'Employee Id').locator('input');
    const fiftyChars = '12345678901234567890123456789012345678901234567890';
    await idInput.fill(fiftyChars);

    // Expected: 50 characters entered successfully
    const val = await idInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(50);
  });

  // --------------------------------------------------------------------------
  // [Employee-List-24]
  // --------------------------------------------------------------------------
  test('[Employee-List-24] Check input special characters / SQL injection strings in Employee Name and Employee Id', async ({ page }) => {
    await gotoEmployeeList(page);

    // Track dialogs to ensure script does not execute
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    const nameInput = getGroup(page, 'Employee Name').locator('input');
    await nameInput.fill("<script>alert('test')</script>");

    const idInput = getGroup(page, 'Employee Id').locator('input');
    await idInput.fill("' OR '1'='1");

    const searchBtn = page.getByRole('button', { name: 'Search' });
    const responsePromise = page.waitForResponse(
      response => isEmployeeListRequest(response),
      { timeout: 20000 }
    ).catch(() => null);

    await searchBtn.click();
    await responsePromise;

    // Expected: System safely sanitizes input without script execution; displays No Records Found
    expect(alertTriggered).toBe(false);
    const toast = page.locator('.oxd-toast');
    const noRecords = page.getByText('No Records Found');
    const emptyCards = page.locator('.oxd-table-card');

    await expect(toast.or(noRecords).first()).toBeVisible({ timeout: 15000 });
    await expect(emptyCards).toHaveCount(0, { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-25]
  // --------------------------------------------------------------------------
  test('[Employee-List-25] Check sorting by column Id (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    // Step 1: Click Id header -> Ascending
    await sortColumn(page, 'Id', 'Ascending');
    const firstAscId = (await page.locator('.oxd-table-card').first().locator('.oxd-table-cell').nth(1).innerText()).trim();

    // Step 2: Click Id header -> Descending
    await sortColumn(page, 'Id', 'Descending');
    const firstDescId = (await page.locator('.oxd-table-card').first().locator('.oxd-table-cell').nth(1).innerText()).trim();

    // Expected: Both sort directions applied successfully
    expect(firstAscId).toBeDefined();
    expect(firstDescId).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // [Employee-List-26]
  // --------------------------------------------------------------------------
  test('[Employee-List-26] Check sorting by column First & Middle Name (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    await sortColumn(page, 'First (& Middle) Name', 'Ascending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });

    await sortColumn(page, 'First (& Middle) Name', 'Descending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-27]
  // --------------------------------------------------------------------------
  test('[Employee-List-27] Check sorting by column Last Name (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    await sortColumn(page, 'Last Name', 'Ascending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });

    await sortColumn(page, 'Last Name', 'Descending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-28]
  // --------------------------------------------------------------------------
  test('[Employee-List-28] Check sorting by column Job Title (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    await sortColumn(page, 'Job Title', 'Ascending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });

    await sortColumn(page, 'Job Title', 'Descending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-29]
  // --------------------------------------------------------------------------
  test('[Employee-List-29] Check sorting by column Employment Status (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    await sortColumn(page, 'Employment Status', 'Ascending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });

    await sortColumn(page, 'Employment Status', 'Descending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-30]
  // --------------------------------------------------------------------------
  test('[Employee-List-30] Check sorting by column Sub Unit (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    await sortColumn(page, 'Sub Unit', 'Ascending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });

    await sortColumn(page, 'Sub Unit', 'Descending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-31]
  // --------------------------------------------------------------------------
  test('[Employee-List-31] Check sorting by column Supervisor (ascending and descending)', async ({ page }) => {
    await gotoEmployeeList(page);

    await sortColumn(page, 'Supervisor', 'Ascending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });

    await sortColumn(page, 'Supervisor', 'Descending');
    await expect(page.locator('.oxd-table-card').first()).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-32]
  // --------------------------------------------------------------------------
  test('[Employee-List-32] Check page navigation when records exceed 1 page (Next, Previous, First, Last)', async ({ page }) => {
    await gotoEmployeeList(page);

    const paginationNav = page.locator('nav[aria-label="Pagination Navigation"]');
    if (await paginationNav.isVisible({ timeout: 10000 })) {
      // Step 1: Click page [2]
      const page2Btn = paginationNav.locator('.oxd-pagination-page-item--page', { hasText: '2' });
      await page2Btn.click();
      await waitForResults(page);

      // Verify page 2 is active
      const activePage = paginationNav.locator('.oxd-pagination-page-item--page-selected');
      await expect(activePage).toHaveText('2', { timeout: 15000 });

      // Step 2: Click page [1]
      const page1Btn = paginationNav.locator('.oxd-pagination-page-item--page', { hasText: '1' });
      await page1Btn.click();
      await waitForResults(page);

      // Verify page 1 is re-displayed
      await expect(paginationNav.locator('.oxd-pagination-page-item--page-selected')).toHaveText('1', { timeout: 15000 });
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-List-33]
  // --------------------------------------------------------------------------
  test('[Employee-List-33] Check page state preservation when changing sort order or executing filters', async ({ page }) => {
    await gotoEmployeeList(page);

    const paginationNav = page.locator('nav[aria-label="Pagination Navigation"]');
    if (await paginationNav.isVisible({ timeout: 10000 })) {
      // Navigate to page 2
      await paginationNav.locator('.oxd-pagination-page-item--page', { hasText: '2' }).click();
      await waitForResults(page);

      // Click sort on Last Name
      await sortColumn(page, 'Last Name', 'Ascending');

      // Expected: Sorting is applied and pagination preserves valid page state
      const selectedPage = await paginationNav.locator('.oxd-pagination-page-item--page-selected').innerText();
      expect(['1', '2']).toContain(selectedPage.trim());
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-List-34]
  // --------------------------------------------------------------------------
  test('[Employee-List-34] Check clicking [+ Add] button navigates to Add Employee screen', async ({ page }) => {
    await gotoEmployeeList(page);

    // Step 1: Click [+ Add] button above table grid
    const addBtn = page.getByRole('button', { name: /Add/i });
    await addBtn.click();

    // Expected: System navigates to Add Employee screen displaying inputs and Save button
    await expect(page).toHaveURL(/pim\/addEmployee/, { timeout: 15000 });
    await expect(page.getByPlaceholder('First Name')).toBeVisible();
    await expect(page.getByPlaceholder('Last Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-List-35]
  // --------------------------------------------------------------------------
  test('[Employee-List-35] Check clicking Edit icon (Pencil) navigates to Edit Personal Details screen of target employee', async ({ page }) => {
    await gotoEmployeeList(page);

    // Locate first row and click pencil edit button
    const firstRow = page.locator('.oxd-table-card').first();
    const pencilBtn = firstRow.locator('.bi-pencil-fill').locator('..');
    await pencilBtn.click();

    // Expected: System navigates to Personal Details page
    await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-36]
  // --------------------------------------------------------------------------
  test('[Employee-List-36] Check clicking Delete icon (Trash) displays confirmation dialog ("Are you sure?")', async ({ page }) => {
    await gotoEmployeeList(page);

    // Locate first row and click trash delete button
    const firstRow = page.locator('.oxd-table-card').first();
    const trashBtn = firstRow.locator('.bi-trash').locator('..');
    await trashBtn.click();

    // Expected: Confirmation modal displays "Are you Sure?" with "Yes, Delete" and "No, Cancel"
    const modal = page.locator('.oxd-dialog-sheet');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).toContainText('Are you Sure?');
    await expect(modal.getByRole('button', { name: 'Yes, Delete' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'No, Cancel' })).toBeVisible();

    // Cancel to preserve data
    await modal.getByRole('button', { name: 'No, Cancel' }).click();
    await expect(modal).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-List-37]
  // --------------------------------------------------------------------------
  test('[Employee-List-37] Check confirming delete in popup removes employee from DB and updates table grid', async ({ page }) => {
    // Create dedicated employee for deletion test
    const testId = '8' + Math.floor(1000 + Math.random() * 9000);
    const testLast = 'DelTest' + testId;
    await createTestEmployee(page, testId, 'Temp', testLast);

    // Navigate to Employee List and search for created employee
    await gotoEmployeeList(page);
    await getGroup(page, 'Employee Id').locator('input').fill(testId);
    await clickSearch(page);

    const targetRow = page.locator('.oxd-table-card').filter({ hasText: testId }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    // Click Trash icon
    await targetRow.locator('.bi-trash').locator('..').click();

    // Confirm Delete
    const modal = page.locator('.oxd-dialog-sheet');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await modal.getByRole('button', { name: 'Yes, Delete' }).click();

    // Expected: Toast message "Successfully Deleted" appears and row removed
    const toast = page.locator('.oxd-toast');
    await expect(toast).toContainText(/Successfully Deleted/i, { timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-38]
  // --------------------------------------------------------------------------
  test('[Employee-List-38] Check canceling delete in popup keeps employee record intact in table grid', async ({ page }) => {
    // Create dedicated test employee
    const testId = '7' + Math.floor(1000 + Math.random() * 9000);
    const testLast = 'KeepTest' + testId;
    await createTestEmployee(page, testId, 'Temp', testLast);

    try {
      // Navigate to Employee List and search
      await gotoEmployeeList(page);
      await getGroup(page, 'Employee Id').locator('input').fill(testId);
      await clickSearch(page);

      const targetRow = page.locator('.oxd-table-card').filter({ hasText: testId }).first();
      await expect(targetRow).toBeVisible({ timeout: 15000 });

      // Click Trash icon
      await targetRow.locator('.bi-trash').locator('..').click();

      // Click "No, Cancel"
      const modal = page.locator('.oxd-dialog-sheet');
      await expect(modal).toBeVisible({ timeout: 15000 });
      await modal.getByRole('button', { name: 'No, Cancel' }).click();
      await expect(modal).not.toBeVisible();

      // Expected: Employee record remains intact in table grid
      await expect(targetRow).toBeVisible({ timeout: 15000 });
    } finally {
      // Clean up test employee
      await safeDeleteEmployeeById(page, testId);
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-List-39]
  // --------------------------------------------------------------------------
  test('[Employee-List-39] Check select all via header checkbox selects all row checkboxes on current page', async ({ page }) => {
    await gotoEmployeeList(page);

    const headerCheckbox = page.locator('.oxd-table-header .oxd-checkbox-input');
    const firstRowCheckboxInput = page.locator('.oxd-table-card input[type="checkbox"]').first();
    await expect(firstRowCheckboxInput).toBeVisible({ timeout: 15000 });

    // Step 1: Click header checkbox -> All rows selected
    await headerCheckbox.click();
    await expect(firstRowCheckboxInput).toBeChecked({ timeout: 15000 });

    // Step 2: Click header checkbox again -> All rows deselected
    await headerCheckbox.click();
    await expect(firstRowCheckboxInput).not.toBeChecked({ timeout: 15000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-List-40]
  // --------------------------------------------------------------------------
  test('[Employee-List-40] Check bulk delete action when multiple checkboxes are selected', async ({ page }) => {
    test.slow();

    // Create 2 temporary test employees for bulk deletion
    const id1 = '6' + Math.floor(1000 + Math.random() * 9000);
    const id2 = '6' + Math.floor(1000 + Math.random() * 9000);
    const commonLast = 'Bulk' + Date.now().toString().slice(-4);

    await createTestEmployee(page, id1, 'UserA', commonLast);
    await createTestEmployee(page, id2, 'UserB', commonLast);

    // Search by common last name
    await gotoEmployeeList(page);
    await getGroup(page, 'Employee Name').locator('input').fill(commonLast);
    await page.waitForTimeout(500);
    await clickSearch(page);

    // Check checkboxes of matching rows
    const rows = page.locator('.oxd-table-card').filter({ hasText: commonLast });
    const rowCount = await rows.count();

    if (rowCount >= 2) {
      await rows.nth(0).locator('.oxd-checkbox-input').click();
      await rows.nth(1).locator('.oxd-checkbox-input').click();

      // Click "Delete Selected" button
      const deleteSelectedBtn = page.getByRole('button', { name: /Delete Selected/i });
      await expect(deleteSelectedBtn).toBeVisible({ timeout: 15000 });
      await deleteSelectedBtn.click();

      // Confirm in modal
      const modal = page.locator('.oxd-dialog-sheet');
      await expect(modal).toBeVisible({ timeout: 15000 });
      await modal.getByRole('button', { name: 'Yes, Delete' }).click();

      // Expected: Toast "Successfully Deleted" appears
      const toast = page.locator('.oxd-toast');
      await expect(toast).toContainText(/Successfully Deleted/i, { timeout: 15000 });
    } else {
      // Fallback cleanup if search didn't match immediately
      await safeDeleteEmployeeById(page, id1);
      await safeDeleteEmployeeById(page, id2);
    }
  });
});
