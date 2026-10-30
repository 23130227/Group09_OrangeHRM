/**
 * ASM7 - Automation script - Group09 - 23130233 - Tran Loi Phat
 * Website : https://opensource-demo.orangehrmlive.com  (OrangeHRM OS 5.9, online)
 * Module  : Claim  -  Function: Events (Claim > Configuration > Events)
 * Tool    : Playwright Test + TypeScript (runs on the installed Google Chrome)
 * Test cases: [Claim-Events-1] ... [Claim-Events-23]  (same IDs as the Excel test case file)
 * Expected result: 23 passed - [Claim-Events-9] is marked test.fail() because it reproduces
 *                  the known website defect BUG-01 (expected failure).
 *
 * Run (PowerShell):
 *   npm.cmd init -y
 *   npm.cmd i -D @playwright/test
 *   $env:HRM_USER="<username on the login page>"; $env:HRM_PASS="<password on the login page>"
 *   npx.cmd playwright test 23130233_TranLoiPhat_ASM7.spec.ts --workers=1 --reporter=list
 *   (headless: results are printed in the terminal only)
 * Optional: add --headed to watch Chrome; $env:SLOWMO="500" slows every action by 500 ms
 */
import { test, expect, Page, Browser, Locator } from '@playwright/test';

// ============================== CONFIG ==============================
const BASE = 'https://opensource-demo.orangehrmlive.com/web/index.php/';
const USER = process.env.HRM_USER ?? '';
const PASS = process.env.HRM_PASS ?? '';
const LIST = BASE + 'claim/viewEvents';
const ADD = BASE + 'claim/saveEvents';
const CREATED: string[] = [];                 // events created by the script -> deleted in afterAll

test.use({
  channel: 'chrome',                          // use the Google Chrome installed on the computer
  viewport: { width: 1440, height: 900 },
  launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  actionTimeout: 15_000,
});
test.describe.configure({ timeout: 120_000 });

const unique = (prefix: string) => `${prefix} ${Date.now() % 10_000_000}`;

/** XPath of the OXD input group whose label is `label` (ignores the * mark). */
const group = (label: string) =>
  `xpath=//div[contains(@class,'oxd-input-group')][.//label[normalize-space(translate(., '*', ''))='${label}']]`;

