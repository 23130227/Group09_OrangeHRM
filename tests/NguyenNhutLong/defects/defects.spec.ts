import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.ORANGEHRM_BASE_URL ?? 'https://opensource-demo.orangehrmlive.com';
const USERNAME = process.env.ORANGEHRM_USERNAME ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD ?? 'admin123';

test.use({
  baseURL: BASE,
  trace: 'on',
  video: 'on',
  screenshot: 'on',
});

type NetworkEntry = {
  type: 'request' | 'response';
  method: string;
  url: string;
  status?: number;
  body?: string;
};

type CandidateRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
};

let cachedJobTitleId: number | undefined;
let cachedEmployeeId: number | undefined;
let networkSink: NetworkEntry[] | null = null;

function recordApi(method: string, url: string, requestBody: string, status: number, responseBody: string): void {
  if (!networkSink) {
    return;
  }
  networkSink.push({ type: 'request', method, url, body: requestBody.slice(0, 1000) });
  networkSink.push({ type: 'response', method, url, status, body: responseBody.slice(0, 1000) });
}

function today(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayInput(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function unique(prefix: string, testInfo: TestInfo): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${testInfo.workerIndex}${testInfo.retry}`;
}

function field(page: Page, label: string): Locator {
  return page.locator('.oxd-input-group').filter({ hasText: label }).first();
}

function rows(page: Page): Locator {
  return page.locator('.oxd-table-card');
}

function parseId(body: string): number | null {
  try {
    const parsed = JSON.parse(body) as { data?: { id?: number } };
    return typeof parsed.data?.id === 'number' ? parsed.data.id : null;
  } catch {
    return null;
  }
}

async function login(page: Page): Promise<void> {
  await page.goto('/web/index.php/auth/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByPlaceholder('Username').fill(USERNAME);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
}

async function api(page: Page, method: string, path: string, data?: unknown): Promise<{ status: number; ok: boolean; body: string }> {
  const response = await page.request.fetch(path, { method, data: data as never });
  let body = '';
  try {
    body = (await response.text()).slice(0, 2000);
  } catch {
    body = '';
  }
  recordApi(method, response.url(), data === undefined ? '' : JSON.stringify(data), response.status(), body);
  return { status: response.status(), ok: response.ok(), body };
}

async function getJson(page: Page, path: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const response = await page.request.get(path);
  let body: Record<string, unknown> | null = null;
  let text = '';
  try {
    text = await response.text();
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = null;
  }
  recordApi('GET', response.url(), '', response.status(), text);
  return { status: response.status(), body };
}

async function jobTitleId(page: Page): Promise<number> {
  if (cachedJobTitleId) {
    return cachedJobTitleId;
  }
  const response = await getJson(page, '/web/index.php/api/v2/admin/job-titles?limit=0');
  const data = response.body?.data as Array<{ id: number }> | undefined;
  const id = data?.[0]?.id;
  if (!id) {
    throw new Error('No job title available on the demo.');
  }
  cachedJobTitleId = id;
  return id;
}

async function employeeId(page: Page): Promise<number> {
  if (cachedEmployeeId) {
    return cachedEmployeeId;
  }
  for (const hint of ['Amelia', 'Chris', 'a']) {
    const response = await getJson(page, `/web/index.php/api/v2/recruitment/interviewers?nameOrId=${encodeURIComponent(hint)}`);
    const data = response.body?.data as Array<{ empNumber: number }> | undefined;
    const id = data?.[0]?.empNumber;
    if (id) {
      cachedEmployeeId = id;
      return id;
    }
  }
  throw new Error('No employee available on the demo.');
}

async function createVacancy(
  page: Page,
  overrides: Partial<{ name: string; jobTitleId: number; employeeId: number; numOfPositions: number; status: boolean }> = {},
): Promise<{ id: number | null; name: string; status: number; body: string }> {
  const name = overrides.name ?? `DEF-VAC-${Date.now().toString(36).toUpperCase()}`;
  const data = {
    name,
    jobTitleId: overrides.jobTitleId ?? await jobTitleId(page),
    employeeId: overrides.employeeId ?? await employeeId(page),
    numOfPositions: overrides.numOfPositions ?? 1,
    description: '',
    status: overrides.status ?? true,
    isPublished: true,
  };
  const response = await api(page, 'POST', '/web/index.php/api/v2/recruitment/vacancies', data);
  return { id: parseId(response.body), name, status: response.status, body: response.body };
}

function candidatePayload(prefix: string, testInfo: TestInfo, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const firstName = unique(prefix, testInfo);
  return {
    firstName,
    middleName: null,
    lastName: 'Tester',
    email: `${firstName.toLowerCase()}@example.com`,
    contactNumber: null,
    keywords: null,
    comment: null,
    dateOfApplication: today(),
    consentToKeepData: false,
    vacancyId: null,
    ...overrides,
  };
}

async function createCandidate(page: Page, payload: Record<string, unknown>): Promise<{ id: number | null; status: number; body: string }> {
  const response = await api(page, 'POST', '/web/index.php/api/v2/recruitment/candidates', payload);
  return { id: parseId(response.body), status: response.status, body: response.body };
}

async function getCandidate(page: Page, id: number): Promise<Record<string, unknown> | null> {
  const response = await getJson(page, `/web/index.php/api/v2/recruitment/candidates/${id}`);
  return (response.body?.data as Record<string, unknown> | undefined) ?? null;
}

async function getAllowed(page: Page, id: number): Promise<string[]> {
  const response = await getJson(page, `/web/index.php/api/v2/recruitment/candidates/${id}/actions/allowed`);
  const data = response.body?.data as Array<{ label: string }> | undefined;
  return (data ?? []).map((action) => action.label);
}

async function shortlist(page: Page, id: number): Promise<{ status: number; ok: boolean; body: string }> {
  return api(page, 'PUT', `/web/index.php/api/v2/recruitment/candidates/${id}/shortlist`, { note: null });
}

async function scheduleInterview(page: Page, id: number): Promise<{ status: number; ok: boolean; body: string }> {
  return api(page, 'POST', `/web/index.php/api/v2/recruitment/candidates/${id}/shedule-interview`, {
    interviewName: `INT-${Date.now().toString(36).toUpperCase()}`,
    interviewDate: today(),
    interviewTime: '09:00',
    note: null,
    interviewerEmpNumbers: [await employeeId(page)],
  });
}

async function interviewId(page: Page, id: number): Promise<number | null> {
  const response = await getJson(page, `/web/index.php/api/v2/recruitment/candidates/${id}/history?limit=50&offset=0`);
  const data = response.body?.data as Array<{ action?: { id?: number }; interview?: { id?: number } | null }> | undefined;
  return (data ?? []).find((entry) => entry.action?.id === 4 && entry.interview)?.interview?.id ?? null;
}

async function passInterview(page: Page, id: number, interview: number): Promise<{ status: number; ok: boolean; body: string }> {
  return api(page, 'PUT', `/web/index.php/api/v2/recruitment/candidates/${id}/interviews/${interview}/pass`, { note: null });
}

async function offerJob(page: Page, id: number): Promise<{ status: number; ok: boolean; body: string }> {
  return api(page, 'PUT', `/web/index.php/api/v2/recruitment/candidates/${id}/job/offer`, { note: null });
}

async function hire(page: Page, id: number): Promise<{ status: number; ok: boolean; body: string }> {
  return api(page, 'PUT', `/web/index.php/api/v2/recruitment/candidates/${id}/hire`, { note: null });
}

async function buildOffered(page: Page, id: number): Promise<void> {
  const shortlisted = await shortlist(page, id);
  expect(shortlisted.ok, 'shortlist setup').toBeTruthy();
  const scheduled = await scheduleInterview(page, id);
  expect(scheduled.ok, 'schedule setup').toBeTruthy();
  const interview = await interviewId(page, id);
  expect(interview, 'interview setup').not.toBeNull();
  const passed = await passInterview(page, id, interview!);
  expect(passed.ok, 'pass setup').toBeTruthy();
  const offered = await offerJob(page, id);
  expect(offered.ok, 'offer setup').toBeTruthy();
}

async function findActiveVacanciesWithoutManager(page: Page): Promise<Array<{ id: number; name: string }>> {
  let data: Array<{ id: number; status: boolean }> | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const list = await getJson(page, '/web/index.php/api/v2/recruitment/vacancies?limit=0&offset=0');
    data = list.body?.data as Array<{ id: number; status: boolean }> | undefined;
    if (data?.length) {
      break;
    }
    await page.waitForTimeout(1000);
  }
  const results: Array<{ id: number; name: string }> = [];
  for (const vacancy of data ?? []) {
    if (!vacancy.status) {
      continue;
    }
    const detail = await getJson(page, `/web/index.php/api/v2/recruitment/vacancies/${vacancy.id}`);
    const record = detail.body?.data as { id: number; name: string; hiringManager?: { id?: number | null } | null } | undefined;
    if (record && !record.hiringManager?.id) {
      results.push({ id: record.id, name: record.name });
    }
  }
  return results;
}

async function cleanup(page: Page, candidateIds: Array<number | null> = [], vacancyIds: Array<number | null> = []): Promise<void> {
  const candidates = [...new Set(candidateIds.filter((id): id is number => typeof id === 'number'))];
  const vacancies = [...new Set(vacancyIds.filter((id): id is number => typeof id === 'number'))];
  if (candidates.length) {
    await page.request.delete('/web/index.php/api/v2/recruitment/candidates', { data: { ids: candidates } }).catch(() => null);
  }
  if (vacancies.length) {
    await page.request.delete('/web/index.php/api/v2/recruitment/vacancies', { data: { ids: vacancies } }).catch(() => null);
  }
}

function captureNetwork(page: Page, testInfo: TestInfo): { entries: NetworkEntry[]; flush: () => Promise<void> } {
  const entries: NetworkEntry[] = [];
  networkSink = entries;
  page.on('request', (request) => {
    if (request.url().includes('/api/v2/recruitment')) {
      entries.push({
        type: 'request',
        method: request.method(),
        url: request.url(),
        body: (request.postData() ?? '').slice(0, 1000),
      });
    }
  });
  page.on('response', async (response) => {
    if (response.url().includes('/api/v2/recruitment')) {
      let body = '';
      try {
        if ((response.headers()['content-type'] ?? '').includes('json')) {
          body = (await response.text()).slice(0, 1000);
        }
      } catch {
        body = '';
      }
      entries.push({
        type: 'response',
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
        body,
      });
    }
  });
  return {
    entries,
    flush: async () => {
      const file = testInfo.outputPath('network.json');
      writeFileSync(file, JSON.stringify(entries, null, 2));
      await testInfo.attach('network.json', { path: file, contentType: 'application/json' });
      networkSink = null;
    },
  };
}

function makeShot(page: Page, testInfo: TestInfo): (name: string) => Promise<void> {
  let index = 0;
  return async (name: string) => {
    const file = testInfo.outputPath(`${++index}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    await testInfo.attach(`${index}-${name}.png`, { path: file, contentType: 'image/png' });
  };
}

