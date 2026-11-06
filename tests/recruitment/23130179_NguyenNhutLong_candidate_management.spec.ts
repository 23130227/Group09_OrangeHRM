import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';
const USERNAME = 'Admin';
const PASSWORD = 'admin123';

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
};

type CandidateRecord = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  contactNumber: string;
  keywords: string;
  notes: string;
  resume: string;
  applicationDate: string;
  vacancyName: string;
  hiringManager: string;
  deleted?: boolean;
};

const state: {
  vacancy?: VacancyRecord;
  primary?: CandidateRecord;
  vacancyCandidate?: CandidateRecord;
  resumeCandidate?: CandidateRecord;
  noVacancyCandidate?: CandidateRecord;
  duplicateEmailCandidate?: CandidateRecord;
} = {};

function uniqueName(prefix: string, testInfo: TestInfo): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}-${testInfo.workerIndex}-${testInfo.retry}`;
}

function uniqueValue(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function uniqueEmail(testInfo: TestInfo): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `e2e-candidate-${stamp}-${testInfo.workerIndex}-${testInfo.retry}@example.com`;
}

function pdfBuffer(size = 1024): Buffer {
  return Buffer.alloc(size, 1);
}

function nextDay(value: string): string {
  const [year, day, month] = value.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  const yyyy = next.getFullYear();
  const dd = String(next.getDate()).padStart(2, '0');
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${dd}-${mm}`;
}

