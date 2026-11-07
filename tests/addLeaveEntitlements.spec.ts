
const { test, expect } = require('@playwright/test');

const BASE = 'https://opensource-demo.orangehrmlive.com/web/index.php';

// Đăng nhập và mở trang Add Entitlements
const loginAndOpenAddEntitlements = async (page) => {

    await page.goto(`${BASE}/auth/login`);

    await page.locator('input[name="username"]').fill('Admin');
    await page.locator('input[name="password"]').fill('admin123');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/dashboard/, {
        timeout: 30000
    });

    await page.goto(`${BASE}/leave/addLeaveEntitlement`);

    await expect(page).toHaveURL(/leave\/addLeaveEntitlement/);

};

// Tìm kiếm nhân viên
const searchEmployee = async (page, employeeName = 'Ranga Akunuri') => {

    const employeeInput = page.locator(
        'input[placeholder="Type for hints..."]'
    );

    await employeeInput.fill(employeeName);

    // Chờ danh sách gợi ý nhân viên
    const suggestion = page.locator('.oxd-autocomplete-option')
        .filter({ hasText: employeeName });

    await expect(suggestion.first()).toBeVisible({
        timeout: 10000
    });

    await suggestion.first().click();

};

// Chọn dropdown theo index
const selectDropdown = async (page, index = 0) => {

    const dropdowns = page.locator('.oxd-select-text');

    await dropdowns.nth(index).click();

    const options = page.locator('.oxd-select-option:visible');

    await expect(options.first()).toBeVisible();

    await options.nth(1).click();

};

// Nhấn Search
const clickSearch = async (page) => {

    await page.locator('button.orangehrm-left-space')
        .filter({ hasText: 'Search' })
        .click();

};

// Nhấn Reset
const clickReset = async (page) => {

    await page.getByRole('button', {
        name: 'Reset',
        exact: true
    }).click();

};


test.describe('Leave Entitlements - 10 Test Cases', () => {

    test.beforeEach(async ({ page }) => {

        await loginAndOpenAddEntitlements(page);

    });

    // TC01: Kiểm tra mở trang Add Entitlements
    test('TC01 - Open add Entitlements page', async ({ page }) => {

        await expect(page.locator('body')).toBeVisible();

        await expect(page).toHaveURL(/addLeaveEntitlement/);

    });

    // TC02: Kiểm tra URL trang Add Entitlements
    test('TC02 - Verify add Entitlements URL', async ({ page }) => {

        await expect(page).toHaveURL(/leave\/addLeaveEntitlement/);

    });

    // TC03: Tìm kiếm nhân viên Ranga Akunuri
    test('TC03 - Search employee Ranga Akunuri', async ({ page }) => {

        await searchEmployee(page, 'Ranga Akunuri');

        // Chọn Leave Type
        await selectDropdown(page, 0);

        // Chọn Leave Period
        await selectDropdown(page, 1);

        // Nhập số ngày entitlement
        const inputs = page.locator('input.oxd-input');

        await inputs.last().fill('6');

        // Nhấn Save
        await page.getByRole('button', {
            name: 'Save',
            exact: true
        }).click();

    });

    // TC04: Kiểm tra bộ lọc Employee Name
    test('TC04 - Test multiple employee', async ({ page }) => {

        // Chọn chế độ Multiple Employees
        await page.getByText('Multiple Employees', {
            exact: true
        }).click();

        // Kiểm tra radio được chọn
        await expect(
            page.locator('input[value="1"]')
        ).toBeChecked();

        // Kiểm tra các thành phần form
        await expect(
            page.locator('.orangehrm-full-width-grid')
        ).toBeVisible();

    });

    // TC05: Kiểm tra nhập Employee Name không hợp lệ
    test('TC05 - Search invalid employee name', async ({ page }) => {

        await searchEmployee(page, 'fskjhfkjshfk');

        // Nếu không có gợi ý, kiểm tra không thể chọn nhân viên
        await expect(
            page.locator('.oxd-autocomplete-option')
        ).toHaveCount(0);

    });

    // TC06: Kiểm tra Leave Period filter
    test('TC06 - Display Leave Period filter', async ({ page }) => {

        await page.getByText('Multiple Employees', {
            exact: true
        }).click();

        await expect(
            page.locator('.orangehrm-full-width-grid')
        ).toBeVisible();

        await expect(
            page.locator('.oxd-select-text').first()
        ).toBeVisible();

    });

    // TC07: Kiểm tra Include filter
    test('TC07 - Display Include filter', async ({ page }) => {

        const includeButton = page.locator(
            'button.oxd-button--ghost'
        );

        await expect(includeButton).toBeVisible();

        await includeButton.click();

        await expect(
            page.locator('.oxd-button--ghost')
        ).toBeVisible();

    });

    // TC08: Kiểm tra Sub Unit filter
    test('TC08 - Display Sub Unit filter', async ({ page }) => {

        await page.getByText('Multiple Employees', {
            exact: true
        }).click();

        await expect(
            page.locator('.orangehrm-full-width-grid')
        ).toBeVisible();

    });

    // TC09: Kiểm tra nút Search
    test('TC09 - Search button is available', async ({ page }) => {

        const searchButton = page.getByRole('button', {
            name: 'Search',
            exact: true
        });

        await expect(searchButton).toBeVisible();

        await expect(searchButton).toBeEnabled();

    });

    // TC10: Reset Employee Name filter
    test('TC10 - Reset Employee Name filter', async ({ page }) => {

        const employeeInput = page.locator(
            'input[placeholder="Type for hints..."]'
        ).first();

        await employeeInput.fill('ailaai');

        await clickReset(page);

        await expect(employeeInput).toHaveValue('');

    });

});