async function writeResult(testInfo: TestInfo, data: Record<string, unknown>): Promise<void> {
  const file = testInfo.outputPath('result.json');
  writeFileSync(file, JSON.stringify({
    reportedBy: 'Nguyễn Nhựt Long (Group 09)',
    status: 'New',
    capturedAt: new Date().toISOString(),
    environment: BASE,
    ...data,
  }, null, 2));
  await testInfo.attach('result.json', { path: file, contentType: 'application/json' });
}

async function gotoAddCandidate(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/addCandidate', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByText('Full Name')).toBeVisible();
}

async function gotoEditCandidate(page: Page, id: number): Promise<void> {
  await page.goto(`/web/index.php/recruitment/addCandidate/${id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByText('Candidate Profile')).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

async function gotoCandidateList(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/viewCandidates', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(rows(page).first().or(page.getByText('No Records Found').first())).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function gotoVacancyList(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/viewJobVacancy', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(rows(page).first().or(page.getByText('No Records Found').first())).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function fillVacancyForm(page: Page, name: string, positions?: string): Promise<void> {
  await page.goto('/web/index.php/recruitment/addJobVacancy', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByText('Vacancy Name')).toBeVisible();
  await field(page, 'Vacancy Name').locator('input').fill(name);
  await field(page, 'Job Title').locator('.oxd-select-text').click();
  const title = page.getByRole('option').filter({ hasNotText: /-- Select --|No Records Found|Searching/ }).first();
  await title.waitFor({ timeout: 15_000 });
  await title.click();
  const manager = field(page, 'Hiring Manager').locator('input');
  const options = page.locator('.oxd-autocomplete-option').filter({ hasNotText: /Searching|No Records Found/ });
  for (const hint of ['Amelia', 'Chris', 'a']) {
    await manager.fill(hint);
    try {
      await options.first().waitFor({ timeout: 5_000 });
      await options.first().click();
      break;
    } catch {
      continue;
    }
  }
  if (positions !== undefined) {
    await field(page, 'Number of Positions').locator('input').fill(positions);
  }
}

async function saveVacancyAndRead(page: Page): Promise<{ url: string; errors: string[]; toasts: string[] }> {
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(2500);
  return {
    url: page.url(),
    errors: await page.locator('.oxd-input-field-error-message').allTextContents(),
    toasts: await page.locator('.oxd-toast').allTextContents(),
  };
}

async function editVacancy(page: Page, name: string): Promise<void> {
  await gotoVacancyList(page);
  const row = rows(page).filter({ hasText: name }).first();
  await row.locator('button').filter({ has: page.locator('i.bi-pencil-fill') }).click();
  await expect(page).toHaveURL(/addJobVacancy\/\d+/);
  await page.waitForLoadState('networkidle');
}

async function setVacancyActive(page: Page, active: boolean): Promise<void> {
  const wrapper = page.locator('.orangerhrm-switch-wrapper').filter({ hasText: 'Active' }).first();
  const checkbox = wrapper.locator('input[type=checkbox]');
  if ((await checkbox.isChecked()) !== active) {
    await wrapper.locator('.oxd-switch-input').click();
  }
}

async function searchCandidateByName(page: Page, name: string): Promise<void> {
  await gotoCandidateList(page);
  const input = field(page, 'Candidate Name').locator('input');
  await input.fill(name);
  const option = page.locator('.oxd-autocomplete-option').filter({ hasNotText: /Searching|No Records Found/ }).first();
  await option.waitFor({ timeout: 15_000 });
  await option.click();
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForTimeout(2500);
}

async function listCandidates(page: Page): Promise<Array<{ id: number; firstName: string; lastName: string; email: string }>> {
  const response = await getJson(page, '/web/index.php/api/v2/recruitment/candidates?limit=200&offset=0&model=list');
  return (response.body?.data as Array<{ id: number; firstName: string; lastName: string; email: string }> | undefined) ?? [];
}

test.describe('23130179 — Defect reproductions', { tag: '@defect' }, () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('DEF-01 | Shortlist returns HTTP 500 when the vacancy has no Hiring Manager', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const result: Record<string, unknown> = {
      defect: 'DEF-01',
      attempts: [],
    };
    try {
      const vacancies = await findActiveVacanciesWithoutManager(page);
      const attempts: Array<Record<string, unknown>> = [];
      let candidate: { id: number | null; status: number; body: string } | null = null;
      let selectedVacancy: { id: number; name: string } | null = null;
      for (const vacancy of vacancies) {
        const created = await createCandidate(page, candidatePayload(`D1V${vacancy.id}`, testInfo, { vacancyId: vacancy.id }));
        attempts.push({
          vacancyId: vacancy.id,
          vacancyName: vacancy.name,
          status: created.status,
          body: created.body.slice(0, 500),
          candidateId: created.id,
        });
        if (created.id) {
          candidate = created;
          selectedVacancy = vacancy;
          candidateIds.push(created.id);
          break;
        }
      }
      result.vacancies = vacancies;
      result.attempts = attempts;
      result.selectedVacancy = selectedVacancy;
      if (!candidate) {
        result.expected = 'At least one no-Hiring-Manager vacancy accepts candidate creation';
        result.actual = 'No candidate was created; see attempts';
        expect(candidate, 'no no-Hiring-Manager vacancy accepted candidate creation').not.toBeNull();
        return;
      }
      await gotoEditCandidate(page, candidate.id!);
      await shot('candidate-profile');
      const button = page.locator('.orangehrm-recruitment-actions').getByRole('button', { name: 'Shortlist', exact: true });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page).toHaveURL(/changeCandidateVacancyStatus/);
      const responsePromise = page.waitForResponse((response) => response.url().includes('/shortlist'), { timeout: 15_000 }).catch(() => null);
      await page.getByRole('button', { name: 'Save' }).click();
      const response = await responsePromise;
      expect(response, 'shortlist response').not.toBeNull();
      await page.waitForTimeout(2000);
      await shot('shortlist-result');
      const after = await getCandidate(page, candidate.id!);
      const status = (after?.status as { label?: string } | undefined)?.label ?? null;
      const shortlistResponse = response ? (await response.text()).slice(0, 400) : null;
      Object.assign(result, {
        candidateId: candidate.id,
        shortlistHttpStatus: response?.status() ?? null,
        shortlistResponse,
        toast: await page.locator('.oxd-toast').allTextContents(),
        statusAfter: status,
        expected: 'Candidate status becomes Shortlisted',
        actual: `HTTP ${response?.status() ?? '?'} with status ${status}`,
      });
      test.fail(true, 'DEF-01 — shortlist should succeed for a vacancy without Hiring Manager');
      expect(status).toBe('Shortlisted');
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds);
    }
  });

  test('DEF-02 | Deleting a vacancy orphans its candidates', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-02' };
    try {
      const vacancy = await createVacancy(page);
      vacancyIds.push(vacancy.id);
      const payload = candidatePayload('D2', testInfo, { vacancyId: vacancy.id });
      const candidate = await createCandidate(page, payload);
      candidateIds.push(candidate.id);
      expect(vacancy.id, 'vacancy setup').not.toBeNull();
      expect(candidate.id, 'candidate setup').not.toBeNull();
      const shortlisted = await shortlist(page, candidate.id!);
      expect(shortlisted.ok, 'shortlist setup').toBeTruthy();
      await gotoEditCandidate(page, candidate.id!);
      await shot('candidate-before-delete');
      const before = await getCandidate(page, candidate.id!);
      await gotoVacancyList(page);
      const row = rows(page).filter({ hasText: vacancy.name }).first();
      await expect(row).toBeVisible();
      await row.locator('button').filter({ has: page.locator('i.bi-trash') }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ').trim();
      await shot('delete-vacancy-dialog');
      await page.getByRole('button', { name: 'Yes, Delete' }).click();
      await page.waitForTimeout(2500);
      await shot('vacancy-deleted');
      await gotoEditCandidate(page, candidate.id!);
      await shot('candidate-after-delete');
      const after = await getCandidate(page, candidate.id!);
      Object.assign(result, {
        vacancyId: vacancy.id,
        candidateId: candidate.id,
        dialog: dialogText,
        toast: await page.locator('.oxd-toast').allTextContents(),
        beforeVacancy: (before?.vacancy as { id?: number } | null)?.id ?? null,
        afterVacancy: after ? ((after.vacancy as { id?: number } | null)?.id ?? null) : 'candidate deleted',
        allowedAfter: await getAllowed(page, candidate.id!),
        expected: 'Deletion is blocked or existing candidates remain consistent',
        actual: after ? 'Candidate remains with vacancy null and no actions' : 'Candidate was cascade-deleted',
      });
      test.fail(true, 'DEF-02 — deleting a vacancy must not orphan its candidates');
      if (after) {
        expect(after.vacancy).not.toBeNull();
      }
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds, vacancyIds);
    }
  });

  test('DEF-03 | A vacancy with one position allows multiple Hired candidates', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-03' };
    try {
      const vacancy = await createVacancy(page, { numOfPositions: 1 });
      vacancyIds.push(vacancy.id);
      expect(vacancy.id, 'vacancy setup').not.toBeNull();
      const first = await createCandidate(page, candidatePayload('D3A', testInfo, { vacancyId: vacancy.id }));
      const second = await createCandidate(page, candidatePayload('D3B', testInfo, { vacancyId: vacancy.id }));
      candidateIds.push(first.id, second.id);
      expect(first.id, 'candidate A setup').not.toBeNull();
      expect(second.id, 'candidate B setup').not.toBeNull();
      await buildOffered(page, first.id!);
      await buildOffered(page, second.id!);
      const firstHire = await hire(page, first.id!);
      expect(firstHire.ok, 'first hire setup').toBeTruthy();
      const secondHire = await hire(page, second.id!);
      const secondAfter = await getCandidate(page, second.id!);
      await page.goto(`/web/index.php/recruitment/addJobVacancy/${vacancy.id}`, { waitUntil: 'domcontentloaded' });
      await shot('vacancy-one-position');
      Object.assign(result, {
        vacancyId: vacancy.id,
        candidate1: { id: first.id, hireStatus: firstHire.status },
        candidate2: { id: second.id, hireStatus: secondHire.status, status: (secondAfter?.status as { label?: string } | undefined)?.label ?? null },
        expected: 'Second hire is rejected or the vacancy is closed',
        actual: `Second hire returned HTTP ${secondHire.status} and candidate status ${(secondAfter?.status as { label?: string } | undefined)?.label ?? 'unknown'}`,
      });
      test.fail(true, 'DEF-03 — second hire must be blocked when the vacancy has one position');
      expect(secondHire.ok && ((secondAfter?.status as { label?: string } | undefined)?.label === 'Hired')).toBe(false);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds, vacancyIds);
    }
  });

  test('DEF-04 | Future Date of Application is accepted by the API', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-04' };
    try {
      const first = unique('D4UI', testInfo);
      const email = `${first.toLowerCase()}@example.com`;
      await gotoAddCandidate(page);
      await page.getByPlaceholder('First Name').fill(first);
      await page.getByPlaceholder('Last Name').fill('Tester');
      await field(page, 'Email').locator('input').fill(email);
      const date = page.getByPlaceholder('yyyy-dd-mm');
      await date.fill(todayInput(1));
      await date.press('Tab');
      await shot('ui-future-date');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(2500);
      await shot('ui-future-date-rejected');
      const uiErrors = await page.locator('.oxd-input-field-error-message').allTextContents();
      const payload = candidatePayload('D4', testInfo, { dateOfApplication: '2030-01-01' });
      const created = await createCandidate(page, payload);
      candidateIds.push(created.id);
      Object.assign(result, {
        uiErrors,
        apiStatus: created.status,
        createdId: created.id,
        expected: 'API rejects future Date of Application',
        actual: `API returned HTTP ${created.status}`,
      });
      test.fail(true, 'DEF-04 — the API must reject future application dates like the UI');
      expect(created.status).not.toBe(200);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds);
    }
  });

  test('DEF-05 | Duplicate Vacancy Name is accepted by the API', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-05' };
    try {
      const name = `DEF-DUP-${Date.now().toString(36).toUpperCase()}`;
      const base = await createVacancy(page, { name });
      vacancyIds.push(base.id);
      expect(base.id, 'base vacancy setup').not.toBeNull();
      await fillVacancyForm(page, name);
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(2500);
      await shot('ui-duplicate-rejected');
      const uiErrors = await page.locator('.oxd-input-field-error-message').allTextContents();
      const exact = await createVacancy(page, { name });
      const lower = await createVacancy(page, { name: name.toLowerCase() });
      const padded = await createVacancy(page, { name: ` ${name} ` });
      vacancyIds.push(exact.id, lower.id, padded.id);
      await gotoVacancyList(page);
      await shot('duplicate-vacancies');
      Object.assign(result, {
        name,
        uiErrors,
        exactStatus: exact.status,
        lowerStatus: lower.status,
        paddedStatus: padded.status,
        expected: 'All duplicate requests are rejected',
        actual: `Exact ${exact.status}, lowercase ${lower.status}, padded ${padded.status}`,
      });
      test.fail(true, 'DEF-05 — API must reject duplicate Vacancy Names');
      expect([exact.status, lower.status, padded.status].every((status) => status >= 400)).toBe(true);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, [], vacancyIds);
    }
  });

  test('DEF-06 | Invalid Number of Positions is accepted by the API', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-06' };
    try {
      await fillVacancyForm(page, `DEF-POS-${Date.now().toString(36).toUpperCase()}`, '0');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(2500);
      await shot('ui-positions-rejected');
      const uiErrors = await page.locator('.oxd-input-field-error-message').allTextContents();
      const statuses: Record<string, number> = {};
      for (const value of [0, -1, 100, 2147483648]) {
        const created = await createVacancy(page, { name: `DEF-POS-${value}-${Date.now().toString(36).toUpperCase()}`, numOfPositions: value });
        vacancyIds.push(created.id);
        statuses[String(value)] = created.status;
      }
      Object.assign(result, {
        uiErrors,
        apiStatuses: statuses,
        expected: 'All invalid values are rejected',
        actual: JSON.stringify(statuses),
      });
      test.fail(true, 'DEF-06 — API must enforce the 1-99 range');
      expect(Object.values(statuses).every((status) => status >= 400)).toBe(true);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, [], vacancyIds);
    }
  });

  test('DEF-07 | A single-day Date of Application filter is rejected', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const result: Record<string, unknown> = { defect: 'DEF-07' };
    try {
      await gotoCandidateList(page);
      await page.getByPlaceholder('From').fill(todayInput());
      await page.getByPlaceholder('To').fill(todayInput());
      await page.getByRole('heading', { name: 'Candidates' }).click();
      await shot('same-day-filter');
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/v2/recruitment/candidates?') && response.url().includes('fromDate'),
        { timeout: 15_000 },
      ).catch(() => null);
      await page.getByRole('button', { name: 'Search' }).click();
      const response = await responsePromise;
      expect(response, 'same-day filter response').not.toBeNull();
      await page.waitForTimeout(2000);
      await shot('same-day-result');
      const body = response ? (await response.text()).slice(0, 300) : null;
      Object.assign(result, {
        from: todayInput(),
        to: todayInput(),
        status: response?.status() ?? null,
        body,
        uiMessages: await page.locator('.oxd-toast, .oxd-input-field-error-message').allTextContents(),
        expected: 'HTTP 200 with candidates for that day',
        actual: `HTTP ${response?.status() ?? '?'}`,
      });
      test.fail(true, 'DEF-07 — From = To must return a single-day result');
      expect(response?.status()).toBe(200);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
    }
  });

  test('DEF-08 | Keywords search treats % and _ as SQL LIKE wildcards', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-08' };
    try {
      const seeded = await createCandidate(page, candidatePayload('D8', testInfo, { keywords: 'alpha-beta' }));
      candidateIds.push(seeded.id);
      expect(seeded.id, 'keyword seed setup').not.toBeNull();
      await gotoCandidateList(page);
      await field(page, 'Keywords').locator('input').fill('%');
      await shot('wildcard-input');
      const responsePromise = page.waitForResponse((response) => response.url().includes('keywords=%25'), { timeout: 15_000 }).catch(() => null);
      await page.getByRole('button', { name: 'Search' }).click();
      const response = await responsePromise;
      expect(response, 'keywords search response').not.toBeNull();
      await page.waitForTimeout(2000);
      await shot('wildcard-results');
      let total: number | null = null;
      try {
        const parsed = await response?.json() as { meta?: { total?: number } };
        total = parsed.meta?.total ?? null;
      } catch {
        total = null;
      }
      Object.assign(result, {
        keyword: '%',
        total,
        rows: await rows(page).count(),
        expected: '0 records',
        actual: `${total ?? 'unknown'} records returned`,
      });
      test.fail(true, 'DEF-08 — % must be treated as a literal character');
      expect(total).toBe(0);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds);
    }
  });

  test('DEF-09 | Double-clicking Save creates duplicate candidate records', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-09' };
    try {
      const first = unique('D9', testInfo);
      const email = `${first.toLowerCase()}@example.com`;
      await gotoAddCandidate(page);
      await page.getByPlaceholder('First Name').fill(first);
      await page.getByPlaceholder('Last Name').fill('Tester');
      await field(page, 'Email').locator('input').fill(email);
      await shot('candidate-form');
      await page.evaluate(() => {
        const save = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Save');
        if (save) {
          save.click();
          save.click();
        }
      });
      await page.waitForTimeout(4000);
      await shot('after-double-click');
      await expect.poll(async () => (await listCandidates(page)).filter((candidate) => candidate.firstName === first).length, { timeout: 20_000 }).toBeGreaterThan(0);
      const matches = (await listCandidates(page)).filter((candidate) => candidate.firstName === first);
      for (const match of matches) {
        candidateIds.push(match.id);
      }
      await gotoCandidateList(page);
      await shot('duplicate-list');
      test.fail(true, 'DEF-09 — one submission must create one candidate');
      Object.assign(result, {
        firstName: first,
        email,
        createdCount: matches.length,
        createdIds: matches.map((match) => match.id),
        expected: 'Exactly 1 candidate',
        actual: `${matches.length} candidates created`,
      });
      expect(matches.length).toBe(1);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds);
    }
  });

  test('DEF-10 | Closed vacancy still accepts candidate applications via API', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-10' };
    try {
      const closed = await createVacancy(page, { name: `DEF-CLOSED-${Date.now().toString(36).toUpperCase()}`, status: false });
      vacancyIds.push(closed.id);
      expect(closed.id, 'closed vacancy setup').not.toBeNull();
      await gotoAddCandidate(page);
      await page.locator('.oxd-select-text').click();
      await page.waitForTimeout(800);
      const options = await page.getByRole('option').allTextContents();
      await shot('vacancy-dropdown');
      await page.keyboard.press('Escape');
      const payload = candidatePayload('D10', testInfo, { vacancyId: closed.id });
      const created = await createCandidate(page, payload);
      candidateIds.push(created.id);
      Object.assign(result, {
        closedVacancyId: closed.id,
        uiDropdownIncludesClosed: options.some((option) => option.includes(closed.name)),
        apiStatus: created.status,
        createdId: created.id,
        expected: 'API rejects applications to a closed vacancy',
        actual: `API returned HTTP ${created.status}`,
      });
      test.fail(true, 'DEF-10 — a closed vacancy must reject new applications');
      expect(created.status).not.toBe(200);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds, vacancyIds);
    }
  });

  test('DEF-11 | Hired candidate can be permanently deleted', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-11' };
    try {
      const vacancy = await createVacancy(page);
      vacancyIds.push(vacancy.id);
      const payload = candidatePayload('D11', testInfo, { vacancyId: vacancy.id });
      const candidate = await createCandidate(page, payload);
      candidateIds.push(candidate.id);
      expect(vacancy.id, 'vacancy setup').not.toBeNull();
      expect(candidate.id, 'candidate setup').not.toBeNull();
      await buildOffered(page, candidate.id!);
      const hired = await hire(page, candidate.id!);
      expect(hired.ok, 'hire setup').toBeTruthy();
      await searchCandidateByName(page, String(payload.firstName));
      const row = rows(page).filter({ hasText: String(payload.firstName) }).first();
      await expect(row).toBeVisible();
      await shot('hired-candidate-row');
      const trash = row.locator('button').filter({ has: page.locator('i.bi-trash') });
      const trashCount = await trash.count();
      if (trashCount > 0) {
        await trash.click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Yes, Delete' }).click();
        await page.waitForTimeout(2500);
        await shot('delete-hired-result');
      }
      const after = await getJson(page, `/web/index.php/api/v2/recruitment/candidates/${candidate.id}`);
      Object.assign(result, {
        candidateId: candidate.id,
        statusBefore: (await getCandidate(page, candidate.id!))?.status,
        trashCount,
        toast: await page.locator('.oxd-toast').allTextContents(),
        getAfterDelete: after.status,
        expected: 'Hired candidate still exists and cannot be deleted',
        actual: `Candidate GET after delete: HTTP ${after.status}`,
      });
      test.fail(true, 'DEF-11 — a Hired candidate must not be deletable');
      expect(after.status).toBe(200);
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds, vacancyIds);
    }
  });

  test('DEF-12 | Closing a vacancy leaves candidates with no actions', async ({ page }, testInfo) => {
    const shot = makeShot(page, testInfo);
    const network = captureNetwork(page, testInfo);
    const candidateIds: Array<number | null> = [];
    const vacancyIds: Array<number | null> = [];
    const result: Record<string, unknown> = { defect: 'DEF-12' };
    try {
      const vacancy = await createVacancy(page, { numOfPositions: 2 });
      vacancyIds.push(vacancy.id);
      const payload = candidatePayload('D12', testInfo, { vacancyId: vacancy.id });
      const candidate = await createCandidate(page, payload);
      candidateIds.push(candidate.id);
      expect(vacancy.id, 'vacancy setup').not.toBeNull();
      expect(candidate.id, 'candidate setup').not.toBeNull();
      const before = await getAllowed(page, candidate.id!);
      expect(before).toContain('Reject');
      await editVacancy(page, vacancy.name);
      await setVacancyActive(page, false);
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(3000);
      await shot('vacancy-closed');
      await gotoEditCandidate(page, candidate.id!);
      await shot('candidate-after-close');
      const after = await getAllowed(page, candidate.id!);
      Object.assign(result, {
        vacancyId: vacancy.id,
        candidateId: candidate.id,
        allowedBefore: before,
        allowedAfter: after,
        actionButtons: await page.locator('.orangehrm-recruitment-actions').getByRole('button').allTextContents(),
        expected: 'Candidate keeps Reject or Withdraw action',
        actual: `Allowed actions after close: ${after.join(', ') || 'none'}`,
      });
      test.fail(true, 'DEF-12 — candidates must retain a reject/withdraw action');
      expect(after).toContain('Reject');
    } finally {
      await writeResult(testInfo, result);
      await network.flush();
      await cleanup(page, candidateIds, vacancyIds);
    }
  });
});
