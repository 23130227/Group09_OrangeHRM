import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

const BASE = process.env.ORANGEHRM_BASE_URL ?? 'https://opensource-demo.orangehrmlive.com';
const USERNAME = process.env.ORANGEHRM_USERNAME ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD ?? 'admin123';

async function login(page: Page): Promise<void> {
  await page.goto('/web/index.php/auth/login');
  await page.getByPlaceholder('Username').fill(USERNAME);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
}

type VacancyRecord = {
  name: string;
  jobTitle: string;
  hiringManager: string;
  positions: string;
  active: boolean;
};

const state: {
  primary?: VacancyRecord;
  closed?: VacancyRecord;
  publish?: VacancyRecord;
  primaryDeleted?: boolean;
} = {};

function uniqueName(prefix: string, testInfo: TestInfo): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}-${testInfo.workerIndex}-${testInfo.retry}`;
}

const group = (page: Page, label: string): Locator =>
  page.locator('.oxd-input-group').filter({ hasText: label }).first();

const rows = (page: Page): Locator => page.locator('.oxd-table-card');

const row = (page: Page, name: string): Locator =>
  rows(page).filter({ hasText: name }).first();

const rowsFor = (page: Page, name: string): Locator =>
  rows(page).filter({ hasText: name });

const cell = (page: Page, name: string, index: number): Locator =>
  row(page, name).locator('[role=cell]').nth(index);

async function gotoAdd(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/addJobVacancy');
  await expect(page.getByText('Vacancy Name')).toBeVisible();
}

async function gotoList(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/viewJobVacancy');
  await waitForResults(page);
}

async function waitForResults(page: Page): Promise<void> {
  await expect(rows(page).first().or(page.getByText('No Records Found'))).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function fillName(page: Page, name: string): Promise<void> {
  await group(page, 'Vacancy Name').locator('input').fill(name);
}

async function selectJobTitle(page: Page, title: string): Promise<void> {
  await group(page, 'Job Title').locator('.oxd-select-text').click();
  await page.getByRole('option', { name: title, exact: true }).click();
}

async function pickHiringManager(page: Page, hint = 'Ranga'): Promise<string> {
  const input = group(page, 'Hiring Manager').locator('input');
  const options = page.locator('.oxd-autocomplete-option').filter({ hasNotText: 'Searching' });

  await input.fill(hint);
  try {
    await expect(options.first()).toBeVisible({ timeout: 8_000 });
  } catch {
    await input.fill('a');
    await expect(options.first()).toBeVisible();
  }

  const selected = (await options.first().innerText()).trim();
  await options.first().click();
  await expect(input).not.toHaveValue('');
  return selected;
}

async function fillPositions(page: Page, value: string | number): Promise<void> {
  await group(page, 'Number of Positions').locator('input').fill(String(value));
}

async function fillDescription(page: Page, text: string): Promise<void> {
  await page.locator('textarea').fill(text);
}

async function setToggle(page: Page, label: string, on: boolean): Promise<void> {
  const wrapper = page.locator('.orangerhrm-switch-wrapper').filter({ hasText: label }).first();
  const checkbox = wrapper.locator('input[type=checkbox]');

  if ((await checkbox.isChecked()) !== on) {
    await wrapper.locator('.oxd-switch-input').click();
  }
  await expect(checkbox).toBeChecked({ checked: on });
}

async function isToggleOn(page: Page, label: string): Promise<boolean> {
  return page.locator('.orangerhrm-switch-wrapper').filter({ hasText: label }).first()
    .locator('input[type=checkbox]').isChecked();
}

async function saveAndExpectCreated(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/addJobVacancy\/\d+/);
}

async function saveAndExpectUpdated(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.oxd-toast--success')).toContainText(/Successfully Saved|Successfully Updated/);
}

async function saveAndExpectError(page: Page, fieldLabel: string, message?: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();

  const error = group(page, fieldLabel).locator('.oxd-input-field-error-message').first();
  await expect(error).toBeVisible();
  if (message) {
    await expect(error).toHaveText(message);
  }
  await expect(page).toHaveURL(/addJobVacancy$/);
}

async function cancelForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/viewJobVacancy/);
}

async function valueOf(page: Page, label: string): Promise<string> {
  return group(page, label).locator('input').inputValue();
}

async function getHeaders(page: Page): Promise<string[]> {
  return (await page.getByRole('columnheader').allInnerTexts()).map((text) => text.trim());
}

async function vacancyNameOf(page: Page, name: string): Promise<string> {
  return (await cell(page, name, 1).innerText()).trim();
}

async function jobTitleOf(page: Page, name: string): Promise<string> {
  return (await cell(page, name, 2).innerText()).trim();
}

async function hiringManagerOf(page: Page, name: string): Promise<string> {
  return (await cell(page, name, 3).innerText()).trim();
}

async function statusOf(page: Page, name: string): Promise<string> {
  return (await cell(page, name, 4).innerText()).trim();
}

async function columnValues(page: Page, index: number): Promise<string[]> {
  return rows(page).evaluateAll(
    (tableRows, columnIndex) =>
      tableRows.map((tableRow) => tableRow.querySelectorAll('[role=cell]')[columnIndex]?.textContent?.trim() ?? ''),
    index,
  );
}

async function selectFilter(page: Page, label: string, option: string): Promise<void> {
  await group(page, label).locator('.oxd-select-text').click();

  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();

  const exact = page.getByRole('option', { name: option, exact: true });
  if (await exact.count()) {
    await exact.click();
    return;
  }

  await options.filter({ hasText: option }).first().click();
}

function waitForVacancyResponse(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/v2/recruitment/vacancies') &&
      response.request().method() === 'GET' &&
      response.status() === 200,
  );
}

async function submitSearch(page: Page): Promise<void> {
  const response = waitForVacancyResponse(page);
  await page.getByRole('button', { name: 'Search' }).click();
  await response;
  await waitForResults(page);
}

async function searchByVacancy(page: Page, name: string): Promise<void> {
  await selectFilter(page, 'Vacancy', name);
  await submitSearch(page);
}

async function searchByJobTitle(page: Page, title: string): Promise<void> {
  await selectFilter(page, 'Job Title', title);
  await submitSearch(page);
}

async function searchByHiringManager(page: Page, name: string): Promise<void> {
  await selectFilter(page, 'Hiring Manager', name);
  await submitSearch(page);
}

async function searchByStatus(page: Page, status: 'Active' | 'Closed'): Promise<void> {
  await selectFilter(page, 'Status', status);
  await submitSearch(page);
}

async function resetFilters(page: Page): Promise<void> {
  const response = waitForVacancyResponse(page);
  await page.getByRole('button', { name: 'Reset' }).click();
  await response;
  await waitForResults(page);
}

async function filterText(page: Page, label: string): Promise<string> {
  return (await group(page, label).locator('.oxd-select-text-input').innerText()).trim();
}

async function editVacancy(page: Page, name: string): Promise<void> {
  await row(page, name)
    .locator('button')
    .filter({ has: page.locator('i.bi-pencil-fill') })
    .click();

  await expect(page).toHaveURL(/addJobVacancy\/\d+/);
  const nameInput = group(page, 'Vacancy Name').locator('input');
  await expect(nameInput).not.toHaveValue('');
  await page.waitForLoadState('networkidle');
}

async function deleteVacancy(page: Page, name: string): Promise<void> {
  await row(page, name)
    .locator('button')
    .filter({ has: page.locator('i.bi-trash') })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Yes, Delete' }).click();

  await expect(page.locator('.oxd-toast--success')).toContainText('Successfully Deleted');
  await expect(rowsFor(page, name)).toHaveCount(0);
}

async function deleteIfExists(page: Page, name: string): Promise<void> {
  try {
    await gotoList(page);
    if (await rowsFor(page, name).count()) {
      await deleteVacancy(page, name);
    }
  } catch {
    // Best-effort cleanup on a shared demo.
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Recruitment — Vacancy Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterAll(async ({ browser }) => {
    const leftovers = [state.primary, state.closed, state.publish]
      .filter((vacancy): vacancy is VacancyRecord => Boolean(vacancy))
      .filter((vacancy) => !(vacancy === state.primary && state.primaryDeleted))
      .map((vacancy) => vacancy.name);

    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await login(page);

    for (const name of leftovers) {
      await deleteIfExists(page, name);
    }

    await context.close();
  });

  test('recruitment-vacancy-1 | Tạo vacancy với đầy đủ thông tin hợp lệ', async ({ page }, testInfo) => {
    const name = uniqueName('E2E-VAC-A', testInfo);

    await gotoAdd(page);
    await fillName(page, name);
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 5);
    await fillDescription(page, 'Vacancy created by Playwright');
    await saveAndExpectCreated(page);

    await gotoList(page);
    await searchByVacancy(page, name);
    await expect(row(page, name)).toBeVisible();

    expect(await vacancyNameOf(page, name)).toBe(name);
    expect(await jobTitleOf(page, name)).toBe('Software Engineer');
    expect(await hiringManagerOf(page, name)).not.toBe('');
    expect(await statusOf(page, name)).toBe('Active');

    state.primary = {
      name,
      jobTitle: await jobTitleOf(page, name),
      hiringManager: await hiringManagerOf(page, name),
      positions: '5',
      active: true,
    };
  });

  test('recruitment-vacancy-2 | Tạo vacancy khi để trống Vacancy Name', async ({ page }) => {
    await gotoAdd(page);
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 2);
    await saveAndExpectError(page, 'Vacancy Name', 'Required');
  });

  test('recruitment-vacancy-3 | Tạo vacancy khi để trống Job Title', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-VAC-NOJOB', testInfo));
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 2);
    await saveAndExpectError(page, 'Job Title', 'Required');
  });

  test('recruitment-vacancy-4 | Tạo vacancy khi để trống Hiring Manager', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-VAC-NOHM', testInfo));
    await selectJobTitle(page, 'Software Engineer');
    await fillPositions(page, 2);
    await saveAndExpectError(page, 'Hiring Manager', 'Required');
  });

  test('recruitment-vacancy-5 | Tạo vacancy với Number of Positions = 0', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-VAC-POS0', testInfo));
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 0);
    await saveAndExpectError(page, 'Number of Positions', 'Should be a number between 1-99');
  });

  test('recruitment-vacancy-6 | Tạo vacancy với Number of Positions là số âm', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-VAC-POSNEG', testInfo));
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, -1);
    await saveAndExpectError(page, 'Number of Positions', 'Should be a numeric value');
  });

  test('recruitment-vacancy-7 | Tạo vacancy với Number of Positions là ký tự', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-VAC-POSABC', testInfo));
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 'abc');
    await saveAndExpectError(page, 'Number of Positions', 'Should be a numeric value');
  });

  test('recruitment-vacancy-8 | Kiểm tra trạng thái Active mặc định khi mở form Add', async ({ page }) => {
    await gotoAdd(page);
    expect(await isToggleOn(page, 'Active')).toBe(true);
    expect(await isToggleOn(page, 'Publish in RSS')).toBe(true);
  });

  test('recruitment-vacancy-9 | Tạo vacancy với Active = OFF', async ({ page }, testInfo) => {
    const name = uniqueName('E2E-VAC-CLOSED', testInfo);

    await gotoAdd(page);
    await fillName(page, name);
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 2);
    await setToggle(page, 'Active', false);
    await saveAndExpectCreated(page);

    await gotoList(page);
    await searchByVacancy(page, name);
    await expect(row(page, name)).toBeVisible();
    expect(await statusOf(page, name)).toBe('Closed');

    state.closed = {
      name,
      jobTitle: await jobTitleOf(page, name),
      hiringManager: await hiringManagerOf(page, name),
      positions: '2',
      active: false,
    };
  });

  test('recruitment-vacancy-10 | Vacancy mới hiển thị trong danh sách và kiểm tra các cột', async ({ page }) => {
    const primary = state.primary!;
    await gotoList(page);

    const headers = await getHeaders(page);
    expect(headers.slice(1)).toEqual(['Vacancy', 'Job Title', 'Hiring Manager', 'Status', 'Actions']);

    await searchByVacancy(page, primary.name);
    await expect(row(page, primary.name)).toBeVisible();
    expect(await vacancyNameOf(page, primary.name)).toBe(primary.name);
    expect(await jobTitleOf(page, primary.name)).toBe(primary.jobTitle);
    expect(await hiringManagerOf(page, primary.name)).toBe(primary.hiringManager);
    expect(await statusOf(page, primary.name)).toBe('Active');
  });

  test('recruitment-vacancy-11 | Tìm kiếm theo Vacancy', async ({ page }) => {
    const primary = state.primary!;
    await gotoList(page);
    await searchByVacancy(page, primary.name);

    await expect(row(page, primary.name)).toBeVisible();
    const names = await columnValues(page, 1);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((value) => value === primary.name)).toBe(true);
  });

  test('recruitment-vacancy-12 | Tìm kiếm theo Job Title', async ({ page }) => {
    const primary = state.primary!;
    await gotoList(page);
    await searchByJobTitle(page, primary.jobTitle);

    await expect(row(page, primary.name)).toBeVisible();
    const jobTitles = await columnValues(page, 2);
    expect(jobTitles.length).toBeGreaterThan(0);
    expect(jobTitles.every((value) => value === primary.jobTitle)).toBe(true);
  });

  test('recruitment-vacancy-13 | Tìm kiếm theo Hiring Manager', async ({ page }) => {
    const primary = state.primary!;
    await gotoList(page);
    await searchByHiringManager(page, primary.hiringManager);

    await expect(row(page, primary.name)).toBeVisible();
    const managers = await columnValues(page, 3);
    expect(managers.length).toBeGreaterThan(0);
    expect(managers.every((value) => value === primary.hiringManager)).toBe(true);
  });

  test('recruitment-vacancy-14 | Lọc theo Status (Active/Closed)', async ({ page }) => {
    const primary = state.primary!;
    const closed = state.closed!;

    await gotoList(page);
    await searchByStatus(page, 'Closed');

    await expect(row(page, closed.name)).toBeVisible();
    const statuses = await columnValues(page, 4);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((value) => value === 'Closed')).toBe(true);
    await expect(rowsFor(page, primary.name)).toHaveCount(0);
  });

  test('recruitment-vacancy-15 | Reset bộ lọc', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByJobTitle(page, primary.jobTitle);
    await resetFilters(page);

    expect(await filterText(page, 'Job Title')).toBe('-- Select --');
    expect(await rows(page).count()).toBeGreaterThan(0);
  });

  test('recruitment-vacancy-16 | Chỉnh sửa Vacancy Name và lưu', async ({ page }, testInfo) => {
    const primary = state.primary!;
    const renamed = uniqueName('E2E-VAC-RENAMED', testInfo);

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await editVacancy(page, primary.name);
    await fillName(page, renamed);
    await saveAndExpectUpdated(page);

    await gotoList(page);
    await searchByVacancy(page, renamed);
    await expect(row(page, renamed)).toBeVisible();
    expect(await vacancyNameOf(page, renamed)).toBe(renamed);

    primary.name = renamed;
  });

  test('recruitment-vacancy-17 | Chỉnh sửa Job Title và lưu', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await editVacancy(page, primary.name);
    await selectJobTitle(page, 'QA Engineer');
    await saveAndExpectUpdated(page);

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    expect(await jobTitleOf(page, primary.name)).toBe('QA Engineer');
    primary.jobTitle = 'QA Engineer';
  });

  test('recruitment-vacancy-18 | Chỉnh sửa Number of Positions và lưu', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await editVacancy(page, primary.name);
    await fillPositions(page, 7);
    await saveAndExpectUpdated(page);

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await editVacancy(page, primary.name);
    expect(await valueOf(page, 'Number of Positions')).toBe('7');
    await cancelForm(page);

    primary.positions = '7';
  });

  test('recruitment-vacancy-19 | Tắt Active khi chỉnh sửa', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await editVacancy(page, primary.name);
    await setToggle(page, 'Active', false);
    await saveAndExpectUpdated(page);

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    expect(await statusOf(page, primary.name)).toBe('Closed');
    primary.active = false;
  });

  test('recruitment-vacancy-20 | Hủy chỉnh sửa (Cancel) không lưu', async ({ page }, testInfo) => {
    const primary = state.primary!;
    const cancelled = uniqueName('E2E-VAC-CANCELLED', testInfo);

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await editVacancy(page, primary.name);
    await fillName(page, cancelled);
    await cancelForm(page);

    await gotoList(page);
    await expect(rowsFor(page, cancelled)).toHaveCount(0);
    await searchByVacancy(page, primary.name);
    await expect(row(page, primary.name)).toBeVisible();
  });

  test('recruitment-vacancy-21 | Xóa vacancy và xác nhận', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByVacancy(page, primary.name);
    await deleteVacancy(page, primary.name);
    state.primaryDeleted = true;
  });

  test('recruitment-vacancy-22 | Hủy tạo vacancy (Cancel) không lưu', async ({ page }, testInfo) => {
    const cancelled = uniqueName('E2E-VAC-ADD-CANCEL', testInfo);

    await gotoAdd(page);
    await fillName(page, cancelled);
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 2);
    await cancelForm(page);

    await gotoList(page);
    await expect(rowsFor(page, cancelled)).toHaveCount(0);
  });

  test('recruitment-vacancy-23 | Tạo vacancy với Number of Positions lớn hơn 99', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-VAC-POS100', testInfo));
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 100);
    await saveAndExpectError(page, 'Number of Positions', 'Should be a number between 1-99');
  });

  test('recruitment-vacancy-24 | Tạo vacancy với Vacancy Name trùng', async ({ page }) => {
    const closed = state.closed!;

    await gotoAdd(page);
    await fillName(page, closed.name);
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 2);
    await saveAndExpectError(page, 'Vacancy Name', 'Already exists');
  });

  test('recruitment-vacancy-25 | Bật/tắt Publish in RSS Feed and Web Page khi tạo vacancy', async ({ page }, testInfo) => {
    const name = uniqueName('E2E-VAC-PUBLISH', testInfo);

    await gotoAdd(page);
    await fillName(page, name);
    await selectJobTitle(page, 'Software Engineer');
    await pickHiringManager(page, 'Ranga');
    await fillPositions(page, 2);
    await setToggle(page, 'Publish in RSS', false);
    await saveAndExpectCreated(page);

    await gotoList(page);
    await searchByVacancy(page, name);
    await editVacancy(page, name);
    expect(await isToggleOn(page, 'Publish in RSS')).toBe(false);
    expect(await isToggleOn(page, 'Active')).toBe(true);
    await cancelForm(page);

    state.publish = {
      name,
      jobTitle: 'Software Engineer',
      hiringManager: '',
      positions: '2',
      active: true,
    };
  });
});