// ============================== PAGE OBJECT ==============================
class EventsPage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  field(label: string): Locator {
    return this.page.locator(group(label)).locator('input, textarea').first();
  }
  error(label: string): Locator {
    return this.page.locator(group(label)).locator('.oxd-input-field-error-message');
  }
  toast(): Locator {
    return this.page.locator('.oxd-toast').first();
  }
  records(): Locator {
    return this.page.locator('span', { hasText: /Records? Found/ }).first();
  }
  row(name: string): Locator {
    return this.page.locator(`xpath=//div[contains(@class,'oxd-table-card')][.//div[normalize-space()='${name}']]`);
  }

  async waitReady() {
    await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(this.page.locator('.oxd-loading-spinner, .oxd-form-loader')).toHaveCount(0, { timeout: 15_000 });
  }
  async openList() { await this.page.goto(LIST); await this.waitReady(); }
  async openAdd()  { await this.page.goto(ADD);  await this.waitReady(); }

  async fill(name?: string, description?: string, active?: boolean) {
    if (name !== undefined) await this.field('Event Name').fill(name);
    if (description !== undefined) await this.field('Description').fill(description);
    if (active !== undefined) {
      const checked = await this.page.locator("form input[type='checkbox']").isChecked();
      if (checked !== active) await this.page.locator('form .oxd-switch-input').click();
    }
  }
  async save() { await this.page.getByRole('button', { name: 'Save' }).click(); }

  /**
   * Click Save and wait until the app goes back to the Events list.
   * (The 'Successfully Saved/Updated' toast only flashes before the redirect, so we do not rely on it;
   *  the tests check the saved data in the list instead.)
   */
  async saveAndBackToList() {
    await this.page.waitForTimeout(2000);     // let the async duplicate-name check finish
    await this.save();
    try {
      await this.page.waitForURL(/claim\/viewEvents/, { timeout: 20_000 });
    } catch {
      const errors = await this.page.locator('.oxd-input-field-error-message').allInnerTexts();
      throw new Error(`Record was not saved. Form errors: ${errors.join(', ') || 'none'}`);
    }
    await this.waitReady();
  }

  /** Add an event through the UI and wait for the list page. */
  async create(name: string, description = '', active = true) {
    await this.openAdd();
    await this.fill(name, description, active);
    await this.saveAndBackToList();
    CREATED.push(name);
  }

  /** Type into the Event Name filter and return the real hints ('No Records Found' is not a hint). */
  async hints(text: string): Promise<string[]> {
    const input = this.field('Event Name');
    await input.fill('');
    await input.pressSequentially(text, { delay: 50 });
    const options = this.page.locator('.oxd-autocomplete-option');
    await expect(options.first()).toBeVisible();
    await expect(options.first()).not.toHaveText(/Searching/);
    return (await options.allInnerTexts()).map(t => t.trim()).filter(t => t && t !== 'No Records Found');
  }

  async search(name?: string, status?: string) {
    if (name) {
      await this.hints(name);
      await this.page.locator('.oxd-autocomplete-option', { hasText: name }).first().click();
    }
    if (status) {
      await this.page.locator(group('Status')).locator('.oxd-select-text').click();
      await this.page.getByRole('option', { name: status, exact: true }).click();
    }
    await this.page.getByRole('button', { name: 'Search' }).click();
    await this.waitReady();
  }

  async rows(): Promise<string[]> {
    await this.waitReady();
    const texts = await this.page.locator('.oxd-table-card').allInnerTexts();
    return texts.map(t => t.split('\n').map(s => s.trim()).filter(Boolean).join(' | '));
  }
  async names(): Promise<string[]> {
    return (await this.rows()).map(r => r.split(' | ')[0]);
  }

  async edit(name: string) {
    await this.row(name).locator('i.bi-pencil-fill').click();
    await this.page.waitForURL(/saveEvents\/\d+/);
    await this.waitReady();
  }
  async remove(name: string, confirm: boolean): Promise<string> {
    await this.row(name).locator('i.bi-trash').click();
    const dialog = this.page.locator('.oxd-dialog-sheet');
    await expect(dialog).toBeVisible();
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    await dialog.getByRole('button', { name: confirm ? 'Yes, Delete' : 'No, Cancel' }).click();
    return text;
  }
}

// ============================== LOGIN / DATA / CLEANUP ==============================
async function login(page: Page) {
  expect(USER && PASS, 'Set HRM_USER and HRM_PASS (demo account shown on the login page)').toBeTruthy();
  await page.goto(BASE + 'auth/login');
  await page.locator("input[name='username']").fill(USER);
  await page.locator("input[name='password']").fill(PASS);
  await page.locator("button[type='submit']").click();
  await page.waitForURL(/dashboard/);
}

/** Shared data for the file: 1 active + 1 inactive event, created once before the tests. */
const ev = { active: unique('G09 Travel'), inactive: unique('G09 Inactive') };

async function withLoggedInPage(browser: Browser, fn: (p: EventsPage) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page);
  await fn(new EventsPage(page));
  await context.close();
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);                   // the shared demo site can be slow: allow 3 minutes for setup
  await withLoggedInPage(browser, async p => {
    await p.create(ev.active, 'Business trip expenses - Group09 test');
    await p.create(ev.inactive, 'Inactive event - Group09 test', false);
  });
});

test.afterAll(async ({ browser }) => {
  test.setTimeout(120_000);
  // Clean up the events created by this run with the app's own REST API (same login session)
  await withLoggedInPage(browser, async p => {
    const result = await p.page.evaluate(async (names: string[]) => {
      const res = await fetch('/web/index.php/api/v2/claim/events?limit=200&offset=0').then(r => r.json());
      const ids = (res.data ?? []).filter((e: any) => names.includes(e.name)).map((e: any) => e.id);
      if (!ids.length) return 'nothing to delete';
      await fetch('/web/index.php/api/v2/claim/events', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      });
      return `deleted ${ids.length}`;
    }, CREATED);
    console.log('Cleanup:', result);
  });
});

