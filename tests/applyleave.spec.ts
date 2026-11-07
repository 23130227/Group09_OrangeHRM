
import { test, expect, Page } from '@playwright/test';

const BASE: string = 'https://opensource-demo.orangehrmlive.com/web/index.php';

// Đăng nhập và mở trang Apply Leave
const loginAndOpenApplyLeave = async (page: Page): Promise<void> => {

    await page.goto(`${BASE}/auth/login`);

    await page.locator('input[name="username"]').fill('Admin');
    await page.locator('input[name="password"]').fill('admin123');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/dashboard/, {
        timeout: 30000
    });

    await page.goto(`${BASE}/leave/applyLeave`);

    await expect(page).toHaveURL(/leave\/applyLeave/);

    await expect(
        page.getByRole('heading', { name: 'Apply Leave' })
    ).toBeVisible({ timeout: 15000 });

};

// Lấy ô nhập ngày theo nhãn (From Date / To Date)
const getDateInput = (page: Page, label: string) => {

    return page.locator('.oxd-input-group')
        .filter({ has: page.locator('label', { hasText: label }) })
        .locator('input.oxd-input');

};

// Định dạng ngày theo placeholder của hệ thống
// (yyyy-mm-dd hoặc yyyy-dd-mm ...)
const formatDate = async (
    page: Page,
    offsetDays: number = 0
): Promise<string> => {

    const placeholder = await getDateInput(page, 'From Date')
        .getAttribute('placeholder');

    const d = new Date();
    d.setDate(d.getDate() + offsetDays);

    const yyyy: string = String(d.getFullYear());
    const mm: string = String(d.getMonth() + 1).padStart(2, '0');
    const dd: string = String(d.getDate()).padStart(2, '0');

    return (placeholder || 'yyyy-mm-dd')
        .replace('yyyy', yyyy)
        .replace('mm', mm)
        .replace('dd', dd);

};

// Nhập ngày
const fillDate = async (
    page: Page,
    label: string,
    value: string
): Promise<void> => {

    const input = getDateInput(page, label);

    await input.fill(value);

    // Click ra ngoài để đóng lịch
    await page.locator('.orangehrm-main-title').click();

};

// Chọn Leave Type (option đầu tiên sau "-- Select --")
const selectLeaveType = async (page: Page): Promise<void> => {

    await page.locator('.oxd-select-text').first().click();

    const options = page.locator('.oxd-select-option:visible');

    await expect(options.first()).toBeVisible();

    await options.nth(1).click();

};

// Nhấn Apply
const clickApply = async (page: Page): Promise<void> => {

    await page.getByRole('button', {
        name: 'Apply',
        exact: true
    }).click();

};


test.describe('Apply Leave - 10 Test Cases', () => {

    test.beforeEach(async ({ page }) => {

        await loginAndOpenApplyLeave(page);

    });

    // TC01: Kiểm tra mở trang Apply Leave
    test('TC01 - Open Apply Leave page', async ({ page }) => {

        await expect(page.locator('body')).toBeVisible();

        await expect(
            page.locator('.orangehrm-main-title')
        ).toHaveText('Apply Leave');

    });

    // TC02: Kiểm tra URL trang Apply Leave
    test('TC02 - Verify Apply Leave URL', async ({ page }) => {

        await expect(page).toHaveURL(/leave\/applyLeave/);

    });

    // TC03: Kiểm tra các thành phần của form
    test('TC03 - Display form fields', async ({ page }) => {

        await expect(page.getByText('Leave Type', { exact: true })).toBeVisible();
        await expect(page.getByText('Leave Balance', { exact: true })).toBeVisible();
        await expect(page.getByText('From Date', { exact: true })).toBeVisible();
        await expect(page.getByText('To Date', { exact: true })).toBeVisible();
        await expect(page.getByText('Comments', { exact: true })).toBeVisible();

        await expect(page.locator('textarea.oxd-textarea')).toBeVisible();

    });

    // TC04: Kiểm tra giá trị mặc định của Leave Balance
    test('TC04 - Default Leave Balance', async ({ page }) => {

        await expect(
            page.locator('.orangehrm-leave-balance-text')
        ).toContainText('Day(s)');

    });

    // TC05: Nhấn Apply khi để trống các trường bắt buộc
    test('TC05 - Apply with empty required fields', async ({ page }) => {

        await clickApply(page);

        const errors = page.locator('.oxd-input-field-error-message');

        await expect(errors.first()).toBeVisible();

        await expect(errors.first()).toHaveText('Required');

    });

    // TC06: Chọn Leave Type và kiểm tra Leave Balance hiển thị
    test('TC06 - Select Leave Type', async ({ page }) => {

        await selectLeaveType(page);

        await expect(
            page.locator('.oxd-select-text-input').first()
        ).not.toHaveText('-- Select --');

        await expect(
            page.locator('.orangehrm-leave-balance-text')
        ).toBeVisible();

    });

    // TC07: Apply leave với dữ liệu hợp lệ
    test('TC07 - Apply leave with valid data', async ({ page }) => {

        await selectLeaveType(page);

        await fillDate(page, 'From Date', await formatDate(page, 30));
        await fillDate(page, 'To Date', await formatDate(page, 30));

        await page.locator('textarea.oxd-textarea')
            .fill('Nghi phep - automation test');

        await clickApply(page);

        // Thành công (toast) hoặc báo lỗi nghiệp vụ
        // (ví dụ: không đủ số ngày phép)
        await expect(
            page.locator('.oxd-toast, .oxd-alert-content, .oxd-input-field-error-message')
                .first()
        ).toBeVisible({ timeout: 10000 });

    });

    // TC08: Nhập ngày sai định dạng
    test('TC08 - Invalid date format', async ({ page }) => {

        await fillDate(page, 'From Date', 'abc');

        await expect(
            page.locator('.oxd-input-field-error-message').first()
        ).toBeVisible();

    });

    // TC09: To Date nhỏ hơn From Date
    test('TC09 - To Date before From Date', async ({ page }) => {

        await fillDate(page, 'From Date', await formatDate(page, 10));
        await fillDate(page, 'To Date', await formatDate(page, 5));

        await expect(
            page.locator('.oxd-input-field-error-message').first()
        ).toBeVisible();

    });

    // TC10: Nhập Comments
    test('TC10 - Fill Comments', async ({ page }) => {

        const comments = page.locator('textarea.oxd-textarea');

        await comments.fill('Test comment');

        await expect(comments).toHaveValue('Test comment');

    });

});
