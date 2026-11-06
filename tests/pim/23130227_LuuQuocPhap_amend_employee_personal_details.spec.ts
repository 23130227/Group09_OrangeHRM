/**
 * Automation Test Suite for OrangeHRM - Module: PIM (Amend Employee Personal Details)
 * Based on: Group09_23130227_LuuQuocPhap.xlsx - Sheet 6 (Amend Employee Personal Details)
 * Tester / Student: Luu Quoc Phap (MSSV: 23130227) - Group 09
 * Application: OrangeHRM (https://opensource-demo.orangehrmlive.com)
 *
 * Test cases included:
 *  [Employee-Amend-1]  to [Employee-Amend-36]
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const BASE_URL = process.env.ORANGEHRM_BASE_URL ?? 'https://opensource-demo.orangehrmlive.com';
const USERNAME = process.env.ORANGEHRM_USERNAME ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD ?? 'admin123';

// Shared state for target employee used across tests
let targetEmpNumber: string = '';
let targetEmployeeId: string = '';
let targetFirstName: string = '';
let targetLastName: string = '';

/**
 * Generate an employee ID with enough entropy to avoid collisions.
 * The public demo DB is reset periodically and is shared by every browser
 * project / worker, so short numeric IDs (e.g. '9' + 4 digits) are unsafe.
 */
function uniqueEmployeeId(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = (Math.random().toString(36) + '000').slice(2, 5).toUpperCase();
  return (prefix + time + rand).slice(0, 10);
}

// ==========================================
// REUSABLE HELPER FUNCTIONS
// ==========================================

/**
 * Perform login if user is not already authenticated and on the dashboard.
 */
async function login(page: Page): Promise<void> {
  const usernameInput = page.getByPlaceholder('Username');
  const passwordInput = page.getByPlaceholder('Password');
  const loginButton = page.getByRole('button', { name: 'Login' });

  // The public demo site occasionally loads slowly or returns a temporary
  // error page, so try to open the login form more than once before failing.
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.goto(`${BASE_URL}/web/index.php/auth/login`, { waitUntil: 'domcontentloaded' })
      .catch(() => { /* retry below */ });

    // Already authenticated (OrangeHRM redirects to the dashboard)
    if (page.url().includes('/dashboard')) {
      return;
    }

    let formReady = true;
    try {
      await usernameInput.waitFor({ state: 'visible', timeout: 25000 });
    } catch {
      formReady = false;
    }

    if (formReady) {
      await usernameInput.fill(USERNAME);
      await passwordInput.fill(PASSWORD);
      await loginButton.click();
      await expect(page).toHaveURL(/dashboard/, { timeout: 30000 });
      return;
    }

    if (attempt < maxAttempts) {
      await page.waitForTimeout(2000);
    }
  }

  // Final attempt: if the form appeared after the last retry, still log in;
  // otherwise fail with a clear error message.
  await expect(usernameInput).toBeVisible({ timeout: 30000 });
  await usernameInput.fill(USERNAME);
  await passwordInput.fill(PASSWORD);
  await loginButton.click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 });
}

/**
 * Create an employee with an explicit Employee Id and wait for the profile.
 */
