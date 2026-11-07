
import { test, expect, Page } from '@playwright/test';

const BASE: string = 'https://opensource-demo.orangehrmlive.com/web/index.php';

// Hàm đăng nhập dùng chung
const login = async (page: Page): Promise<void> => {

    await page.goto(`${BASE}/auth/login`);

    await page.locator('input[name="username"]').fill('Admin');

    await page.locator('input[name="password"]').fill('admin123');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/dashboard/, {
        timeout: 30000
    });

};

// Mở trang My Leave Entitlements
const openMyEntitlements = async (page: Page): Promise<void> => {

    await page.goto(`${BASE}/leave/viewMyLeaveEntitlements`);

    await expect(page).toHaveURL(
        /leave\/viewMyLeaveEntitlements/
    );

};

// Chọn Leave Type
const selectLeaveType = async (page: Page): Promise<void> => {

    const leaveType = page.locator('.oxd-input-group')
        .filter({
            has: page.locator('label', {
                hasText: /^Leave Type$/
            })
        });

    await leaveType.locator('.oxd-select-text').click();

    const options = page.locator('.oxd-select-option:visible');

    await expect(options.first()).toBeVisible();

    await options.nth(1).click();

};

// Nhấn Search
const clickSearch = async (page: Page): Promise<void> => {

    await page.getByRole('button', {
        name: 'Search',
        exact: true
    }).click();

};

// Bộ test Leave Entitlements
test.describe('Leave - Entitlements', () => {

    // Đăng nhập trước mỗi test
    test.beforeEach(async ({ page }) => {

        await login(page);

    });

    // TC01: Kiểm tra truy cập Leave List
    test('TC01 - Kiểm tra truy cập Leave List', async ({ page }) => {

        await page.goto(`${BASE}/leave/viewLeaveList`);

        await expect(page).toHaveURL(/leave\/viewLeaveList/);

        await expect(
            page.locator('input[name="username"]')
        ).toHaveCount(0);

    });

    // TC02: Kiểm tra Entitlements
    test('TC02 - Kiểm tra Entitlements', async ({ page }) => {

        await openMyEntitlements(page);

        await selectLeaveType(page);

        await clickSearch(page);

        await expect(page.locator('.oxd-table')).toBeVisible();

    });

    // TC03: Kiểm tra Add Entitlements
    test('TC03 - Kiểm tra Add Entitlements', async ({ page }) => {

        await openMyEntitlements(page);

        await selectLeaveType(page);

        await clickSearch(page);

        // Nhấn Add
        await page.locator(
            '.orangehrm-header-container button.oxd-button'
        ).click();

        // Kiểm tra chuyển sang trang Add Entitlement
        await expect(page).toHaveURL(/addLeaveEntitlement/);

    });

    // TC04: Kiểm tra Edit Entitlements
    test('TC04 - Kiểm tra Edit Entitlements', async ({ page }) => {

        await openMyEntitlements(page);

        await selectLeaveType(page);

        await clickSearch(page);

        // Kiểm tra có dữ liệu để chỉnh sửa
        const editButton = page.locator('i.bi-pencil-fill');

        await expect(editButton.first()).toBeVisible();

        // Nhấn Edit
        await editButton.first().click();

        // Kiểm tra trang chỉnh sửa
        await expect(page).toHaveURL(/editLeaveEntitlement/);

    });

});
