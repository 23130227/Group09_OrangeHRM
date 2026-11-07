
import { test, expect, Page } from '@playwright/test';

const BASE: string = 'https://opensource-demo.orangehrmlive.com/web/index.php';

// Đăng nhập và mở trang Leave Entitlements and Usage Report
const loginAndOpenReport = async (page: Page): Promise<void> => {

    await page.goto(`${BASE}/auth/login`);

    await page.locator('input[name="username"]').fill('Admin');
    await page.locator('input[name="password"]').fill('admin123');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/dashboard/, {
        timeout: 30000
    });

    await page.goto(`${BASE}/leave/viewLeaveBalanceReport`);

    await expect(page).toHaveURL(/leave\/viewLeaveBalanceReport/);

    await expect(
        page.locator('.oxd-table-filter-title')
    ).toHaveText('Leave Entitlements and Usage Report', {
        timeout: 15000
    });

};

// Mở rộng vùng bộ lọc nếu đang bị ẩn
const expandFilter = async (page: Page): Promise<void> => {

    const filterArea = page.locator('.oxd-table-filter-area');

    if (!(await filterArea.isVisible())) {

        await page.locator('.oxd-table-filter-header-options button').click();

    }

    await expect(filterArea).toBeVisible();

};

// Lấy dropdown theo tên nhãn
// Leave Type, Leave Period, Location, Sub Unit, Job Title
const getSelect = (page: Page, label: string) => {

    return page.locator('.oxd-input-group')
        .filter({
            has: page.locator('label.oxd-label', {
                hasText: new RegExp(`^${label}$`)
            })
        })
        .locator('.oxd-select-text')
        .first();

};

// Chọn option của dropdown theo index
const selectOption = async (
    page: Page,
    label: string,
    index: number = 1
): Promise<void> => {

    await getSelect(page, label).click();

    const options = page.locator('.oxd-select-option:visible');

    await expect(options.first()).toBeVisible();

    await options.nth(index).click();

};

// Chọn radio Generate For (Leave Type / Employee)
const selectGenerateFor = async (
    page: Page,
    name: string
): Promise<void> => {

    await page.locator('.oxd-radio-wrapper')
        .filter({ hasText: name })
        .locator('label')
        .click();

};

// Nhấn Generate
const clickGenerate = async (page: Page): Promise<void> => {

    await page.getByRole('button', {
        name: 'Generate',
        exact: true
    }).click();

};


test.describe('Leave Entitlements and Usage Report - 10 Test Cases', () => {

    test.beforeEach(async ({ page }) => {

        await loginAndOpenReport(page);

    });

    // TC01: Kiểm tra mở trang báo cáo
    test('TC01 - Open Leave Entitlements and Usage Report page', async ({ page }) => {

        await expect(page.locator('body')).toBeVisible();

        await expect(
            page.locator('.oxd-table-filter-title')
        ).toContainText('Leave Entitlements and Usage Report');

    });

    // TC02: Kiểm tra URL trang báo cáo
    test('TC02 - Verify report URL', async ({ page }) => {

        await expect(page).toHaveURL(/leave\/viewLeaveBalanceReport/);

    });

    // TC03: Kiểm tra các thành phần bộ lọc
    test('TC03 - Display filter fields', async ({ page }) => {

        await expandFilter(page);

        await expect(page.getByText('Generate For', { exact: true })).toBeVisible();

        await expect(getSelect(page, 'Leave Type')).toBeVisible();
        await expect(getSelect(page, 'Leave Period')).toBeVisible();
        await expect(getSelect(page, 'Location')).toBeVisible();
        await expect(getSelect(page, 'Sub Unit')).toBeVisible();
        await expect(getSelect(page, 'Job Title')).toBeVisible();

        await expect(page.getByText('Include Past Employees')).toBeVisible();

    });

    // TC04: Kiểm tra radio Generate For
    test('TC04 - Generate For radio buttons', async ({ page }) => {

        await expandFilter(page);

        await selectGenerateFor(page, 'Leave Type');

        await expect(
            page.locator('input[value="leave_type_leave_entitlements_and_usage"]')
        ).toBeChecked();

        await selectGenerateFor(page, 'Employee');

        await expect(
            page.locator('input[value="employee_leave_entitlements_and_usage"]')
        ).toBeChecked();

    });

    // TC05: Nhấn Generate với giá trị mặc định
    test('TC05 - Generate report with default values', async ({ page }) => {

        await expandFilter(page);

        await selectGenerateFor(page, 'Leave Type');

        await clickGenerate(page);

        await expect(
            page.locator('.oxd-table-body, .oxd-report-table, .orangehrm-container').first()
        ).toBeVisible({ timeout: 15000 });

    });

    // TC06: Chọn Leave Type
    test('TC06 - Select Leave Type', async ({ page }) => {

        await expandFilter(page);

        await selectOption(page, 'Leave Type', 1);

        await expect(
            getSelect(page, 'Leave Type').locator('.oxd-select-text-input')
        ).not.toHaveText('-- Select --');

    });

    // TC07: Kiểm tra danh sách Leave Period
    test('TC07 - Leave Period has options', async ({ page }) => {

        await expandFilter(page);

        await getSelect(page, 'Leave Period').click();

        await expect(
            page.locator('.oxd-select-option:visible').first()
        ).toBeVisible();

    });

    // TC08: Chọn Generate For = Employee hiển thị ô Employee Name
    test('TC08 - Employee option shows Employee Name field', async ({ page }) => {

        await expandFilter(page);

        await selectGenerateFor(page, 'Employee');

        await expect(
            page.locator('input[placeholder="Type for hints..."]')
        ).toBeVisible();

    });

    // TC09: Bật / tắt Include Past Employees
    test('TC09 - Toggle Include Past Employees', async ({ page }) => {

        await expandFilter(page);

        const toggle = page.locator('.oxd-switch-wrapper input[type="checkbox"]');

        await page.locator('.oxd-switch-input').click();

        await expect(toggle).toBeChecked();

        await page.locator('.oxd-switch-input').click();

        await expect(toggle).not.toBeChecked();

    });

    // TC10: Lọc kết hợp Leave Type, Location và Generate
    test('TC10 - Filter by Leave Type and Location then Generate', async ({ page }) => {

        await expandFilter(page);

        await selectGenerateFor(page, 'Leave Type');

        await selectOption(page, 'Leave Type', 1);

        await selectOption(page, 'Location', 1);

        await clickGenerate(page);

        await expect(
            page.locator('.oxd-table-body, .oxd-report-table, .orangehrm-container').first()
        ).toBeVisible({ timeout: 15000 });

    });

});