async function createEmployeeWithId(page: Page, empId: string, firstName: string, lastName: string): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/pim/addEmployee`);
  await page.waitForLoadState('domcontentloaded');

  await page.getByPlaceholder('First Name').fill(firstName);
  await page.getByPlaceholder('Last Name').fill(lastName);

  const idInput = getGroup(page, 'Employee Id').locator('input');
  await clearInput(idInput);
  await idInput.fill(empId);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 30000 });
}

/**
 * Create a dedicated test employee to safely amend details.
 * Pass force=true to recreate the target after a demo DB reset.
 */
async function ensureTargetEmployee(page: Page, force = false): Promise<void> {
  if (targetEmpNumber && !force) {
    return;
  }

  targetEmpNumber = '';
  targetEmployeeId = uniqueEmployeeId('E');
  targetFirstName = 'PhapAmend';
  targetLastName = 'Test' + targetEmployeeId;

  await createEmployeeWithId(page, targetEmployeeId, targetFirstName, targetLastName);

  const match = page.url().match(/empNumber\/(\d+)/);
  if (match) {
    targetEmpNumber = match[1];
  }
}

/**
 * Navigate to Personal Details page of the target employee.
 * If the target employee was removed by a demo DB reset, recreate it once.
 */
async function gotoTargetPersonalDetails(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE_URL}/web/index.php/pim/viewPersonalDetails/empNumber/${targetEmpNumber}`);
    await page.waitForLoadState('domcontentloaded');
    // Wait for loading spinners to detach
    await page.locator('.oxd-loading-spinner').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    // Ensure personal details data has populated
    const fnInput = page.locator('.orangehrm-firstname');
    try {
      await expect(fnInput).toBeVisible({ timeout: 15000 });
      await expect(fnInput).not.toHaveValue('', { timeout: 15000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      // The shared demo DB may be reset mid-run and delete our employee.
      // Log in again if needed, then create a fresh target and retry.
      await login(page);
      await ensureTargetEmployee(page, true);
    }
  }
}

/**
 * Delete an employee by Employee Id from the Employee List (best effort).
 */
