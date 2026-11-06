import { test, expect, type Locator, type Page } from '@playwright/test';

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
  id: number;
  name: string;
};

type CandidateRecord = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  vacancyName: string;
};

type InterviewRecord = {
  title: string;
  date: string;
  interviewers: string[];
};

const state: {
  vacancy?: VacancyRecord;
  pipe?: CandidateRecord;
  pipeInterview?: InterviewRecord;
  rejectAi?: CandidateRecord;
  shortNeg?: CandidateRecord;
  shortTime?: CandidateRecord;
  shortPast?: CandidateRecord;
  shortMulti?: CandidateRecord;
  passOffer?: CandidateRecord;
  passCancel?: CandidateRecord;
  offerHire?: CandidateRecord;
  offerCancel?: CandidateRecord;
  offerReject?: CandidateRecord;
  actions?: CandidateRecord;
} = {};

let sequence = 0;

function uniqueValue(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${sequence++}`;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function todayInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${day}-${month}`;
}

function standardDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateVariants(value: string): string[] {
  const [year, day, month] = value.split('-');
  return [`${year}-${day}-${month}`, `${year}-${month}-${day}`];
}

const field = (page: Page, label: string): Locator =>
  page.locator('.oxd-input-group').filter({ has: page.getByText(label, { exact: true }) }).first();

const rows = (page: Page): Locator => page.locator('.oxd-table-card');

const row = (page: Page, name: string): Locator =>
  rows(page).filter({ hasText: name }).first();

const cell = (page: Page, name: string, index: number): Locator =>
  row(page, name).locator('[role=cell]').nth(index);

const actionButtons = (page: Page): Locator =>
  page.locator('.orangehrm-recruitment-actions').getByRole('button');