test.beforeEach(async ({ page }) => {
  await login(page);
});

// ============================== TEST CASES ==============================
test('[Claim-Events-1] Check UI of Events list screen', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  await expect(p.records()).toContainText('Records Found');
  await expect(p.field('Event Name')).toHaveAttribute('placeholder', 'Type for hints...');
  await expect(page.locator(group('Status')).locator('.oxd-select-text-input')).toHaveText('-- Select --');
  for (const b of ['Reset', 'Search', 'Add']) await expect(page.getByRole('button', { name: b })).toBeVisible();
  const names = await p.names();
  for (const n of ['Accommodation', 'Medical Reimbursement', 'Travel Allowance']) expect(names).toContain(n);
});

test('[Claim-Events-2] Add a valid event', async ({ page }) => {
  const p = new EventsPage(page);
  const name = unique('G09 Add');
  await p.create(name, 'Business trip expenses - Group09 test');
  expect((await p.rows()).some(r => r.startsWith(name) && r.endsWith('Active'))).toBeTruthy();
});

test('[Claim-Events-3] Event Name is empty', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openAdd();
  await p.save();
  await expect(p.error('Event Name')).toHaveText('Required');
  await expect(page).toHaveURL(/claim\/saveEvents$/);
});

test('[Claim-Events-4] Event Name contains only spaces', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openAdd();
  await p.fill('   ');
  await p.save();
  await expect(p.error('Event Name')).toHaveText('Required');
});

test('[Claim-Events-5] Event Name with 100 characters (upper boundary)', async ({ page }) => {
  const p = new EventsPage(page);
  const name = unique('G09').padEnd(100, 'L');
  expect(name.length).toBe(100);
  await p.create(name);
});

test('[Claim-Events-6] Event Name with 101 characters (over boundary)', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openAdd();
  await p.fill('G'.repeat(101));
  await expect(p.error('Event Name')).toHaveText('Should not exceed 100 characters');
});

test('[Claim-Events-7] Event Name duplicates an existing event', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openAdd();
  await p.fill('Accommodation');
  await expect(p.error('Event Name')).toHaveText('Already exists');
});

test('[Claim-Events-8] Event Name duplicates with different letter case', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openAdd();
  await p.fill('accommodation');
  await expect(p.error('Event Name')).toHaveText('Already exists');
});

test('[Claim-Events-9] Event Name duplicates with leading/trailing spaces (known bug BUG-01)', async ({ page }) => {
  // Expected 'Already exists', but the website shows toast 'Invalid Parameter' -> known defect BUG-01.
  test.fail(true, "Known website defect BUG-01: no 'Already exists' message for a duplicate name with spaces");
  const p = new EventsPage(page);
  await p.openAdd();
  await p.fill(`  ${ev.active}  `);
  await expect(p.error('Event Name')).toHaveText('Already exists', { timeout: 5_000 });
});

test('[Claim-Events-10] Description with 1000 / 1001 characters', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openAdd();
  await p.fill('G09 Desc Test', 'D'.repeat(1000));
  await page.waitForTimeout(1000);
  await expect(p.error('Description')).toHaveCount(0);
  await p.fill(undefined, 'D'.repeat(1001));
  await expect(p.error('Description')).toHaveText('Should not exceed 1000 characters');
});

test('[Claim-Events-11] Add an inactive event', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  expect((await p.rows()).some(r => r.startsWith(ev.inactive) && r.endsWith('Inactive'))).toBeTruthy();
});

test('[Claim-Events-12] Cancel button on Add Event screen', async ({ page }) => {
  const p = new EventsPage(page);
  const name = unique('G09 Cancel');
  await p.openAdd();
  await p.fill(name);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForURL(/claim\/viewEvents/);
  expect(await p.names()).not.toContain(name);
});

test('[Claim-Events-13] Search by Event Name (select from hints)', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  expect(await p.hints('G09 Travel')).toContain(ev.active);
  await p.search(ev.active);
  await expect(p.records()).toHaveText('(1) Records Found');
  expect(await p.names()).toEqual([ev.active]);
});