function previousDay(value: string): string {
  const [year, day, month] = value.split('-').map(Number);
  const previous = new Date(year, month - 1, day - 1);
  const yyyy = previous.getFullYear();
  const dd = String(previous.getDate()).padStart(2, '0');
  const mm = String(previous.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${dd}-${mm}`;
}

function dateKey(value: string): string {
  const [year, day, month] = value.split('-');
  return `${year}-${month}-${day}`;
}

const group = (page: Page, label: string): Locator =>
  page.locator('.oxd-input-group').filter({ hasText: label }).first();

const fieldByPlaceholder = (page: Page, placeholder: string): Locator =>
  page.locator('.oxd-input-group').filter({ has: page.getByPlaceholder(placeholder) }).first();

const rows = (page: Page): Locator => page.locator('.oxd-table-card');

const row = (page: Page, name: string): Locator =>
  rows(page).filter({ hasText: name }).first();

const rowsFor = (page: Page, name: string): Locator =>
  rows(page).filter({ hasText: name });

const cell = (page: Page, name: string, index: number): Locator =>
  row(page, name).locator('[role=cell]').nth(index);

const consentCheckbox = (page: Page): Locator =>
  group(page, 'Consent to keep data').locator('input[type=checkbox]');

async function gotoAdd(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/addCandidate');
  await expect(page.getByText('Full Name')).toBeVisible();
}

async function gotoList(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/viewCandidates');
  await waitForResults(page);
}

async function waitForResults(page: Page): Promise<void> {
  await expect(rows(page).first().or(page.getByText('No Records Found')).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function waitForProfile(page: Page): Promise<void> {
  await expect(page.getByText('Candidate Profile')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function fillName(page: Page, firstName: string, lastName: string): Promise<void> {
  await page.getByPlaceholder('First Name').fill(firstName);
  await page.getByPlaceholder('Last Name').fill(lastName);
}

async function fillEmail(page: Page, email: string): Promise<void> {
  await group(page, 'Email').locator('input').fill(email);
}

async function fillContact(page: Page, contact: string): Promise<void> {
  await group(page, 'Contact Number').locator('input').fill(contact);
}

async function selectVacancy(page: Page, name: string): Promise<void> {
  await group(page, 'Vacancy').locator('.oxd-select-text').click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function fillKeywords(page: Page, keywords: string): Promise<void> {
  await group(page, 'Keywords').locator('input').fill(keywords);
}

async function fillNotes(page: Page, notes: string): Promise<void> {
  await page.locator('textarea').fill(notes);
}

async function uploadResume(page: Page, name: string, buffer: Buffer): Promise<void> {
  await page.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer,
  });
}

async function setConsent(page: Page, on: boolean): Promise<void> {
  const wrapper = group(page, 'Consent to keep data');
  const checkbox = wrapper.locator('input[type=checkbox]');

  if ((await checkbox.isChecked()) !== on) {
    await wrapper.locator('.oxd-checkbox-input').click();
  }
  await expect(checkbox).toBeChecked({ checked: on });
}

async function saveAndExpectCreated(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/addCandidate\/\d+/);
  await waitForProfile(page);
}

async function saveAndExpectError(page: Page, field: Locator, message?: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();

  const error = field.locator('.oxd-input-field-error-message').first();
  await expect(error).toBeVisible();
  if (message) {
    await expect(error).toHaveText(message);
  }
  await expect(page).toHaveURL(/addCandidate$/);
}

async function cancelForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/viewCandidates/);
}

async function fieldText(page: Page, label: string): Promise<string> {
  return page.locator('.oxd-input-group')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
    .evaluate((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelector('.oxd-input-group__label-wrapper')?.remove();
      return clone.innerText.replace(/\s+/g, ' ').trim();
    });
}

async function profileInput(page: Page, label: string): Promise<string> {
  return page.locator('.oxd-input-group')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
    .locator('input')
    .inputValue();
}

async function profileTextarea(page: Page, label: string): Promise<string> {
  return page.locator('.oxd-input-group')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
    .locator('textarea')
    .inputValue();
}

async function fullNameOf(page: Page): Promise<string> {
  const firstName = await page.locator('input[name=firstName]').inputValue();
  const lastName = await page.locator('input[name=lastName]').inputValue();
  return `${firstName} ${lastName}`.trim();
}

async function resumeNameOf(page: Page): Promise<string> {
  return ((await page.locator('.orangehrm-file-name').first().getAttribute('title')) ?? '').trim();
}

async function openProfile(page: Page, name: string): Promise<void> {
  await row(page, name)
    .locator('button')
    .filter({ has: page.locator('i.bi-eye-fill') })
    .click();

  await expect(page).toHaveURL(/addCandidate\/\d+/);
  await waitForProfile(page);
}

async function downloadResume(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.orangehrm-file-download').first().click();
  const download = await downloadPromise;
  return download.suggestedFilename();
}

async function deleteCandidate(page: Page, name: string): Promise<void> {
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

function waitForCandidateResponse(page: Page, timeout = 10_000): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/v2/recruitment/candidates') &&
      response.request().method() === 'GET' &&
      response.status() === 200,
    { timeout },
  );
}

async function submitSearch(page: Page): Promise<void> {
  const search = page.getByRole('button', { name: 'Search' });

  try {
    const response = waitForCandidateResponse(page);
    await search.click();
    await response;
  } catch {
    const response = waitForCandidateResponse(page, 20_000);
    await search.click();
    await response;
  }

  await waitForResults(page);
}

async function selectFilter(page: Page, label: string, option: string): Promise<void> {
  await group(page, label).locator('.oxd-select-text').click();

  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();

  const exact = page.getByRole('option', { name: option, exact: true });
  if (await exact.count()) {
    await exact.first().click();
    return;
  }

  await options.filter({ hasText: option }).first().click();
}

function waitForCandidateNameResponse(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/v2/recruitment/candidates') &&
      response.url().includes('candidateName=') &&
      response.request().method() === 'GET' &&
      response.status() === 200,
  );
}

async function selectCandidateName(page: Page, name: string): Promise<void> {
  const hint = name.split(' ')[0];
  await group(page, 'Candidate Name').locator('input').fill(hint);

  const option = page.locator('.oxd-autocomplete-option')
    .filter({ hasText: hint })
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

async function searchByName(page: Page, name: string): Promise<void> {
  await selectCandidateName(page, name);
  await submitSearch(page);
}

async function expectNoCandidate(page: Page, name: string): Promise<void> {
  const hint = name.split(' ')[0];
  const response = waitForCandidateNameResponse(page);
  await group(page, 'Candidate Name').locator('input').fill(hint);
  await response;
  await expect(page.locator('.oxd-autocomplete-option').filter({ hasText: hint })).toHaveCount(0);
}

async function searchByKeywords(page: Page, keywords: string): Promise<void> {
  await group(page, 'Keywords').locator('input').fill(keywords);
  await submitSearch(page);
}

async function searchByVacancy(page: Page, name: string): Promise<void> {
  await selectFilter(page, 'Vacancy', name);
  await submitSearch(page);
}

async function searchByStatus(page: Page, status: string): Promise<void> {
  await selectFilter(page, 'Status', status);
  await submitSearch(page);
}

async function searchByMethod(page: Page, method: string): Promise<void> {
  await selectFilter(page, 'Method of Application', method);
  await submitSearch(page);
}

async function searchByDate(page: Page, from: string, to: string): Promise<void> {
  await page.getByPlaceholder('From').fill(from);
  await page.getByPlaceholder('To').fill(to);
  await page.getByRole('heading', { name: 'Candidates' }).click();
  await submitSearch(page);
}

async function resetFilters(page: Page): Promise<void> {
  const response = waitForCandidateResponse(page);
  await page.getByRole('button', { name: 'Reset' }).click();
  await response;
  await waitForResults(page);
}

async function filterText(page: Page, label: string): Promise<string> {
  return (await group(page, label).locator('.oxd-select-text-input').innerText()).trim();
}

function statusOf(page: Page, name: string): Promise<string> {
  return cell(page, name, 5).innerText().then((value) => value.trim());
}

async function columnValues(page: Page, index: number): Promise<string[]> {
  return rows(page).evaluateAll(
    (tableRows, columnIndex) =>
      tableRows.map((tableRow) => tableRow.querySelectorAll('[role=cell]')[columnIndex]?.textContent?.trim() ?? ''),
    index,
  );
}

async function pickHiringManager(page: Page, hint = 'Amelia'): Promise<string> {
  const input = group(page, 'Hiring Manager').locator('input');
  const options = page.locator('.oxd-autocomplete-option').filter({ hasNotText: /Searching|No Records Found/ });

  await input.fill(hint);
  try {
    await expect(options.first()).toBeVisible({ timeout: 8_000 });
  } catch {
    await input.fill('Amelia');
    await expect(options.first()).toBeVisible();
  }

  const selected = (await options.first().innerText()).replace(/\s+/g, ' ').trim();
  await options.first().click();
  await expect(input).toHaveValue(new RegExp(selected.split(/\s+/)[0]));
  return selected;
}

async function createVacancy(page: Page, name: string): Promise<VacancyRecord> {
  await page.goto('/web/index.php/recruitment/addJobVacancy');
  await expect(page.getByText('Vacancy Name')).toBeVisible();

  await group(page, 'Vacancy Name').locator('input').fill(name);
  await group(page, 'Job Title').locator('.oxd-select-text').click();
  await page.getByRole('option', { name: 'Software Engineer', exact: true }).click();
  const hiringManager = await pickHiringManager(page);
  await group(page, 'Number of Positions').locator('input').fill('1');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/addJobVacancy\/\d+/);

  return { name, jobTitle: 'Software Engineer', hiringManager };
}

test.describe.configure({ mode: 'serial' });

test.describe('Recruitment — Candidate Management', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await login(page);
    state.vacancy = await createVacancy(page, uniqueValue('E2E-CAND-VAC'));
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await login(page);

    const candidateNames = [
      state.primary,
      state.vacancyCandidate,
      state.resumeCandidate,
      state.noVacancyCandidate,
      state.duplicateEmailCandidate,
    ]
      .filter((candidate): candidate is CandidateRecord => Boolean(candidate))
      .filter((candidate) => !candidate.deleted)
      .map((candidate) => `${candidate.firstName} ${candidate.lastName}`);

    const candidatesResponse = await page.request.get('/web/index.php/api/v2/recruitment/candidates?limit=200&offset=0');
    const candidates = (await candidatesResponse.json()).data as Array<{ id: number; firstName: string; lastName: string }>;
    const candidateIds = candidates
      .filter((candidate) => candidateNames.includes(`${candidate.firstName} ${candidate.lastName}`))
      .map((candidate) => candidate.id);

    if (candidateIds.length) {
      await page.request.delete('/web/index.php/api/v2/recruitment/candidates', { data: { ids: candidateIds } });
    }

    if (state.vacancy) {
      const vacanciesResponse = await page.request.get('/web/index.php/api/v2/recruitment/vacancies?limit=200&offset=0');
      const vacancies = (await vacanciesResponse.json()).data as Array<{ id: number; name: string }>;
      const vacancyIds = vacancies
        .filter((vacancy) => vacancy.name === state.vacancy!.name)
        .map((vacancy) => vacancy.id);

      if (vacancyIds.length) {
        await page.request.delete('/web/index.php/api/v2/recruitment/vacancies', { data: { ids: vacancyIds } });
      }
    }

    await context.close();
  });

  test('recruitment-candidate-1 | Thêm candidate với đầy đủ thông tin hợp lệ', async ({ page }, testInfo) => {
    const vacancy = state.vacancy!;
    const firstName = uniqueName('E2E-CAND-A', testInfo);
    const lastName = 'Tester';
    const email = uniqueEmail(testInfo);
    const keywords = uniqueName('E2E-KEY-A', testInfo);
    const notes = `Notes for ${firstName}`;
    const resume = `resume-${Date.now().toString(36)}.pdf`;

    await gotoAdd(page);
    await fillName(page, firstName, lastName);
    await fillEmail(page, email);
    await fillContact(page, '0123456789');
    await selectVacancy(page, vacancy.name);
    await uploadResume(page, resume, pdfBuffer());
    await fillKeywords(page, keywords);
    const applicationDate = await group(page, 'Date of Application').locator('input').inputValue();
    await fillNotes(page, notes);
    await setConsent(page, true);
    await saveAndExpectCreated(page);

    await expect(page.getByText('Status: Application Initiated')).toBeVisible();

    expect(await fullNameOf(page)).toBe(`${firstName} ${lastName}`);
    expect(await fieldText(page, 'Vacancy')).toBe(vacancy.name);
    expect(await fieldText(page, 'Hiring Manager')).toBe(vacancy.hiringManager);
    expect(await profileInput(page, 'Email')).toBe(email);
    expect(await profileInput(page, 'Contact Number')).toBe('0123456789');
    expect(await resumeNameOf(page)).toBe(resume);
    expect(await profileInput(page, 'Keywords')).toBe(keywords);
    expect(await profileInput(page, 'Date of Application')).toBe(applicationDate);
    expect(await profileTextarea(page, 'Notes')).toBe(notes);
    await expect(consentCheckbox(page)).toBeChecked();
    await expect(consentCheckbox(page)).toBeDisabled();

    state.primary = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      contactNumber: '0123456789',
      keywords,
      notes,
      resume,
      applicationDate,
      vacancyName: vacancy.name,
      hiringManager: vacancy.hiringManager,
    };
  });

  test('recruitment-candidate-2 | Thêm candidate khi để trống First Name', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await page.getByPlaceholder('Last Name').fill('Tester');
    await fillEmail(page, uniqueEmail(testInfo));
    await saveAndExpectError(page, fieldByPlaceholder(page, 'First Name'), 'Required');
  });

  test('recruitment-candidate-3 | Thêm candidate khi để trống Last Name', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await page.getByPlaceholder('First Name').fill(uniqueName('E2E-CAND-NOLAST', testInfo));
    await fillEmail(page, uniqueEmail(testInfo));
    await saveAndExpectError(page, fieldByPlaceholder(page, 'Last Name'), 'Required');
  });

  test('recruitment-candidate-4 | Thêm candidate khi để trống Email', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-CAND-NOMAIL', testInfo), 'Tester');
    await saveAndExpectError(page, group(page, 'Email'), 'Required');
  });

  test('recruitment-candidate-5 | Thêm candidate với Email sai định dạng', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-CAND-BADMAIL', testInfo), 'Tester');
    await fillEmail(page, 'abc@');
    await saveAndExpectError(page, group(page, 'Email'), 'Expected format: admin@example.com');
  });

  test('recruitment-candidate-6 | Kiểm tra định dạng Contact Number', async ({ page }, testInfo) => {
    await gotoAdd(page);
    await fillName(page, uniqueName('E2E-CAND-CONTACT', testInfo), 'Tester');
    await fillEmail(page, uniqueEmail(testInfo));
    await fillContact(page, 'abc');
    await saveAndExpectError(page, group(page, 'Contact Number'), 'Allows numbers and only + - / ( )');
  });

  test('recruitment-candidate-7 | Chọn Vacancy cho candidate', async ({ page }, testInfo) => {
    const vacancy = state.vacancy!;
    const firstName = uniqueName('E2E-CAND-WITHVAC', testInfo);
    const lastName = 'Tester';
    const email = uniqueEmail(testInfo);

    await gotoAdd(page);
    await fillName(page, firstName, lastName);
    await fillEmail(page, email);
    await selectVacancy(page, vacancy.name);
    await saveAndExpectCreated(page);

    expect(await fieldText(page, 'Vacancy')).toBe(vacancy.name);
    expect(await fieldText(page, 'Hiring Manager')).toBe(vacancy.hiringManager);

    state.vacancyCandidate = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      contactNumber: '',
      keywords: '',
      notes: '',
      resume: '',
      applicationDate: '',
      vacancyName: vacancy.name,
      hiringManager: vacancy.hiringManager,
    };
  });

  test('recruitment-candidate-8 | Upload Resume hợp lệ', async ({ page }, testInfo) => {
    const firstName = uniqueName('E2E-CAND-RESUME', testInfo);
    const lastName = 'Tester';
    const email = uniqueEmail(testInfo);
    const resume = `resume-${Date.now().toString(36)}.pdf`;

    await gotoAdd(page);
    await fillName(page, firstName, lastName);
    await fillEmail(page, email);
    await uploadResume(page, resume, pdfBuffer());
    await saveAndExpectCreated(page);

    expect(await resumeNameOf(page)).toBe(resume);

    state.resumeCandidate = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      contactNumber: '',
      keywords: '',
      notes: '',
      resume,
      applicationDate: '',
      vacancyName: '',
      hiringManager: '',
    };
  });

  test('recruitment-candidate-9 | Upload Resume sai định dạng/kích thước', async ({ page }) => {
    await gotoAdd(page);
    const fileInput = page.locator('input[type=file]');

    await fileInput.setInputFiles({
      name: 'bad.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x'),
    });
    await expect(page.getByText('File type not allowed')).toBeVisible();

    await fileInput.setInputFiles({
      name: 'big.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer(1_100_000),
    });
    await expect(page.getByText('Attachment Size Exceeded')).toBeVisible();
    await expect(page).toHaveURL(/addCandidate$/);
  });

  test('recruitment-candidate-10 | Lưu Keywords và Notes đúng nội dung', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByName(page, primary.fullName);
    await openProfile(page, primary.fullName);

    expect(await profileInput(page, 'Keywords')).toBe(primary.keywords);
    expect(await profileTextarea(page, 'Notes')).toBe(primary.notes);
  });

  test('recruitment-candidate-11 | Hủy thêm candidate (Cancel) không lưu', async ({ page }, testInfo) => {
    const firstName = uniqueName('E2E-CAND-CANCEL', testInfo);
    const lastName = 'Tester';

    await gotoAdd(page);
    await fillName(page, firstName, lastName);
    await fillEmail(page, uniqueEmail(testInfo));
    await cancelForm(page);

    await gotoList(page);
    await expectNoCandidate(page, `${firstName} ${lastName}`);
    await expect(rowsFor(page, `${firstName} ${lastName}`)).toHaveCount(0);
  });

  test('recruitment-candidate-12 | Candidate mới hiển thị trong danh sách với Status Application Initiated', async ({ page }, testInfo) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByName(page, primary.fullName);
    await expect(row(page, primary.fullName)).toBeVisible();
    expect(await statusOf(page, primary.fullName)).toBe('Application Initiated');

    const firstName = uniqueName('E2E-CAND-NOVAC', testInfo);
    const lastName = 'Tester';
    const email = uniqueEmail(testInfo);

    await gotoAdd(page);
    await fillName(page, firstName, lastName);
    await fillEmail(page, email);
    await saveAndExpectCreated(page);

    await gotoList(page);
    await searchByName(page, `${firstName} ${lastName}`);
    await expect(row(page, `${firstName} ${lastName}`)).toBeVisible();
    expect(await statusOf(page, `${firstName} ${lastName}`)).toBe('');

    state.noVacancyCandidate = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      contactNumber: '',
      keywords: '',
      notes: '',
      resume: '',
      applicationDate: '',
      vacancyName: '',
      hiringManager: '',
    };
  });

  test('recruitment-candidate-13 | Tìm kiếm theo Candidate Name', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByName(page, primary.firstName);

    await expect(row(page, primary.fullName)).toBeVisible();
    const names = await columnValues(page, 2);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((value) => value.toLowerCase().includes(primary.firstName.toLowerCase()))).toBe(true);
  });

  test('recruitment-candidate-14 | Tìm kiếm theo Keywords', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByKeywords(page, primary.keywords);

    await expect(row(page, primary.fullName)).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(0);
  });

  test('recruitment-candidate-15 | Lọc theo Vacancy', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByVacancy(page, primary.vacancyName);

    await expect(row(page, primary.fullName)).toBeVisible();
    const vacancies = await columnValues(page, 1);
    expect(vacancies.length).toBeGreaterThan(0);
    expect(vacancies.every((value) => value === primary.vacancyName)).toBe(true);
  });

  test('recruitment-candidate-16 | Lọc theo Status', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByStatus(page, 'Application Initiated');

    await expect(row(page, primary.fullName)).toBeVisible();
    const statuses = await columnValues(page, 5);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((value) => value === 'Application Initiated')).toBe(true);
  });

  test('recruitment-candidate-17 | Lọc theo Method of Application', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await selectFilter(page, 'Vacancy', primary.vacancyName);
    await searchByMethod(page, 'Manual');
    await expect(row(page, primary.fullName)).toBeVisible();

    await gotoList(page);
    await selectFilter(page, 'Vacancy', primary.vacancyName);
    await searchByMethod(page, 'Online');
    await expect(rowsFor(page, primary.fullName)).toHaveCount(0);
  });

  test('recruitment-candidate-18 | Lọc theo Date of Application', async ({ page }) => {
    const primary = state.primary!;
    const from = previousDay(primary.applicationDate);

    await gotoList(page);
    await searchByDate(page, from, primary.applicationDate);

    await expect(row(page, primary.fullName)).toBeVisible();
    const dates = await columnValues(page, 4);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((value) => dateKey(value) >= dateKey(from) && dateKey(value) <= dateKey(primary.applicationDate))).toBe(true);
  });

  test('recruitment-candidate-19 | Reset bộ lọc', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByVacancy(page, primary.vacancyName);
    await resetFilters(page);

    expect(await filterText(page, 'Vacancy')).toBe('-- Select --');
    expect(await group(page, 'Candidate Name').locator('input').inputValue()).toBe('');
    expect(await rows(page).count()).toBeGreaterThan(0);
  });

  test('recruitment-candidate-20 | Xem Candidate Profile và kiểm tra thông tin', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByName(page, primary.fullName);
    await openProfile(page, primary.fullName);

    expect(await fullNameOf(page)).toBe(primary.fullName);
    expect(await fieldText(page, 'Vacancy')).toBe(primary.vacancyName);
    expect(await fieldText(page, 'Hiring Manager')).toBe(primary.hiringManager);
    await expect(page.getByText('Status: Application Initiated')).toBeVisible();
    expect(await profileInput(page, 'Email')).toBe(primary.email);
    expect(await profileInput(page, 'Contact Number')).toBe(primary.contactNumber);
    expect(await profileInput(page, 'Date of Application')).toBe(primary.applicationDate);
    expect(await resumeNameOf(page)).toBe(primary.resume);
    expect(await profileInput(page, 'Keywords')).toBe(primary.keywords);
    expect(await profileTextarea(page, 'Notes')).toBe(primary.notes);
  });

  test('recruitment-candidate-21 | Xem/tải Resume của candidate', async ({ page }) => {
    const resumeCandidate = state.resumeCandidate!;

    await gotoList(page);
    await searchByName(page, resumeCandidate.fullName);
    await openProfile(page, resumeCandidate.fullName);

    expect(await resumeNameOf(page)).toBe(resumeCandidate.resume);
    expect(await downloadResume(page)).toBe(resumeCandidate.resume);
  });

  test('recruitment-candidate-22 | Xóa candidate và xác nhận', async ({ page }) => {
    const noVacancyCandidate = state.noVacancyCandidate!;

    await gotoList(page);
    await searchByName(page, noVacancyCandidate.fullName);
    await expect(row(page, noVacancyCandidate.fullName)).toBeVisible();
    await deleteCandidate(page, noVacancyCandidate.fullName);

    noVacancyCandidate.deleted = true;
  });

  test('recruitment-candidate-23 | Thêm candidate với Email trùng', async ({ page }, testInfo) => {
    const primary = state.primary!;
    const firstName = uniqueName('E2E-CAND-DUP', testInfo);
    const lastName = 'Tester';

    await gotoAdd(page);
    await fillName(page, firstName, lastName);
    await fillEmail(page, primary.email);
    await saveAndExpectCreated(page);

    expect(await profileInput(page, 'Email')).toBe(primary.email);

    state.duplicateEmailCandidate = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: primary.email,
      contactNumber: '',
      keywords: '',
      notes: '',
      resume: '',
      applicationDate: '',
      vacancyName: '',
      hiringManager: '',
    };
  });

  test('recruitment-candidate-24 | Tick Consent to keep data', async ({ page }) => {
    const primary = state.primary!;

    await gotoList(page);
    await searchByName(page, primary.fullName);
    await openProfile(page, primary.fullName);

    await expect(consentCheckbox(page)).toBeChecked();
    await expect(consentCheckbox(page)).toBeDisabled();
  });

  test('recruitment-candidate-25 | Thêm candidate với Date of Application ở tương lai', async ({ page }, testInfo) => {
    await gotoAdd(page);
    const applicationDate = await group(page, 'Date of Application').locator('input').inputValue();
    const futureDate = nextDay(applicationDate);

    await fillName(page, uniqueName('E2E-CAND-FUTURE', testInfo), 'Tester');
    await fillEmail(page, uniqueEmail(testInfo));
    await group(page, 'Date of Application').locator('input').fill(futureDate);
    await page.getByPlaceholder('Last Name').press('Tab');
    await saveAndExpectError(page, group(page, 'Date of Application'), 'Should be the current date or a previous date');
  });
});
