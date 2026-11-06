/**
 * Automation Test Suite for OrangeHRM - Module: PIM (Add Employee)
 * Based on: Group09_23130227_LuuQuocPhap.xlsx - Sheet 5 (Add Employee)
 * Tester / Student: Luu Quoc Phap (MSSV: 23130227) - Group 09
 * Application: OrangeHRM (https://opensource-demo.orangehrmlive.com)
 *
 * Test cases included:
 *  [Employee-Add-1]  to [Employee-Add-37]
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const BASE_URL = process.env.ORANGEHRM_BASE_URL ?? 'https://opensource-demo.orangehrmlive.com';
const USERNAME = process.env.ORANGEHRM_USERNAME ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD ?? 'admin123';

// 1x1 valid PNG image buffer
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

// Dummy PDF buffer for invalid file type test
const INVALID_PDF_BUFFER = Buffer.from('%PDF-1.4 sample invalid content');

// Oversized image buffer (> 1MB)
const OVERSIZED_IMAGE_BUFFER = Buffer.alloc(1.5 * 1024 * 1024);

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
 * Navigate to PIM Add Employee page and wait for form ready.
 */
async function gotoAddEmployee(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/pim/addEmployee`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByPlaceholder('First Name')).toBeVisible({ timeout: 15000 });
}

/**
 * Get the form group locator matching the field label.
 */
function getGroup(page: Page, label: string | RegExp): Locator {
  return page.locator('.oxd-input-group').filter({ hasText: label }).first();
}

/**
 * Toggle the 'Create Login Details' switch to desired state (true = ON, false = OFF).
 */
async function setCreateLoginDetails(page: Page, enable: boolean): Promise<void> {
  const switchWrapper = page.locator('.oxd-switch-wrapper');
  const checkbox = switchWrapper.locator('input[type="checkbox"]');
  const isChecked = await checkbox.isChecked();

  if (isChecked !== enable) {
    await switchWrapper.locator('.oxd-switch-input').click();
    await page.waitForTimeout(300);
  }
  await expect(checkbox).toBeChecked({ checked: enable });
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
 * Generate an employee ID with enough entropy to avoid collisions.
 * The public demo DB is reset periodically and is shared by every browser
 * project / worker, so short numeric IDs (e.g. '9' + 4 digits) are unsafe.
 */
function uniqueEmployeeId(prefix = 'E'): string {
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = (Math.random().toString(36) + '000').slice(2, 5).toUpperCase();
  return (prefix + time + rand).slice(0, 10);
}

/**
 * Generate a unique username for [Create Login Details] tests.
 */
function uniqueUsername(): string {
  const suffix = (Math.random().toString(36) + '0000').slice(2, 6);
  return 'u' + Date.now().toString(36) + suffix;
}

/**
 * Delete an employee by Employee Id from the Employee List.
 */
async function deleteEmployeeById(page: Page, empId: string): Promise<void> {
  await page.goto(`${BASE_URL}/web/index.php/pim/viewEmployeeList`);

  const idInput = getGroup(page, 'Employee Id').locator('input');
  await idInput.fill(empId);
  await page.getByRole('button', { name: 'Search' }).click();

  const row = page.locator('.oxd-table-card').filter({ hasText: empId }).first();
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

// ==========================================
// TEST SUITE: PIM - ADD EMPLOYEE
// ==========================================

test.describe.configure({ mode: 'serial' });

test.describe('Group 09 - 23130227 - Luu Quoc Phap - PIM: Add Employee Test Suite', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-1]
  // --------------------------------------------------------------------------
  test('[Employee-Add-1] Check displaying Add Employee screen when selecting [Add Employee] tab from PIM menu or clicking [+ Add] button', async ({ page }) => {
    // Step 1: Click PIM on left menu
    await page.getByRole('link', { name: 'PIM' }).click();
    await expect(page).toHaveURL(/pim\/viewEmployeeList/);

    // Step 2: Click [Add Employee] tab on top menu bar
    const addEmployeeTab = page.getByRole('link', { name: 'Add Employee' });
    await expect(addEmployeeTab).toBeVisible();
    await addEmployeeTab.click();

    // Expected: Add Employee screen is displayed with form elements
    await expect(page).toHaveURL(/pim\/addEmployee/);
    await expect(page.getByPlaceholder('First Name')).toBeVisible();
    await expect(page.getByPlaceholder('Last Name')).toBeVisible();
    await expect(getGroup(page, 'Employee Id')).toBeVisible();
    await expect(page.locator('.oxd-switch-wrapper')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-2]
  // --------------------------------------------------------------------------
  test('[Employee-Add-2] Check screen title [Add Employee] and top navigation bar layout', async ({ page }) => {
    await gotoAddEmployee(page);

    // Expected: Top breadcrumb shows "PIM" and form header displays "Add Employee"
    await expect(page.locator('.oxd-topbar-header-breadcrumb')).toContainText('PIM');
    await expect(page.locator('.orangehrm-main-title')).toHaveText('Add Employee');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-3]
  // --------------------------------------------------------------------------
  test('[Employee-Add-3] Check layout of Add Employee screen (field alignment, labels, placeholders, spacing)', async ({ page }) => {
    await gotoAddEmployee(page);

    // Check placeholders of name inputs
    await expect(page.getByPlaceholder('First Name')).toBeVisible();
    await expect(page.getByPlaceholder('Middle Name')).toBeVisible();
    await expect(page.getByPlaceholder('Last Name')).toBeVisible();

    // Check Employee Id group and profile picture section
    await expect(getGroup(page, 'Employee Id')).toBeVisible();
    await expect(page.locator('.orangehrm-employee-image')).toBeVisible();

    // Check Create Login Details switch
    await expect(page.locator('.oxd-switch-wrapper')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-4]
  // --------------------------------------------------------------------------
  test('[Employee-Add-4] Check default value of [Employee Id] input field (auto-filled with next incremented ID)', async ({ page }) => {
    await gotoAddEmployee(page);

    // Step 2: Inspect [Employee Id] input textbox
    const idInput = getGroup(page, 'Employee Id').locator('input');
    await expect(idInput).toBeVisible();

    // Expected: [Employee Id] field is automatically pre-filled with non-empty sequential ID
    const defaultId = await idInput.inputValue();
    expect(defaultId.trim().length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-5]
  // --------------------------------------------------------------------------
  test('[Employee-Add-5] Check default state of [Create Login Details] toggle switch (default = OFF / disabled)', async ({ page }) => {
    await gotoAddEmployee(page);

    // Step 1: Inspect [Create Login Details] toggle switch position
    const checkbox = page.locator('.oxd-switch-wrapper input[type="checkbox"]');

    // Expected: [Create Login Details] switch is in OFF state by default
    await expect(checkbox).not.toBeChecked();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-6]
  // --------------------------------------------------------------------------
  test('[Employee-Add-6] Check login credentials section is hidden by default when [Create Login Details] is OFF', async ({ page }) => {
    await gotoAddEmployee(page);

    // Expected: Credentials fields (Username, Password, Confirm Password, Status) are hidden
    await expect(getGroup(page, 'Username')).not.toBeVisible();
    await expect(getGroup(page, /^Password/)).not.toBeVisible();
    await expect(getGroup(page, 'Confirm Password')).not.toBeVisible();
    await expect(getGroup(page, 'Status')).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-7]
  // --------------------------------------------------------------------------
  test('[Employee-Add-7] Check presence, position, labels, and styles of [Cancel] and [Save] buttons and mandatory note \'* Required\'', async ({ page }) => {
    await gotoAddEmployee(page);

    // Expected: "* Required" note visible and buttons Cancel/Save present
    await expect(page.getByText('* Required')).toBeVisible();
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(cancelBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-8]
  // --------------------------------------------------------------------------
  test('[Employee-Add-8] Check uploading profile picture with valid image formats (.jpg, .png, .gif)', async ({ page }) => {
    await gotoAddEmployee(page);

    // Step 1 & 2: Upload valid PNG image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: VALID_PNG_BUFFER,
    });

    // Expected: Image preview renders with data URL
    const avatarImg = page.locator('.employee-image');
    await expect(avatarImg).toBeVisible();
    await expect(avatarImg).toHaveAttribute('src', /^data:image/);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-9]
  // --------------------------------------------------------------------------
  test('[Employee-Add-9] Check uploading profile picture with invalid file formats (.pdf, .exe, .txt, .bmp, .svg)', async ({ page }) => {
    await gotoAddEmployee(page);

    // Upload invalid PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: INVALID_PDF_BUFFER,
    });

    // Expected: Error message "File type not allowed" is displayed below avatar placeholder
    const errorMsg = page.locator('.orangehrm-employee-image .oxd-input-field-error-message');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toHaveText('File type not allowed');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-10]
  // --------------------------------------------------------------------------
  test('[Employee-Add-10] Check file size boundary for profile picture (<= 1MB vs > 1MB)', async ({ page }) => {
    await gotoAddEmployee(page);

    const fileInput = page.locator('input[type="file"]');

    // Step 1: Upload oversized file (> 1MB)
    await fileInput.setInputFiles({
      name: 'large_avatar.png',
      mimeType: 'image/png',
      buffer: OVERSIZED_IMAGE_BUFFER,
    });

    // Expected: Error message "Attachment Size Exceeded" is displayed
    const errorMsg = page.locator('.orangehrm-employee-image .oxd-input-field-error-message');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toHaveText('Attachment Size Exceeded');

    // Step 3: Upload valid <= 1MB image
    await fileInput.setInputFiles({
      name: 'valid_avatar.png',
      mimeType: 'image/png',
      buffer: VALID_PNG_BUFFER,
    });

    // Expected: Error message clears and valid preview is rendered
    await expect(errorMsg).not.toBeVisible();
    await expect(page.locator('.employee-image')).toHaveAttribute('src', /^data:image/);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-11]
  // --------------------------------------------------------------------------
  test('[Employee-Add-11] Check profile picture display preview after uploading valid image', async ({ page }) => {
    await gotoAddEmployee(page);

    // Upload valid image
    await page.locator('input[type="file"]').setInputFiles({
      name: 'preview_avatar.png',
      mimeType: 'image/png',
      buffer: VALID_PNG_BUFFER,
    });

    // Expected: Thumbnail image preview renders centered in avatar wrapper
    const avatarWrapper = page.locator('.employee-image-wrapper');
    await expect(avatarWrapper).toBeVisible();
    const avatarImg = avatarWrapper.locator('img.employee-image');
    await expect(avatarImg).toBeVisible();
    await expect(avatarImg).toHaveAttribute('src', /^data:image/);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-12]
  // --------------------------------------------------------------------------
  test('[Employee-Add-12] Check leaving [First Name]* blank when saving', async ({ page }) => {
    await gotoAddEmployee(page);

    // Leave First Name blank, fill Last Name
    await page.getByPlaceholder('Last Name').fill('Doe');
    await page.getByRole('button', { name: 'Save' }).click();

    // Expected: First Name field turns red with error "Required"
    const fnError = page.locator('.orangehrm-firstname').locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(fnError).toBeVisible();
    await expect(fnError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-13]
  // --------------------------------------------------------------------------
  test('[Employee-Add-13] Check leaving [Last Name]* blank when saving', async ({ page }) => {
    await gotoAddEmployee(page);

    // Fill First Name, leave Last Name blank
    await page.getByPlaceholder('First Name').fill('John');
    await page.getByRole('button', { name: 'Save' }).click();

    // Expected: Last Name field turns red with error "Required"
    const lnError = page.locator('.orangehrm-lastname').locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(lnError).toBeVisible();
    await expect(lnError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-14]
  // --------------------------------------------------------------------------
  test('[Employee-Add-14] Check leaving both [First Name]* and [Last Name]* blank when saving', async ({ page }) => {
    await gotoAddEmployee(page);

    // Leave both blank and click Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Expected: Both show error "Required"
    const fnError = page.locator('.orangehrm-firstname').locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    const lnError = page.locator('.orangehrm-lastname').locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(fnError).toBeVisible();
    await expect(fnError).toHaveText('Required');
    await expect(lnError).toBeVisible();
    await expect(lnError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-15]
  // --------------------------------------------------------------------------
  test('[Employee-Add-15] Check [Middle Name] is optional and can be left empty', async ({ page }) => {
    await gotoAddEmployee(page);

    // Verify Middle Name has no mandatory marker and remains optional
    const middleInput = page.getByPlaceholder('Middle Name');
    await expect(middleInput).toBeVisible();
    await expect(middleInput).toHaveValue('');

    // Fill First Name and Last Name while leaving Middle Name blank
    await page.getByPlaceholder('First Name').fill('John');
    await page.getByPlaceholder('Last Name').fill('Doe');

    // No error should appear for Middle Name
    const middleError = page.locator('.orangehrm-middlename').locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(middleError).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-16]
  // --------------------------------------------------------------------------
  test('[Employee-Add-16] Check [First Name] input with valid letters, spaces, hyphens, and accented characters', async ({ page }) => {
    await gotoAddEmployee(page);

    const fnInput = page.getByPlaceholder('First Name');
    await fnInput.fill('Mary-Jane Quốc Pháp');

    // Expected: Value accepted without validation error
    await expect(fnInput).toHaveValue('Mary-Jane Quốc Pháp');
    const fnError = page.locator('.orangehrm-firstname').locator('xpath=following::span[contains(@class,"oxd-input-field-error-message")][1]');
    await expect(fnError).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-17]
  // --------------------------------------------------------------------------
  test('[Employee-Add-17] Check [First Name] input with max length boundary', async ({ page }) => {
    await gotoAddEmployee(page);

    const fnInput = page.getByPlaceholder('First Name');
    const thirtyChars = 'A'.repeat(30);
    await fnInput.fill(thirtyChars);

    // Expected: 30 characters accepted
    const val = await fnInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-18]
  // --------------------------------------------------------------------------
  test('[Employee-Add-18] Check [Last Name] input with max length boundary', async ({ page }) => {
    await gotoAddEmployee(page);

    const lnInput = page.getByPlaceholder('Last Name');
    const thirtyChars = 'B'.repeat(30);
    await lnInput.fill(thirtyChars);

    // Expected: 30 characters accepted
    const val = await lnInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(30);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-19]
  // --------------------------------------------------------------------------
  test('[Employee-Add-19] Check [Employee Id] input with custom valid alphanumeric string', async ({ page }) => {
    await gotoAddEmployee(page);

    const idInput = getGroup(page, 'Employee Id').locator('input');
    await clearInput(idInput);
    await idInput.fill('EMP-2026');

    // Expected: Custom string accepted into field
    await expect(idInput).toHaveValue('EMP-2026');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-20]
  // --------------------------------------------------------------------------
  test('[Employee-Add-20] Check [Employee Id] input with max length boundary', async ({ page }) => {
    await gotoAddEmployee(page);

    const idInput = getGroup(page, 'Employee Id').locator('input');
    await clearInput(idInput);
    const tenChars = '1234567890';
    await idInput.fill(tenChars);

    // Expected: 10 characters entered
    const val = await idInput.inputValue();
    expect(val.length).toBeGreaterThanOrEqual(10);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-21]
  // --------------------------------------------------------------------------
  test('[Employee-Add-21] Check special characters and HTML/SQL injection strings in Name and Employee Id fields', async ({ page }) => {
    await gotoAddEmployee(page);

    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.getByPlaceholder('First Name').fill("<script>alert('xss')</script>");
    const idInput = getGroup(page, 'Employee Id').locator('input');
    await clearInput(idInput);
    await idInput.fill("' OR 1=1 --");

    // Expected: No script execution occurs
    expect(alertTriggered).toBe(false);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-22]
  // --------------------------------------------------------------------------
  test('[Employee-Add-22] Check adding employee with an existing [Employee Id] already in DB', async ({ page }) => {
    // Create a dedicated employee first, so the duplicate Id is guaranteed to
    // exist in the shared demo database (hard-coded Ids like '0001' may not).
    const existingId = uniqueEmployeeId('I');
    const existingLastName = 'IdTest' + existingId;
    let created = false;

    try {
      await gotoAddEmployee(page);
      await page.getByPlaceholder('First Name').fill('Dup');
      await page.getByPlaceholder('Last Name').fill(existingLastName);
      const createIdInput = getGroup(page, 'Employee Id').locator('input');
      await clearInput(createIdInput);
      await createIdInput.fill(existingId);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 30000 });
      created = true;

      // Try to add another employee using the same Employee Id
      await gotoAddEmployee(page);
      const idInput = getGroup(page, 'Employee Id').locator('input');
      await clearInput(idInput);
      await idInput.fill(existingId);

      await page.getByPlaceholder('First Name').fill('Test');
      await page.getByPlaceholder('Last Name').fill('Duplicate');

      await page.getByRole('button', { name: 'Save' }).click();

      // Expected: Error message "Employee Id already exists" is displayed
      // and the user stays on the Add Employee screen.
      const errorMsg = getGroup(page, 'Employee Id').locator('.oxd-input-field-error-message');
      await expect(errorMsg).toBeVisible({ timeout: 20000 });
      await expect(errorMsg).toHaveText('Employee Id already exists', { timeout: 20000 });
      await expect(page).toHaveURL(/pim\/addEmployee/);
    } finally {
      // Only delete when this test actually created the employee. If creation
      // failed because the Id already existed, deleting would remove someone
      // else's record.
      if (created) {
        await deleteEmployeeById(page, existingId).catch(() => {});
      }
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-23]
  // --------------------------------------------------------------------------
  test('[Employee-Add-23] Check turning ON [Create Login Details] toggle switch expands login details section', async ({ page }) => {
    await gotoAddEmployee(page);

    // Step 1: Turn ON toggle
    await setCreateLoginDetails(page, true);

    // Expected: Login details section expands, displaying Username*, Status, Password*, Confirm Password*
    await expect(getGroup(page, 'Username')).toBeVisible();
    await expect(getGroup(page, 'Status')).toBeVisible();
    await expect(getGroup(page, /^Password/)).toBeVisible();
    await expect(getGroup(page, 'Confirm Password')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-24]
  // --------------------------------------------------------------------------
  test('[Employee-Add-24] Check default values of expanded login details section (Status = Enabled, textboxes empty)', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);

    // Expected: Textboxes empty and Status radio defaults to Enabled
    await expect(getGroup(page, 'Username').locator('input')).toHaveValue('');
    await expect(getGroup(page, /^Password/).locator('input')).toHaveValue('');
    await expect(getGroup(page, 'Confirm Password').locator('input')).toHaveValue('');

    const enabledRadio = page.locator('.oxd-radio-wrapper').filter({ hasText: 'Enabled' }).locator('input[type="radio"]');
    await expect(enabledRadio).toBeChecked();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-25]
  // --------------------------------------------------------------------------
  test('[Employee-Add-25] Check turning OFF [Create Login Details] toggle collapses and hides login details section', async ({ page }) => {
    await gotoAddEmployee(page);

    // Turn ON then turn OFF
    await setCreateLoginDetails(page, true);
    await setCreateLoginDetails(page, false);

    // Expected: Login details section is hidden again
    await expect(getGroup(page, 'Username')).not.toBeVisible();
    await expect(getGroup(page, /^Password/)).not.toBeVisible();
    await expect(getGroup(page, 'Confirm Password')).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-26]
  // --------------------------------------------------------------------------
  test('[Employee-Add-26] Check mandatory field [Username]* when [Create Login Details] is ON', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    await page.getByPlaceholder('First Name').fill('John');
    await page.getByPlaceholder('Last Name').fill('Doe');

    // Fill passwords but leave Username empty
    await getGroup(page, /^Password/).locator('input').fill('Admin@123456');
    await getGroup(page, 'Confirm Password').locator('input').fill('Admin@123456');

    await page.getByRole('button', { name: 'Save' }).click();

    // Expected: [Username] field shows error message "Required"
    const userError = getGroup(page, 'Username').locator('.oxd-input-field-error-message');
    await expect(userError).toBeVisible();
    await expect(userError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-27]
  // --------------------------------------------------------------------------
  test('[Employee-Add-27] Check mandatory field [Password]* when [Create Login Details] is ON', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    await getGroup(page, 'Username').locator('input').fill('john_test_user');

    await page.getByRole('button', { name: 'Save' }).click();

    // Expected: [Password] field displays error message "Required"
    const passError = getGroup(page, /^Password/).locator('.oxd-input-field-error-message');
    await expect(passError).toBeVisible();
    await expect(passError).toHaveText('Required');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-28]
  // --------------------------------------------------------------------------
  test('[Employee-Add-28] Check mandatory field [Confirm Password]* when [Create Login Details] is ON', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    await getGroup(page, 'Username').locator('input').fill('john_test_user');
    await getGroup(page, /^Password/).locator('input').fill('Admin@123456');

    await page.getByRole('button', { name: 'Save' }).click();

    // Expected: [Confirm Password] field displays error message "Passswords do not match" or "Required"
    const confirmError = getGroup(page, 'Confirm Password').locator('.oxd-input-field-error-message');
    await expect(confirmError).toBeVisible();
    await expect(confirmError).toContainText(/Passwords do not match|Required/i);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-29]
  // --------------------------------------------------------------------------
  test('[Employee-Add-29] Check [Username] uniqueness constraint against existing DB usernames', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    const userInput = getGroup(page, 'Username').locator('input');

    // Input existing username 'Admin'
    await userInput.fill('Admin');
    await page.getByPlaceholder('First Name').click(); // blur to trigger validation

    // Expected: Error message "Username already exists" or "Already exists" is displayed
    const userError = getGroup(page, 'Username').locator('.oxd-input-field-error-message');
    await expect(userError).toBeVisible({ timeout: 8000 });
    await expect(userError).toContainText(/already exists/i);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-30]
  // --------------------------------------------------------------------------
  test('[Employee-Add-30] Check [Username] length boundary (min 5 characters)', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    const userInput = getGroup(page, 'Username').locator('input');

    // Input 4 characters
    await userInput.fill('user');
    await page.getByPlaceholder('First Name').click();

    // Expected: Error message "Should be at least 5 characters" is displayed
    const userError = getGroup(page, 'Username').locator('.oxd-input-field-error-message');
    await expect(userError).toBeVisible();
    await expect(userError).toHaveText('Should be at least 5 characters');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-31]
  // --------------------------------------------------------------------------
  test('[Employee-Add-31] Check selecting [Status] radio options (\'Enabled\' vs \'Disabled\')', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);

    const enabledRadio = page.locator('.oxd-radio-wrapper').filter({ hasText: 'Enabled' }).locator('input[type="radio"]');
    const disabledRadio = page.locator('.oxd-radio-wrapper').filter({ hasText: 'Disabled' }).locator('input[type="radio"]');

    // Step 1: Select "Disabled"
    await page.locator('.oxd-radio-wrapper').filter({ hasText: 'Disabled' }).locator('.oxd-radio-input').click();
    await expect(disabledRadio).toBeChecked();
    await expect(enabledRadio).not.toBeChecked();

    // Step 2: Select "Enabled"
    await page.locator('.oxd-radio-wrapper').filter({ hasText: 'Enabled' }).locator('.oxd-radio-input').click();
    await expect(enabledRadio).toBeChecked();
    await expect(disabledRadio).not.toBeChecked();
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-32]
  // --------------------------------------------------------------------------
  test('[Employee-Add-32] Check [Password] complexity rule validation (min 8 chars, uppercase, lowercase, number, symbol)', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    const passInput = getGroup(page, /^Password/).locator('input');

    // Type weak password "12345"
    await passInput.fill('12345');
    await page.getByPlaceholder('First Name').click();

    // Expected: Error message "Should have at least 7/8 characters" appears
    const passError = getGroup(page, /^Password/).locator('.oxd-input-field-error-message');
    await expect(passError).toBeVisible();
    await expect(passError).toHaveText(/Should have at least (7|8) characters/i);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-33]
  // --------------------------------------------------------------------------
  test('[Employee-Add-33] Check [Confirm Password] mismatch with [Password]', async ({ page }) => {
    await gotoAddEmployee(page);

    await setCreateLoginDetails(page, true);
    await getGroup(page, /^Password/).locator('input').fill('Admin@1234');
    await getGroup(page, 'Confirm Password').locator('input').fill('Admin@9999');
    await page.getByPlaceholder('First Name').click();

    // Expected: Error message "Passwords do not match" displays below Confirm Password field
    const confirmError = getGroup(page, 'Confirm Password').locator('.oxd-input-field-error-message');
    await expect(confirmError).toBeVisible();
    await expect(confirmError).toHaveText('Passwords do not match');
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-34]
  // --------------------------------------------------------------------------
  test('[Employee-Add-34] Check saving employee successfully with valid mandatory fields and [Create Login Details] = OFF', async ({ page }) => {
    const testId = uniqueEmployeeId('A');

    try {
      await gotoAddEmployee(page);

      await page.getByPlaceholder('First Name').fill('Auto');
      await page.getByPlaceholder('Last Name').fill('Simple' + testId);

      const idInput = getGroup(page, 'Employee Id').locator('input');
      await clearInput(idInput);
      await idInput.fill(testId);

      // Click Save
      await page.getByRole('button', { name: 'Save' }).click();

      // Expected: Redirects to Personal Details page
      await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 25000 });
      await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible();
    } finally {
      // Remove the created employee so repeated runs do not fill the demo DB.
      await deleteEmployeeById(page, testId).catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-35]
  // --------------------------------------------------------------------------
  test('[Employee-Add-35] Check saving employee successfully with valid fields and [Create Login Details] = ON', async ({ page }) => {
    const testId = uniqueEmployeeId('L');
    const uniqueUser = uniqueUsername();

    try {
      await gotoAddEmployee(page);

      await page.getByPlaceholder('First Name').fill('Login');
      await page.getByPlaceholder('Last Name').fill('User' + testId);

      const idInput = getGroup(page, 'Employee Id').locator('input');
      await clearInput(idInput);
      await idInput.fill(testId);

      // Turn ON login details
      await setCreateLoginDetails(page, true);
      await getGroup(page, 'Username').locator('input').fill(uniqueUser);
      await getGroup(page, /^Password/).locator('input').fill('Admin@123456');
      await getGroup(page, 'Confirm Password').locator('input').fill('Admin@123456');

      // Save
      await page.getByRole('button', { name: 'Save' }).click();

      // Expected: Employee record & User created, redirects to Personal Details
      await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 25000 });
      await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible();
    } finally {
      // Deleting the employee also removes the linked login user, keeping the
      // shared demo DB clean and the generated username reusable.
      await deleteEmployeeById(page, testId).catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-36]
  // --------------------------------------------------------------------------
  test('[Employee-Add-36] Check saving multiple employees continuously', async ({ page }) => {
    // Navigate to Add Employee form
    await gotoAddEmployee(page);

    // Read current employee ID
    const firstId = await getGroup(page, 'Employee Id').locator('input').inputValue();

    // Click Add Employee tab again
    await page.getByRole('link', { name: 'Add Employee' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Expected: Add Employee form is reloaded with pre-filled Employee Id
    const nextIdInput = getGroup(page, 'Employee Id').locator('input');
    await expect(nextIdInput).toBeVisible();
    const nextId = await nextIdInput.inputValue();
    expect(nextId.trim().length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // [Employee-Add-37]
  // --------------------------------------------------------------------------
  test('[Employee-Add-37] Check clicking [Cancel] button discards input and navigates back to Employee List', async ({ page }) => {
    await gotoAddEmployee(page);

    await page.getByPlaceholder('First Name').fill('Testing');
    await page.getByPlaceholder('Last Name').fill('Cancel');

    // Step 2: Click Cancel button
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Expected: System navigates back to Employee List page
    await expect(page).toHaveURL(/pim\/viewEmployeeList/, { timeout: 20000 });
    await expect(page.locator('.oxd-table')).toBeVisible();
  });
});