test('[Claim-Events-14] Search with a non-existent name', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  expect(await p.hints('G09 Khong Ton Tai')).toEqual([]);             // no real hint
  await expect(page.locator('.oxd-autocomplete-option').first()).toHaveText('No Records Found');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(p.toast()).toContainText('No Records Found');
  expect(await p.rows()).toEqual([]);
});

test('[Claim-Events-15] Filter by Status = Inactive', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  await p.search(undefined, 'Inactive');
  const rows = await p.rows();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(r => r.endsWith('Inactive'))).toBeTruthy();
  expect(await p.names()).toContain(ev.inactive);
});

test('[Claim-Events-16] Reset button of the filter', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  const total = await p.records().innerText();
  await p.search(ev.active);
  await page.getByRole('button', { name: 'Reset' }).click();
  await p.waitReady();
  await expect(p.field('Event Name')).toHaveValue('');
  await expect(page.locator(group('Status')).locator('.oxd-select-text-input')).toHaveText('-- Select --');
  await expect(p.records()).toHaveText(total);
});

test('[Claim-Events-17] Sort by Event Name descending', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  const header = page.locator("xpath=//div[contains(@class,'oxd-table-header-cell')][contains(normalize-space(),'Event Name')]");
  await header.locator('.oxd-table-header-sort-icon').click();
  await header.getByText('Descending', { exact: true }).click();
  await p.waitReady();
  const names = await p.names();
  const expected = [...names].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? 1 : a.toLowerCase() > b.toLowerCase() ? -1 : 0));
  expect(names).toEqual(expected);
});

test('[Claim-Events-18] Edit event - name validation', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  await p.edit(ev.active);
  await expect(p.field('Event Name')).toHaveValue(ev.active);
  await p.fill('Medical Reimbursement');
  await expect(p.error('Event Name')).toHaveText('Already exists');
  await p.fill('');
  await expect(p.error('Event Name')).toHaveText('Required');
});

test('[Claim-Events-19] Edit event name and description', async ({ page }) => {
  const p = new EventsPage(page);
  const newName = unique('G09 Business Trip');
  await p.openList();
  await p.edit(ev.active);
  const oldName = ev.active;
  await p.fill(newName, 'Updated by Group09');
  await p.saveAndBackToList();
  CREATED.push(newName);
  ev.active = newName;
  const names = await p.names();
  expect(names).toContain(newName);
  expect(names).not.toContain(oldName);          // old name was replaced
});

test('[Claim-Events-20] Edit event from Active to Inactive', async ({ page }) => {
  const p = new EventsPage(page);
  const name = unique('G09 Toggle');
  await p.create(name);
  await p.edit(name);
  await p.fill(undefined, undefined, false);
  await p.saveAndBackToList();
  expect((await p.rows()).some(r => r.startsWith(name) && r.endsWith('Inactive'))).toBeTruthy();
});

test('[Claim-Events-21] Delete event - select No, Cancel', async ({ page }) => {
  const p = new EventsPage(page);
  await p.openList();
  const text = await p.remove(ev.inactive, false);
  expect(text).toContain('Are you Sure?');
  expect(text).toContain('permanently deleted');
  expect(await p.names()).toContain(ev.inactive);
});

test('[Claim-Events-22] Delete event - select Yes, Delete', async ({ page }) => {
  const p = new EventsPage(page);
  const name = unique('G09 Delete');
  await p.create(name);
  await p.remove(name, true);
  await expect(p.toast()).toContainText('Successfully Deleted');
  await expect(p.row(name)).toHaveCount(0);
});

test('[Claim-Events-23] Delete multiple events at once', async ({ page }) => {
  const p = new EventsPage(page);
  const names = [unique('G09 Bulk A'), unique('G09 Bulk B')];
  for (const n of names) await p.create(n);
  for (const n of names) await p.row(n).locator('.oxd-checkbox-input').click();
  await expect(page.getByText('(2) Records Selected')).toBeVisible();
  await page.getByRole('button', { name: 'Delete Selected' }).click();
  await page.locator('.oxd-dialog-sheet').getByRole('button', { name: 'Yes, Delete' }).click();
  await expect(p.toast()).toContainText('Successfully Deleted');
  for (const n of names) await expect(p.row(n)).toHaveCount(0);
});