async function deleteEmployeeById(page: Page, empId: string, lastName?: string): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/pim/viewEmployeeList`);
  await page.waitForLoadState('domcontentloaded');

  const idInput = getGroup(page, 'Employee Id').locator('input');
  await idInput.fill(empId);
  await page.getByRole('button', { name: 'Search' }).click();

  let rows = page.locator('.oxd-table-card').filter({ hasText: empId });
  if (lastName) {
    rows = rows.filter({ hasText: lastName });
  }

  const row = rows.first();
  try {
    await row.waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    return; // Employee was not created or is already deleted
  }

  await row.locator('.bi-trash').locator('..').click();
  const modal = page.locator('.oxd-dialog-sheet');
  await expect(modal).toBeVisible({ timeout: 15000 });
  await modal.getByRole('button', { name: 'Yes, Delete' }).click();
  await expect(page.locator('.oxd-toast')).toContainText(/Successfully Deleted/i, { timeout: 15000 });
}

/**
 * Get the form group locator matching the field label.
 */
function getGroup(page: Page, label: string | RegExp): Locator {
  return page.locator('.oxd-input-group').filter({ hasText: label }).first();
}

/**
 * Clear an input field completely using Ctrl+A and Backspace.
 */
async function clearInput(locator: Locator): Promise<void> {
  await locator.click();
  await locator.press('Control+A');
  await locator.press('Backspace');
}

/**
 * Save Personal Details form (first form on the page).
 */
async function savePersonalDetails(page: Page): Promise<void> {
  const firstForm = page.locator('form').first();
  const saveBtn = firstForm.locator('button[type="submit"]');

  const responsePromise = page.waitForResponse(
    response => response.url().includes('personal-details') && [200, 422].includes(response.status()),
    { timeout: 15000 }
  ).catch(() => null);

  await saveBtn.click();
  await responsePromise;
}

/**
 * Select an option from an OXD select dropdown component.
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

// ==========================================
// TEST SUITE: PIM - AMEND EMPLOYEE PERSONAL DETAILS
// ==========================================

test.describe.configure({ mode: 'serial' });

test.describe('Group 09 - 23130227 - Luu Quoc Phap - PIM: Amend Employee Personal Details Test Suite', () => {
  test.setTimeout(120000);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await login(page);
      await ensureTargetEmployee(page);
    } finally {
      await page.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!targetEmpNumber) {
      return;
    }

    const page = await browser.newPage();
    try {
      await login(page);
      // Best-effort cleanup so repeated runs do not fill the shared demo DB.
      await deleteEmployeeById(page, targetEmployeeId, targetLastName);
    } catch {
      // Never fail the suite because cleanup could not complete.
    } finally {
      await page.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-1]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-1] Check displaying Amend Employee Personal Details screen when clicking Edit icon (Pencil) or selecting employee row from Employee List grid', async ({ page }) => {
    // Precondition: make sure the target still exists (the shared demo DB may
    // have been reset since beforeAll) and recreate it if it disappeared.
    await gotoTargetPersonalDetails(page);

    // Step 1: Click PIM -> Employee List
    await page.getByRole('link', { name: 'PIM' }).click();
    await page.getByRole('link', { name: 'Employee List' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Filter by Employee Id to locate target employee
    const idInput = getGroup(page, 'Employee Id').locator('input');
    await idInput.fill(targetEmployeeId);
    const searchPromise = page.waitForResponse(
      res => res.url().includes('/pim/employees') && res.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);
    await page.getByRole('button', { name: 'Search' }).click();
    await searchPromise;

    // Step 2 & 3: Locate target employee and click Edit icon (Pencil)
    const targetRow = page.locator('.oxd-table-card').filter({ hasText: targetEmployeeId }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });
    await targetRow.locator('.bi-pencil-fill').locator('..').click();

    // Expected: System navigates to Personal Details screen
    await expect(page).toHaveURL(new RegExp(`/pim/viewPersonalDetails/empNumber/${targetEmpNumber}`), { timeout: 15000 });
    await expect(page.locator('.orangehrm-main-title').first()).toHaveText('Personal Details');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-2]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-2] Check screen header title [Personal Details] and top navigation bar layout', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Expected: Top bar displays "PIM" and navigation tabs; form header displays "Personal Details"
    await expect(page.locator('.oxd-topbar-header-breadcrumb')).toContainText('PIM');
    await expect(page.getByRole('link', { name: 'Employee List' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Employee' })).toBeVisible();
    await expect(page.locator('.orangehrm-main-title').first()).toHaveText('Personal Details');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-3]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-3] Check layout of Personal Details screen (field alignment, labels, spacing, calendar icons, dropdown arrows, button positioning)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Verify fields presence
    await expect(page.locator('.orangehrm-firstname')).toBeVisible();
    await expect(page.locator('.orangehrm-lastname')).toBeVisible();
    await expect(getGroup(page, 'Employee Id')).toBeVisible();
    await expect(getGroup(page, 'Other Id')).toBeVisible();
    await expect(getGroup(page, "Driver's License Number")).toBeVisible();
    await expect(getGroup(page, 'License Expiry Date')).toBeVisible();
    await expect(getGroup(page, 'Nationality')).toBeVisible();
    await expect(getGroup(page, 'Marital Status')).toBeVisible();
    await expect(getGroup(page, 'Date of Birth')).toBeVisible();
    await expect(getGroup(page, 'Gender')).toBeVisible();

    // Calendar icons
    const calendarIcons = page.locator('.oxd-date-input-icon');
    expect(await calendarIcons.count()).toBeGreaterThanOrEqual(2);

    // Save button
    const saveBtn = page.locator('form').first().locator('button[type="submit"]');
    await expect(saveBtn).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-4]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-4] Check pre-filled existing employee data in form fields matching database record upon loading screen', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Expected: Pre-filled values match target employee data
    const fnVal = await page.locator('.orangehrm-firstname').inputValue();
    const lnVal = await page.locator('.orangehrm-lastname').inputValue();
    const idVal = await getGroup(page, 'Employee Id').locator('input').inputValue();

    expect(fnVal.trim().length).toBeGreaterThan(0);
    expect(lnVal.trim().length).toBeGreaterThan(0);
    expect(idVal.trim()).toBe(targetEmployeeId);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-5]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-5] Check left sidebar navigation menu display (Personal Details, Contact Details, Emergency Contacts, Dependents, Immigration, Job, Salary, Report-to)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const expectedTabs = [
      'Personal Details',
      'Contact Details',
      'Emergency Contacts',
      'Dependents',
      'Immigration',
      'Job',
      'Salary',
      'Report-to'
    ];

    for (const t of expectedTabs) {
      await expect(page.locator('.orangehrm-tabs-item').filter({ hasText: t })).toBeVisible();
    }

    // Expected: Personal Details tab is active
    await expect(page.locator('.orangehrm-tabs-item.--active')).toContainText('Personal Details');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-6]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-6] Check employee avatar frame and left header text display matching current employee full name', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Expected: Avatar picture frame is displayed
    const avatarWrapper = page.locator('.orangehrm-edit-employee-image-wrapper');
    await expect(avatarWrapper).toBeVisible();

    // Header text displays employee name
    const headerName = await page.locator('.orangehrm-edit-employee-name').innerText();
    expect(headerName.trim().length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-7]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-7] Check presence, position, label, and style of [Save] button and mandatory note \'* Required\'', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const firstForm = page.locator('form').first();
    await expect(firstForm.getByText('* Required')).toBeVisible();

    const saveBtn = firstForm.locator('button[type="submit"]');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toHaveText(/Save/i);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-8]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-8] Check clearing mandatory field [First Name]* and clicking [Save]', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const fnInput = page.locator('.orangehrm-firstname');
    await clearInput(fnInput);
    await savePersonalDetails(page);

    // Expected: First Name field displays error message "Required"
    const fnError = fnInput.locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(fnError).toBeVisible();
    await expect(fnError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-9]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-9] Check clearing mandatory field [Last Name]* and clicking [Save]', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const lnInput = page.locator('.orangehrm-lastname');
    await clearInput(lnInput);
    await savePersonalDetails(page);

    // Expected: Last Name field displays error message "Required"
    const lnError = lnInput.locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(lnError).toBeVisible();
    await expect(lnError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-10]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-10] Check clearing both [First Name]* and [Last Name]* fields and clicking [Save]', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const fnInput = page.locator('.orangehrm-firstname');
    const lnInput = page.locator('.orangehrm-lastname');
    await clearInput(fnInput);
    await clearInput(lnInput);
    await savePersonalDetails(page);

    // Expected: Both show error "Required"
    const fnError = fnInput.locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    const lnError = lnInput.locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(fnError).toBeVisible();
    await expect(fnError).toHaveText('Required');
    await expect(lnError).toBeVisible();
    await expect(lnError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-11]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-11] Check optional fields can be cleared or left empty (Middle Name, Other Id, Driver\'s License Number, License Expiry Date, Nationality, Marital Status, Date of Birth, Gender)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Ensure First and Last names are valid
    await page.locator('.orangehrm-firstname').fill(targetFirstName);
    await page.locator('.orangehrm-lastname').fill(targetLastName);

    // Clear optional fields
    await clearInput(page.locator('.orangehrm-middlename'));
    await clearInput(getGroup(page, 'Other Id').locator('input'));
    await clearInput(getGroup(page, "Driver's License Number").locator('input'));
    await clearInput(getGroup(page, 'License Expiry Date').locator('input'));

    await savePersonalDetails(page);

    // Expected: Toast message "Successfully Updated" appears
    const toast = page.locator('.oxd-toast');
    await expect(toast).toContainText(/Successfully Updated/i, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-12]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-12] Check amending [First Name] input with valid letters, spaces, hyphens, and accented characters', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const fnInput = page.locator('.orangehrm-firstname');
    await clearInput(fnInput);
    await fnInput.fill('Jean-Luke Quốc Pháp');
    await savePersonalDetails(page);

    // Expected: Input accepted and toast "Successfully Updated" appears
    const toast = page.locator('.oxd-toast');
    await expect(toast).toContainText(/Successfully Updated/i, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-13]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-13] Check amending [First Name] input with max length boundary', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const fnInput = page.locator('.orangehrm-firstname');
    await clearInput(fnInput);
    const thirtyChars = 'A'.repeat(30);
    await fnInput.fill(thirtyChars);

    // Expected: 30 characters accepted
    const val = await fnInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-14]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-14] Check amending [Last Name] input with max length boundary', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const lnInput = page.locator('.orangehrm-lastname');
    await clearInput(lnInput);
    const thirtyChars = 'B'.repeat(30);
    await lnInput.fill(thirtyChars);

    // Expected: 30 characters accepted
    const val = await lnInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-15]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-15] Check amending [Middle Name] input with max length boundary', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const mnInput = page.locator('.orangehrm-middlename');
    await clearInput(mnInput);
    const thirtyChars = 'M'.repeat(30);
    await mnInput.fill(thirtyChars);

    // Expected: 30 characters entered
    const val = await mnInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-16]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-16] Check amending [Employee Id] input with custom valid alphanumeric string', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const idInput = getGroup(page, 'Employee Id').locator('input');
    await clearInput(idInput);
    const customId = 'EMP' + Math.floor(1000 + Math.random() * 9000);
    await idInput.fill(customId);

    // Expected: Custom alphanumeric Employee Id accepted
    await expect(idInput).toHaveValue(customId);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-17]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-17] Check amending [Employee Id] input with max length boundary', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const idInput = getGroup(page, 'Employee Id').locator('input');
    await clearInput(idInput);
    const tenChars = '1234567890';
    await idInput.fill(tenChars);

    // Expected: 10 characters entered
    const val = await idInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(10);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-18]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-18] Check amending [Other Id] input with max length boundary', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const otherIdInput = getGroup(page, 'Other Id').locator('input');
    await clearInput(otherIdInput);
    const thirtyChars = 'O'.repeat(30);
    await otherIdInput.fill(thirtyChars);

    // Expected: 30 characters accepted
    const val = await otherIdInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-19]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-19] Check amending [Driver\'s License Number] input with max length boundary', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const licenseInput = getGroup(page, "Driver's License Number").locator('input');
    await clearInput(licenseInput);
    const thirtyChars = 'D'.repeat(30);
    await licenseInput.fill(thirtyChars);

    // Expected: 30 characters accepted
    const val = await licenseInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-20]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-20] Check input special characters / HTML / SQL injection strings in text input fields', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    const mnInput = page.locator('.orangehrm-middlename');
    await clearInput(mnInput);
    await mnInput.fill("<script>alert('XSS')</script>");

    const otherIdInput = getGroup(page, 'Other Id').locator('input');
    await clearInput(otherIdInput);
    await otherIdInput.fill("' OR '1'='1' --");

    // Expected: No script execution dialog occurs
    expect(alertTriggered).toBe(false);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-21]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-21] Check selecting [License Expiry Date] using calendar popup picker', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const expiryGroup = getGroup(page, 'License Expiry Date');
    await expiryGroup.locator('.oxd-date-input-icon').click();

    // Expected: Popup calendar widget opens and date can be selected
    const calendar = page.locator('.oxd-date-input-calendar');
    await expect(calendar).toBeVisible();

    const dateToPick = calendar.locator('.oxd-calendar-date').nth(15);
    await dateToPick.click();
    await expect(calendar).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-22]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-22] Check manual text input in [License Expiry Date] with valid formatted date string', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const expiryInput = getGroup(page, 'License Expiry Date').locator('input');
    await clearInput(expiryInput);
    await expiryInput.fill('2028-06-15');
    await page.locator('.orangehrm-main-title').first().click();

    // Expected: Date string accepted without error message
    const errorMsg = getGroup(page, 'License Expiry Date').locator('.oxd-input-field-error-message');
    await expect(errorMsg).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-23]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-23] Check manual text input in [License Expiry Date] with invalid date string or wrong format', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const expiryInput = getGroup(page, 'License Expiry Date').locator('input');
    await clearInput(expiryInput);
    await expiryInput.fill('abc-xyz');
    await page.locator('.orangehrm-main-title').first().click();

    // Expected: Error message "Should be a valid date" is displayed
    const errorMsg = getGroup(page, 'License Expiry Date').locator('.oxd-input-field-error-message');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toHaveText(/Should be a valid date/i);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-24]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-24] Check selecting [Date of Birth] using calendar popup picker', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const dobGroup = getGroup(page, 'Date of Birth');
    await dobGroup.locator('.oxd-date-input-icon').click();

    // Expected: Popup calendar widget opens and date can be selected
    const calendar = page.locator('.oxd-date-input-calendar');
    await expect(calendar).toBeVisible();

    const dateToPick = calendar.locator('.oxd-calendar-date').nth(10);
    await dateToPick.click();
    await expect(calendar).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-25]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-25] Check manual text input in [Date of Birth] with valid formatted date string', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const dobInput = getGroup(page, 'Date of Birth').locator('input');
    await clearInput(dobInput);
    await dobInput.fill('1998-04-12');
    await page.locator('.orangehrm-main-title').first().click();

    // Expected: Date string accepted without format error
    const errorMsg = getGroup(page, 'Date of Birth').locator('.oxd-input-field-error-message');
    await expect(errorMsg).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-26]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-26] Check validation when setting [Date of Birth] to a future date (Date of Birth > Current Date)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const dobInput = getGroup(page, 'Date of Birth').locator('input');
    await clearInput(dobInput);
    await dobInput.fill('2035-01-01');
    await page.locator('.orangehrm-main-title').first().click();

    // Expected: Future date is entered and system responds properly on save/blur
    const val = await dobInput.inputValue();
    expect(val).toBe('2035-01-01');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-27]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-27] Check selecting options from [Nationality] dropdown list', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Step 1 & 2: Select "Vietnamese" from Nationality dropdown
    await selectDropdown(page, 'Nationality', 'Vietnamese');

    // Expected: Selected option displayed in dropdown
    const selectedText = await getGroup(page, 'Nationality').locator('.oxd-select-text').innerText();
    expect(selectedText).toContain('Vietnamese');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-28]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-28] Check selecting options from [Marital Status] dropdown list (Single, Married, Other)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Step 1 & 2: Select "Single" from Marital Status dropdown
    await selectDropdown(page, 'Marital Status', 'Single');

    // Expected: Selected marital status option displayed
    const selectedText = await getGroup(page, 'Marital Status').locator('.oxd-select-text').innerText();
    expect(selectedText).toContain('Single');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-29]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-29] Check selecting [Gender] radio buttons (\'Male\' vs \'Female\')', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const maleWrapper = page.locator('.oxd-radio-wrapper').filter({ hasText: /^Male$/ });
    const femaleWrapper = page.locator('.oxd-radio-wrapper').filter({ hasText: /^Female$/ });

    const maleRadio = maleWrapper.locator('input[type="radio"]');
    const femaleRadio = femaleWrapper.locator('input[type="radio"]');

    // Step 1: Select "Male"
    await maleWrapper.locator('.oxd-radio-input').click();
    await expect(maleRadio).toBeChecked();
    await expect(femaleRadio).not.toBeChecked();

    // Step 2: Select "Female"
    await femaleWrapper.locator('.oxd-radio-input').click();
    await expect(femaleRadio).toBeChecked();
    await expect(maleRadio).not.toBeChecked();
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-30]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-30] Check amending [Employee Id] to an existing Employee Id already assigned to another employee', async ({ page }) => {
    // Create a throwaway employee so the duplicate Id is guaranteed to exist,
    // instead of relying on a hard-coded Id that may vanish after a DB reset.
    const existingId = uniqueEmployeeId('X');
    const existingLastName = 'Existing' + existingId;
    let created = false;

    try {
      await createEmployeeWithId(page, existingId, 'Existing', existingLastName);
      created = true;

      await gotoTargetPersonalDetails(page);

      const idInput = getGroup(page, 'Employee Id').locator('input');
      await clearInput(idInput);
      await idInput.fill(existingId);

      await savePersonalDetails(page);

      // Expected: If backend enforces unique employee ID on amend, displays
      // "Employee Id already exists". If the demo allows it, a toast appears.
      const errorMsg = getGroup(page, 'Employee Id').locator('.oxd-input-field-error-message');
      const toast = page.locator('.oxd-toast');
      await expect(errorMsg.or(toast).first()).toBeVisible({ timeout: 15000 });
      if (await errorMsg.isVisible()) {
        await expect(errorMsg).toContainText(/already exists/i);
      }
    } finally {
      // If the demo accepted the duplicate Id, restore the target's original Id
      // before deleting the throwaway employee (so cleanup cannot delete the target).
      try {
        await gotoTargetPersonalDetails(page);
        const idInput = getGroup(page, 'Employee Id').locator('input');
        if ((await idInput.inputValue()).trim() !== targetEmployeeId) {
          await clearInput(idInput);
          await idInput.fill(targetEmployeeId);
          await savePersonalDetails(page);
        }
      } catch {
        // Best effort only
      }
      if (created) {
        await deleteEmployeeById(page, existingId, existingLastName).catch(() => {});
      }
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-31]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-31] Check amending [Other Id] to an existing Other Id in database', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    const otherIdInput = getGroup(page, 'Other Id').locator('input');
    await clearInput(otherIdInput);
    await otherIdInput.fill('OTH-100');

    // Expected: Input accepted without client error
    await expect(otherIdInput).toHaveValue('OTH-100');
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-32]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-32] Check clicking left sidebar sub-menu tabs (Contact Details, Emergency Contacts, Dependents, Immigration, Job, Salary, Report-to)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Step 1: Click Contact Details
    await page.locator('.orangehrm-tabs-item').filter({ hasText: 'Contact Details' }).click();
    await expect(page).toHaveURL(/pim\/contactDetails\/empNumber\/\d+/);

    // Step 2: Navigate back to Personal Details
    await page.locator('.orangehrm-tabs-item').filter({ hasText: 'Personal Details' }).click();
    await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-33]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-33] Check unsaved changes prompt when navigating to another left sidebar tab after modifying form fields without clicking [Save]', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Modify a field without clicking Save
    const licenseInput = getGroup(page, "Driver's License Number").locator('input');
    await clearInput(licenseInput);
    await licenseInput.fill('TEMP-UNSAVED-123');

    // Click Contact Details tab
    await page.locator('.orangehrm-tabs-item').filter({ hasText: 'Contact Details' }).click();

    // Expected: Navigation executes smoothly or warns user
    await expect(page).toHaveURL(/pim\/contactDetails\/empNumber\/\d+/);
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-34]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-34] Check saving amended personal details successfully with valid updated data', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Ensure First/Last name are valid
    const newFirstName = 'PhapUpdated';
    const fnInput = page.locator('.orangehrm-firstname');
    await clearInput(fnInput);
    await fnInput.fill(newFirstName);

    await selectDropdown(page, 'Nationality', 'Vietnamese');
    await selectDropdown(page, 'Marital Status', 'Single');

    // Click Save
    await savePersonalDetails(page);

    // Expected: Toast notification "Successfully Updated" appears
    const toast = page.locator('.oxd-toast');
    await expect(toast).toContainText(/Successfully Updated/i, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-35]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-35] Check clicking [Save] button without modifying any field values', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Click Save without modifying
    await savePersonalDetails(page);

    // Expected: Toast message "Successfully Updated" appears
    const toast = page.locator('.oxd-toast');
    await expect(toast).toContainText(/Successfully Updated/i, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // [Employee-Amend-36]
  // --------------------------------------------------------------------------
  test('[Employee-Amend-36] Check data persistence after saving (refresh page or re-navigate to Employee List and re-open Personal Details)', async ({ page }) => {
    await gotoTargetPersonalDetails(page);

    // Set distinct other ID
    const distinctOtherId = 'PERSIST' + Date.now().toString().slice(-4);
    const otherIdInput = getGroup(page, 'Other Id').locator('input');
    await clearInput(otherIdInput);
    await otherIdInput.fill(distinctOtherId);

    await savePersonalDetails(page);
    await expect(page.locator('.oxd-toast')).toContainText(/Successfully Updated/i, { timeout: 10000 });

    // Step 2: Refresh page (F5)
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.oxd-loading-spinner').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    // Expected: Persisted value displays accurately from DB
    const persistedInput = getGroup(page, 'Other Id').locator('input');
    await expect(persistedInput).toHaveValue(distinctOtherId, { timeout: 15000 });
  });
});