async function waitForProfile(page: Page): Promise<void> {
  await expect(page.getByText('Candidate Profile')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function gotoList(page: Page): Promise<void> {
  await page.goto('/web/index.php/recruitment/viewCandidates');
  await waitForResults(page);
}

async function waitForResults(page: Page): Promise<void> {
  await expect(rows(page).first().or(page.getByText('No Records Found')).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
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

async function selectCandidateName(page: Page, name: string): Promise<void> {
  await field(page, 'Candidate Name').locator('input').fill(name);
  const option = page.locator('.oxd-autocomplete-option').filter({ hasText: name }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function searchByName(page: Page, name: string): Promise<void> {
  await selectCandidateName(page, name);
  await submitSearch(page);
}

function statusOf(page: Page, name: string): Promise<string> {
  return cell(page, name, 5).innerText().then((value) => value.trim());
}

async function openProfileFromList(page: Page, name: string): Promise<void> {
  await row(page, name)
    .locator('button')
    .filter({ has: page.locator('i.bi-eye-fill') })
    .click();

  await expect(page).toHaveURL(/addCandidate\/\d+/);
  await waitForProfile(page);
}

async function pickHiringManager(page: Page, hint = 'Amelia'): Promise<string> {
  const input = field(page, 'Hiring Manager').locator('input');
  const options = page.locator('.oxd-autocomplete-option').filter({ hasNotText: /Searching|No Records Found/ });

  await input.fill(hint);
  try {
    await expect(options.first()).toBeVisible({ timeout: 8_000 });
  } catch {
    await input.fill('Amelia');
    await expect(options.first()).toBeVisible();
  }

  const selected = normalize(await options.first().innerText());
  await options.first().click();
  await expect(input).toHaveValue(new RegExp(selected.split(/\s+/)[0]));
  return selected;
}

async function pickInterviewer(page: Page, index: number, hint: string): Promise<string> {
  const input = page.getByPlaceholder('Type for hints...').nth(index);
  const options = page.locator('.oxd-autocomplete-option').filter({ hasNotText: /Searching|No Records Found/ });

  await input.fill(hint);
  await expect(options.first()).toBeVisible();
  const selected = normalize(await options.first().innerText());
  await options.first().click();
  await expect(input).toHaveValue(new RegExp(selected.split(/\s+/)[0]));
  return selected;
}

async function createVacancy(page: Page): Promise<VacancyRecord> {
  const name = uniqueValue('WF-VAC');

  await page.goto('/web/index.php/recruitment/addJobVacancy');
  await expect(page.getByText('Vacancy Name')).toBeVisible();

  await field(page, 'Vacancy Name').locator('input').fill(name);
  await field(page, 'Job Title').locator('.oxd-select-text').click();
  await page.getByRole('option', { name: 'Software Engineer', exact: true }).click();
  await pickHiringManager(page);
  await field(page, 'Number of Positions').locator('input').fill('1');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/addJobVacancy\/\d+/);

  const id = Number(page.url().match(/addJobVacancy\/(\d+)/)![1]);
  return { id, name };
}

async function createCandidate(
  page: Page,
  prefix: string,
  vacancy: VacancyRecord,
): Promise<CandidateRecord> {
  const firstName = uniqueValue(prefix);
  const lastName = 'Tester';
  const email = `${firstName.toLowerCase()}@example.com`;

  const response = await page.request.post('/web/index.php/api/v2/recruitment/candidates', {
    data: {
      firstName,
      middleName: null,
      lastName,
      email,
      contactNumber: null,
      keywords: null,
      comment: null,
      dateOfApplication: standardDate(),
      consentToKeepData: false,
      vacancyId: vacancy.id,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = (await response.json()).data as { id: number };

  return {
    id: data.id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    vacancyName: vacancy.name,
  };
}

async function candidateStatus(page: Page, candidate: CandidateRecord): Promise<string> {
  const response = await page.request.get(`/web/index.php/api/v2/recruitment/candidates/${candidate.id}`);
  const data = (await response.json()).data as { status?: { label: string } | null };
  return data.status?.label ?? '';
}

async function apiShortlist(page: Page, candidate: CandidateRecord): Promise<void> {
  const response = await page.request.put(
    `/web/index.php/api/v2/recruitment/candidates/${candidate.id}/shortlist`,
    { data: { note: null } },
  );
  expect(response.ok()).toBeTruthy();
  expect(await candidateStatus(page, candidate)).toBe('Shortlisted');
}

async function interviewerEmpNumber(page: Page, hint = 'Amelia'): Promise<number> {
  const response = await page.request.get(
    `/web/index.php/api/v2/recruitment/interviewers?nameOrId=${encodeURIComponent(hint)}`,
  );
  const data = (await response.json()).data as Array<{ empNumber: number }>;
  expect(data.length).toBeGreaterThan(0);
  return data[0].empNumber;
}

async function apiSchedule(page: Page, candidate: CandidateRecord): Promise<number> {
  const interviewerEmpNumbers = [await interviewerEmpNumber(page)];
  const response = await page.request.post(
    `/web/index.php/api/v2/recruitment/candidates/${candidate.id}/shedule-interview`,
    {
      data: {
        interviewName: uniqueValue('WF-BUILD-INT'),
        interviewDate: standardDate(),
        interviewTime: '09:00',
        note: null,
        interviewerEmpNumbers,
      },
    },
  );
  expect(response.ok()).toBeTruthy();

  const historyResponse = await page.request.get(
    `/web/index.php/api/v2/recruitment/candidates/${candidate.id}/history?limit=50&offset=0`,
  );
  const history = (await historyResponse.json()).data as Array<{
    action?: { id: number };
    interview?: { id: number } | null;
  }>;
  const entry = history.find((item) => item.action?.id === 4 && item.interview);
  expect(entry).toBeTruthy();
  return entry!.interview!.id;
}

async function apiPass(page: Page, candidate: CandidateRecord, interviewId: number): Promise<void> {
  const response = await page.request.put(
    `/web/index.php/api/v2/recruitment/candidates/${candidate.id}/interviews/${interviewId}/pass`,
    { data: { note: null } },
  );
  expect(response.ok()).toBeTruthy();
  expect(await candidateStatus(page, candidate)).toBe('Interview Passed');
}

async function apiOffer(page: Page, candidate: CandidateRecord): Promise<void> {
  const response = await page.request.put(
    `/web/index.php/api/v2/recruitment/candidates/${candidate.id}/job/offer`,
    { data: { note: null } },
  );
  expect(response.ok()).toBeTruthy();
  expect(await candidateStatus(page, candidate)).toBe('Job Offered');
}

async function openCandidate(page: Page, candidate: CandidateRecord): Promise<void> {
  await page.goto(`/web/index.php/recruitment/addCandidate/${candidate.id}`);
  await waitForProfile(page);
}

async function currentStatus(page: Page): Promise<string> {
  const value = await page.locator('.orangehrm-recruitment-status').innerText();
  return normalize(value).replace(/^Status:\s*/, '');
}

async function expectStatus(page: Page, status: string): Promise<void> {
  await expect(page.locator('.orangehrm-recruitment-status')).toContainText(`Status: ${status}`);
  expect(await currentStatus(page)).toBe(status);
}

async function expectActions(page: Page, expected: string[]): Promise<void> {
  const actual = (await actionButtons(page).allInnerTexts()).map((value) => value.trim()).filter(Boolean);
  expect(actual).toEqual(expected);
}

async function openAction(page: Page, name: string): Promise<void> {
  await page.locator('.orangehrm-recruitment-actions').getByRole('button', { name, exact: true }).click();
  await expect(page).toHaveURL(/changeCandidateVacancyStatus/);
}

async function fillNote(page: Page, note: string): Promise<void> {
  await page.locator('textarea').first().fill(note);
}

async function submitTransition(page: Page, candidate: CandidateRecord): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.oxd-toast--success').first()).toContainText(/Successfully Updated|Successfully Saved/);
  await expect(page).toHaveURL(new RegExp(`/recruitment/addCandidate/${candidate.id}$`));
  await waitForProfile(page);
}

async function cancelTransition(page: Page, candidate: CandidateRecord): Promise<void> {
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(new RegExp(`/recruitment/addCandidate/${candidate.id}$`));
  await waitForProfile(page);
}

async function shortlistOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Shortlist');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

type ScheduleOptions = {
  title: string;
  date?: string;
  time?: string;
  interviewers?: string[];
};

async function scheduleOnProfile(
  page: Page,
  candidate: CandidateRecord,
  options: ScheduleOptions,
): Promise<InterviewRecord> {
  await openAction(page, 'Schedule Interview');
  await field(page, 'Interview Title').locator('input').fill(options.title);

  const hints = options.interviewers ?? ['Amelia'];
  const interviewers: string[] = [];

  interviewers.push(await pickInterviewer(page, 0, hints[0]));
  for (let index = 1; index < hints.length; index++) {
    await page.getByRole('button', { name: 'Add Another' }).click();
    interviewers.push(await pickInterviewer(page, index, hints[index]));
  }

  const date = options.date ?? todayInput();
  await page.getByPlaceholder('yyyy-dd-mm').fill(date);
  if (options.time) {
    await page.getByPlaceholder('hh:mm').fill(options.time);
  }

  await submitTransition(page, candidate);

  return { title: options.title, date, interviewers };
}

async function rejectOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Reject');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

async function markFailedOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Mark Interview Failed');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

async function markPassedOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Mark Interview Passed');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

async function offerOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Offer Job');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

async function declineOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Offer Declined');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

async function hireOnProfile(page: Page, candidate: CandidateRecord, note?: string): Promise<void> {
  await openAction(page, 'Hire');
  if (note) {
    await fillNote(page, note);
  }
  await submitTransition(page, candidate);
}

function historyRows(page: Page): Locator {
  return page.locator('.oxd-table-card');
}

async function historyText(page: Page, title: string): Promise<string> {
  const historyRow = historyRows(page).filter({ hasText: title }).first();
  await expect(historyRow).toBeVisible();
  return normalize(await historyRow.innerText());
}

async function apiBuildPassed(page: Page, candidate: CandidateRecord): Promise<void> {
  await apiShortlist(page, candidate);
  const interviewId = await apiSchedule(page, candidate);
  await apiPass(page, candidate, interviewId);
}

async function apiBuildOffered(page: Page, candidate: CandidateRecord): Promise<void> {
  await apiBuildPassed(page, candidate);
  await apiOffer(page, candidate);
}

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Recruitment — Candidate Workflow', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);

    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await login(page);

    state.vacancy = await createVacancy(page);
    const vacancy = state.vacancy;

    state.pipe = await createCandidate(page, 'WF-PIPE', vacancy);
    state.rejectAi = await createCandidate(page, 'WF-REJECT-AI', vacancy);
    state.shortNeg = await createCandidate(page, 'WF-SHORT-NEG', vacancy);
    state.shortTime = await createCandidate(page, 'WF-SHORT-TIME', vacancy);
    state.shortPast = await createCandidate(page, 'WF-SHORT-PAST', vacancy);
    state.shortMulti = await createCandidate(page, 'WF-SHORT-MULTI', vacancy);
    state.passOffer = await createCandidate(page, 'WF-PASS-OFFER', vacancy);
    state.passCancel = await createCandidate(page, 'WF-PASS-CANCEL', vacancy);
    state.offerHire = await createCandidate(page, 'WF-OFFER-HIRE', vacancy);
    state.offerCancel = await createCandidate(page, 'WF-OFFER-CANCEL', vacancy);
    state.offerReject = await createCandidate(page, 'WF-OFFER-REJECT', vacancy);
    state.actions = await createCandidate(page, 'WF-ACTIONS', vacancy);

    for (const candidate of [state.shortNeg, state.shortTime, state.shortPast, state.shortMulti]) {
      await apiShortlist(page, candidate!);
    }

    await apiBuildPassed(page, state.passOffer!);
    await apiBuildPassed(page, state.passCancel!);

    await apiBuildOffered(page, state.offerHire!);
    await apiBuildOffered(page, state.offerCancel!);
    await apiBuildOffered(page, state.offerReject!);

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await login(page);

    try {
      const candidates = [
        state.pipe,
        state.rejectAi,
        state.shortNeg,
        state.shortTime,
        state.shortPast,
        state.shortMulti,
        state.passOffer,
        state.passCancel,
        state.offerHire,
        state.offerCancel,
        state.offerReject,
        state.actions,
      ].filter((candidate): candidate is CandidateRecord => Boolean(candidate));

      if (candidates.length) {
        await page.request.delete('/web/index.php/api/v2/recruitment/candidates', {
          data: { ids: candidates.map((candidate) => candidate.id) },
        });
      }

      if (state.vacancy) {
        const response = await page.request.get('/web/index.php/api/v2/recruitment/vacancies?limit=200&offset=0');
        const vacancies = (await response.json()).data as Array<{ id: number; name: string }>;
        const ids = vacancies
          .filter((vacancy) => vacancy.name === state.vacancy!.name)
          .map((vacancy) => vacancy.id);

        if (ids.length) {
          await page.request.delete('/web/index.php/api/v2/recruitment/vacancies', { data: { ids } });
        }
      }
    } catch {
      await context.close();
      return;
    }

    await context.close();
  });

  test('recruitment-status-1 | Shortlist ứng viên (Application Initiated -> Shortlisted)', async ({ page }) => {
    const candidate = state.pipe!;

    await openCandidate(page, candidate);
    await shortlistOnProfile(page, candidate, 'Shortlisted by E2E workflow');

    await expectStatus(page, 'Shortlisted');
  });

  test('recruitment-status-2 | Reject ứng viên (Application Initiated -> Rejected)', async ({ page }) => {
    const candidate = state.rejectAi!;

    await openCandidate(page, candidate);
    await rejectOnProfile(page, candidate, 'Rejected by E2E workflow');

    await expectStatus(page, 'Rejected');
  });

  test('recruitment-status-3 | Schedule Interview với đầy đủ thông tin', async ({ page }) => {
    const candidate = state.pipe!;

    await openCandidate(page, candidate);
    state.pipeInterview = await scheduleOnProfile(page, candidate, {
      title: uniqueValue('WF-INT-PIPE'),
      date: todayInput(),
      time: '09:00 AM',
      interviewers: ['Amelia'],
    });

    await expectStatus(page, 'Interview Scheduled');
  });

  test('recruitment-status-4 | Schedule Interview thiếu Interview Title', async ({ page }) => {
    const candidate = state.shortNeg!;

    await openCandidate(page, candidate);
    await openAction(page, 'Schedule Interview');
    await pickInterviewer(page, 0, 'Amelia');
    await page.getByPlaceholder('yyyy-dd-mm').fill(todayInput());
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(field(page, 'Interview Title').locator('.oxd-input-field-error-message')).toHaveText('Required');
    await expect(page).toHaveURL(/changeCandidateVacancyStatus/);

    await cancelTransition(page, candidate);
    await expectStatus(page, 'Shortlisted');
  });

  test('recruitment-status-5 | Schedule Interview thiếu Interviewer', async ({ page }) => {
    const candidate = state.shortNeg!;

    await openCandidate(page, candidate);
    await openAction(page, 'Schedule Interview');
    await field(page, 'Interview Title').locator('input').fill(uniqueValue('WF-INT-NOINTERVIEWER'));
    await page.getByPlaceholder('yyyy-dd-mm').fill(todayInput());
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(field(page, 'Interviewer').locator('.oxd-input-field-error-message')).toHaveText('Required');
    await expect(page).toHaveURL(/changeCandidateVacancyStatus/);

    await cancelTransition(page, candidate);
    await expectStatus(page, 'Shortlisted');
  });

  test('recruitment-status-6 | Schedule Interview thiếu Date', async ({ page }) => {
    const candidate = state.shortNeg!;

    await openCandidate(page, candidate);
    await openAction(page, 'Schedule Interview');
    await field(page, 'Interview Title').locator('input').fill(uniqueValue('WF-INT-NODATE'));
    await pickInterviewer(page, 0, 'Amelia');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(field(page, 'Date').locator('.oxd-input-field-error-message')).toHaveText('Required');
    await expect(page).toHaveURL(/changeCandidateVacancyStatus/);

    await cancelTransition(page, candidate);
    await expectStatus(page, 'Shortlisted');
  });

  test('recruitment-status-7 | Schedule Interview không nhập Time (Time là tùy chọn)', async ({ page }) => {
    const candidate = state.shortTime!;

    await openCandidate(page, candidate);
    const interview = await scheduleOnProfile(page, candidate, {
      title: uniqueValue('WF-INT-NOTIME'),
      date: todayInput(),
      interviewers: ['Amelia'],
    });

    await expectStatus(page, 'Interview Scheduled');
    const text = await historyText(page, interview.title);
    expect(text).toContain(interview.title);
    expect(dateVariants(interview.date).some((value) => text.includes(value))).toBe(true);
  });

  test('recruitment-status-8 | Schedule Interview với ngày trong quá khứ', async ({ page }) => {
    const candidate = state.shortPast!;
    const date = '2024-15-01';

    await openCandidate(page, candidate);
    const interview = await scheduleOnProfile(page, candidate, {
      title: uniqueValue('WF-INT-PAST'),
      date,
      time: '10:30 AM',
      interviewers: ['Amelia'],
    });

    await expectStatus(page, 'Interview Scheduled');
    const text = await historyText(page, interview.title);
    expect(text).toContain(interview.title);
    expect(dateVariants(date).some((value) => text.includes(value))).toBe(true);
  });

  test('recruitment-status-9 | Hủy Schedule Interview không lưu', async ({ page }) => {
    const candidate = state.shortNeg!;
    const title = uniqueValue('WF-INT-CANCEL');

    await openCandidate(page, candidate);
    await openAction(page, 'Schedule Interview');
    await field(page, 'Interview Title').locator('input').fill(title);
    await pickInterviewer(page, 0, 'Amelia');
    await page.getByPlaceholder('yyyy-dd-mm').fill(todayInput());
    await cancelTransition(page, candidate);

    await expectStatus(page, 'Shortlisted');
    await expect(historyRows(page).filter({ hasText: title })).toHaveCount(0);
  });

  test('recruitment-status-10 | Mark Interview Failed (Interview Scheduled -> Interview Failed)', async ({ page }) => {
    const candidate = state.shortPast!;

    await openCandidate(page, candidate);
    await markFailedOnProfile(page, candidate, 'Failed by E2E workflow');

    await expectStatus(page, 'Interview Failed');
  });

  test('recruitment-status-11 | Offer Job (Interview Passed -> Job Offered)', async ({ page }) => {
    const candidate = state.passOffer!;

    await openCandidate(page, candidate);
    await offerOnProfile(page, candidate, 'Offered by E2E workflow');

    await expectStatus(page, 'Job Offered');
  });

  test('recruitment-status-12 | Decline Offer (Job Offered -> Offer Declined)', async ({ page }) => {
    const candidate = state.passOffer!;

    await openCandidate(page, candidate);
    await declineOnProfile(page, candidate, 'Declined by E2E workflow');

    await expectStatus(page, 'Offer Declined');
  });

  test('recruitment-status-13 | Hire candidate (Job Offered -> Hired)', async ({ page }) => {
    const candidate = state.offerHire!;

    await openCandidate(page, candidate);
    await hireOnProfile(page, candidate, 'Hired by E2E workflow');

    await expectStatus(page, 'Hired');
  });

  test('recruitment-status-14 | Hủy Offer Job', async ({ page }) => {
    const candidate = state.passCancel!;

    await openCandidate(page, candidate);
    await openAction(page, 'Offer Job');
    await cancelTransition(page, candidate);

    await expectStatus(page, 'Interview Passed');
  });

  test('recruitment-status-15 | Hủy Hire', async ({ page }) => {
    const candidate = state.offerCancel!;

    await openCandidate(page, candidate);
    await openAction(page, 'Hire');
    await cancelTransition(page, candidate);

    await expectStatus(page, 'Job Offered');
  });

  test('recruitment-status-16 | Trạng thái cập nhật đúng trên danh sách Candidates', async ({ page }) => {
    const candidate = state.pipe!;

    await gotoList(page);
    await searchByName(page, candidate.firstName);
    await expect(row(page, candidate.fullName)).toBeVisible();
    expect(await statusOf(page, candidate.fullName)).toBe('Interview Scheduled');
  });

  test('recruitment-status-17 | Trạng thái cập nhật đúng trên Candidate Profile', async ({ page }) => {
    const candidate = state.pipe!;

    await gotoList(page);
    await searchByName(page, candidate.firstName);
    await openProfileFromList(page, candidate.fullName);

    await expectStatus(page, 'Interview Scheduled');
  });

  test('recruitment-status-18 | Các nút hành động hiển thị đúng theo từng trạng thái', async ({ page }) => {
    const candidate = state.actions!;

    await openCandidate(page, candidate);
    await expectActions(page, ['Reject', 'Shortlist']);

    await shortlistOnProfile(page, candidate);
    await expectActions(page, ['Reject', 'Schedule Interview']);

    await scheduleOnProfile(page, candidate, {
      title: uniqueValue('WF-INT-ACTIONS'),
      date: todayInput(),
      time: '11:00 AM',
    });
    await expectActions(page, ['Reject', 'Mark Interview Failed', 'Mark Interview Passed']);

    await markPassedOnProfile(page, candidate);
    await expectActions(page, ['Reject', 'Schedule Interview', 'Offer Job']);

    await offerOnProfile(page, candidate);
    await expectActions(page, ['Reject', 'Offer Declined', 'Hire']);

    await hireOnProfile(page, candidate);
    await expectActions(page, []);
    await expectStatus(page, 'Hired');
  });

  test('recruitment-status-19 | Reject từ trạng thái Shortlisted', async ({ page }) => {
    const candidate = state.shortNeg!;

    await openCandidate(page, candidate);
    await rejectOnProfile(page, candidate);

    await expectStatus(page, 'Rejected');
  });

  test('recruitment-status-20 | Reject từ trạng thái Interview Scheduled', async ({ page }) => {
    const candidate = state.shortTime!;

    await openCandidate(page, candidate);
    await rejectOnProfile(page, candidate);

    await expectStatus(page, 'Rejected');
  });

  test('recruitment-status-21 | Reject từ trạng thái Job Offered', async ({ page }) => {
    const candidate = state.offerReject!;

    await openCandidate(page, candidate);
    await rejectOnProfile(page, candidate);

    await expectStatus(page, 'Rejected');
  });

  test('recruitment-status-22 | Ứng viên Hired không còn hành động', async ({ page }) => {
    const candidate = state.offerHire!;

    await openCandidate(page, candidate);
    await expectStatus(page, 'Hired');
    await expectActions(page, []);
  });

  test('recruitment-status-23 | Chọn nhiều Interviewer khi Schedule Interview', async ({ page }) => {
    const candidate = state.shortMulti!;

    await openCandidate(page, candidate);
    const interview = await scheduleOnProfile(page, candidate, {
      title: uniqueValue('WF-INT-MULTI'),
      date: todayInput(),
      time: '01:30 PM',
      interviewers: ['Amelia', 'Chris'],
    });

    await expectStatus(page, 'Interview Scheduled');

    const text = await historyText(page, interview.title);
    expect(text).toContain(interview.title);
    expect(text).toContain(normalize(interview.interviewers[0]));
    expect(text).toContain(normalize(interview.interviewers[1]));
    expect(dateVariants(interview.date).some((value) => text.includes(value))).toBe(true);
  });

  test('recruitment-status-24 | Interview Title hiển thị trong Candidate History trên hồ sơ', async ({ page }) => {
    const candidate = state.pipe!;
    const interview = state.pipeInterview!;

    await openCandidate(page, candidate);
    const text = await historyText(page, interview.title);

    expect(text).toContain(interview.title);
    expect(text).toContain(normalize(interview.interviewers[0]));
    expect(text).toContain(state.vacancy!.name);
    expect(dateVariants(interview.date).some((value) => text.includes(value))).toBe(true);
  });

  test('recruitment-status-25 | Trạng thái vẫn đúng sau khi refresh trang', async ({ page }) => {
    const candidate = state.pipe!;

    await openCandidate(page, candidate);
    await expectStatus(page, 'Interview Scheduled');

    await page.reload();
    await waitForProfile(page);

    await expectStatus(page, 'Interview Scheduled');
  });

  test('recruitment-status-26 | Mark Interview Passed (Interview Scheduled -> Interview Passed)', async ({ page }) => {
    const candidate = state.pipe!;

    await openCandidate(page, candidate);
    await markPassedOnProfile(page, candidate, 'Passed by E2E workflow');

    await expectStatus(page, 'Interview Passed');
  });
});
