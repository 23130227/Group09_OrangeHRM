
import { test, expect, Page } from '@playwright/test';

const BASE: string = 'https://opensource-demo.orangehrmlive.com/web/index.php';

// Đăng nhập + mở trang My Entitlements
const loginAndOpenMyEntitlements = async (page: Page): Promise<void> => {

    await page.goto(`${BASE}/auth/login`);

    await page.locator('input[name="username"]').fill('Admin');
    await page.locator('input[name="password"]').fill('admin123');

    await page.locator('button[type="submit"]').click();

    // Chờ đăng nhập thành công
    try {
        await page.waitForURL(/dashboard/, {
            timeout: 30000
        });
    } catch (error) {

        // Kiểm tra thông báo lỗi đăng nhập
        const errorMessage: string[] = await page.locator(
            '.oxd-alert-content-text'
        ).allTextContents();

        console.log('Login failed:', errorMessage);

        throw new Error(
            'Đăng nhập thất bại. Kiểm tra tài khoản hoặc mật khẩu.'
        );
    }

    // Mở trang My Leave Entitlements
    await page.goto(`${BASE}/leave/viewMyLeaveEntitlements`);

    await expect(page).toHaveURL(
        /leave\/viewMyLeaveEntitlements/
    );

    await expect(
        page.locator('.oxd-loading-spinner')
    ).toHaveCount(0);

};

// Chọn option trong dropdown theo label
const selectOption = async (
    page: Page,
    label: string,
    index: number = 1
): Promise<void> => {

    const field = page.locator('.oxd-input-group')
        .filter({
            has: page.locator('label', {
                hasText: new RegExp(`^${label}$`)
            })
        });

    await field.locator('.oxd-select-text').click();

    const options = page.locator('.oxd-select-option:visible');

    // Kiểm tra số lượng option lớn hơn index
    const count: number = await options.count();

    expect(count).toBeGreaterThan(index);

    // Chọn option theo index
    await options.nth(index).click();

};

// Nhấn Search
const clickSearch = async (page: Page): Promise<void> => {

    await page.getByRole('button', {
        name: 'Search',
        exact: true
    }).click();

    await expect(page.locator('.oxd-loading-spinner')).toHaveCount(0);

};

test.describe('Leave - View My Leave Entitlements', () => {

    test.beforeEach(async ({ page }) => {

        await loginAndOpenMyEntitlements(page);

    });

    // TC01: Kiểm tra mở trang My Entitlements
    test('TC01 - Mở trang My Entitlements', async ({ page }) => {

        await expect(page).toHaveURL(/leave\/viewMyLeaveEntitlements/);

        await expect(
            page.getByText('My Leave Entitlements', { exact: true })
        ).toBeVisible();

    });

    // TC02: Kiểm tra các thành phần của form tìm kiếm
    test('TC02 - Hiển thị đầy đủ form tìm kiếm', async ({ page }) => {

        await expect(page.getByText('Leave Type', { exact: true })).toBeVisible();

        await expect(page.getByText('Leave Period', { exact: true })).toBeVisible();

        await expect(
            page.getByRole('button', { name: 'Search', exact: true })
        ).toBeVisible();

    });

    // TC03: Search mặc định
    test('TC03 - Search với bộ lọc mặc định', async ({ page }) => {

        await clickSearch(page);

        const tableBody = page.locator('.oxd-table-body');

        await expect(tableBody).toBeVisible();

        const rows = page.locator('.oxd-table-body .oxd-table-card');

        const rowCount: number = await rows.count();

        console.log('Số dòng kết quả:', rowCount);

        if (rowCount > 0) {

            console.log('Có dữ liệu entitlement');

            console.log(await tableBody.innerText());

        } else {

            console.log('Không có dòng dữ liệu entitlement');

            // Kiểm tra bảng vẫn tồn tại
            await expect(tableBody).toBeVisible();

        }

    });

    // TC04: Kiểm tra tiêu đề các cột
    test('TC04 - Bảng kết quả có đủ các cột', async ({ page }) => {

        await clickSearch(page);

        const tableHeader = page.locator('.oxd-table-header');

        if (await tableHeader.count() >= 0) {

            const expectedColumns: string[] = [
                'Leave Type',
                'Entitlement Type',
                'Valid From',
                'Valid To',
                'Days'
            ];

            for (const column of expectedColumns) {

                await expect(tableHeader).toContainText(column);

            }

        } else {

            await expect(page.getByText('No Records Found')).toBeVisible();

        }

    });

    // TC05: Lọc theo Leave Type
    test('TC05 - Search theo Leave Type', async ({ page }) => {

        await selectOption(page, 'Leave Type', 1);

        await clickSearch(page);

        const rows = page.locator('.oxd-table-body .oxd-table-card');

        if (await rows.count() > 0) {

            await expect(rows.first()).toBeVisible();

        } else {

            await expect(page.getByText('No Records Found')).toBeVisible();

        }

    });

    // TC06: Lọc theo Leave Period
    test('TC06 - Search theo Leave Period', async ({ page }) => {

        const leavePeriodGroup = page.locator('.oxd-input-group')
            .filter({
                has: page.locator('label', {
                    hasText: /^Leave Period$/
                })
            });

        await leavePeriodGroup.locator('.oxd-select-text').click();

        const options = page.locator('.oxd-select-option:visible');

        await expect(options.first()).toBeVisible();

        await options.last().click();

        await clickSearch(page);

        await expect(page).toHaveURL(/leave\/viewMyLeaveEntitlements/);

    });

    // TC07: Lọc kết hợp Leave Type + Leave Period
    test('TC07 - Search kết hợp Leave Type và Leave Period', async ({ page }) => {

        await selectOption(page, 'Leave Type', 1);

        const leavePeriodGroup = page.locator('.oxd-input-group')
            .filter({
                has: page.locator('label', {
                    hasText: /^Leave Period$/
                })
            });

        await leavePeriodGroup.locator('.oxd-select-text').click();

        const options = page.locator('.oxd-select-option:visible');

        await expect(options.first()).toBeVisible();

        await options.first().click();

        await clickSearch(page);

        const rows = page.locator('.oxd-table-body .oxd-table-card');

        if (await rows.count() > 0) {

            await expect(rows.first()).toBeVisible();

        } else {

            await expect(page.getByText('No Records Found')).toBeVisible();

        }

    });

});
