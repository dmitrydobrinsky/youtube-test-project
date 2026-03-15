import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear app state before each test
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('app loads and shows Setup as the first step', async ({ page }) => {
  await expect(page.locator('#step-1')).toBeVisible();
  await expect(page.locator('#step-1 .step-title')).toHaveText('Planning Setup');
  await expect(page.locator('#step-2')).not.toBeVisible();
});

test('quarter cards are rendered', async ({ page }) => {
  const cards = page.locator('.quarter-card');
  await expect(cards).toHaveCount(6);
  // First card should be the current or next quarter
  const firstText = await cards.first().textContent();
  expect(firstText).toMatch(/Q\d \d{4}/);
});

test('clicking a quarter card selects it', async ({ page }) => {
  const cards = page.locator('.quarter-card');
  const second = cards.nth(1);
  await second.click();
  await expect(second).toHaveClass(/selected/);
  // Others should not be selected
  await expect(cards.nth(0)).not.toHaveClass(/selected/);
});

test('Setup tab is active on load', async ({ page }) => {
  const tab = page.locator('.wiz-tab[data-step="1"]');
  await expect(tab).toHaveClass(/active/);
});

test('Next button is enabled on Setup step (no guard)', async ({ page }) => {
  await expect(page.locator('#btn-next')).toBeEnabled();
});

test('Back button is disabled on first step', async ({ page }) => {
  await expect(page.locator('#btn-back')).toBeDisabled();
});

test('Next advances to Team Setup (step 2)', async ({ page }) => {
  await page.locator('#btn-next').click();
  await expect(page.locator('#step-2')).toBeVisible();
  await expect(page.locator('#step-2 .step-title')).toHaveText('Team Setup');
  await expect(page.locator('.wiz-tab[data-step="2"]')).toHaveClass(/active/);
});

test('Team Setup Next is blocked when team is empty', async ({ page }) => {
  await page.locator('#btn-next').click(); // go to Team Setup
  await page.locator('#btn-next').click(); // try to advance
  // Should still be on step 2
  await expect(page.locator('#step-2')).toBeVisible();
});

test('Back button returns to previous step', async ({ page }) => {
  await page.locator('#btn-next').click(); // Setup → Team
  await expect(page.locator('#step-2')).toBeVisible();
  await page.locator('#btn-back').click(); // Team → Setup
  await expect(page.locator('#step-1')).toBeVisible();
});

test('done tab allows clicking back to a previous step', async ({ page }) => {
  await page.locator('#btn-next').click(); // go to step 2
  const setupTab = page.locator('.wiz-tab[data-step="1"]');
  await expect(setupTab).toHaveClass(/done/);
  await setupTab.click();
  await expect(page.locator('#step-1')).toBeVisible();
});

test('all 7 tabs are present', async ({ page }) => {
  const tabs = page.locator('.wiz-tab');
  await expect(tabs).toHaveCount(7);
});

test('quarter label appears in header after selection', async ({ page }) => {
  const cards = page.locator('.quarter-card');
  const label = await cards.first().textContent();
  // Header should show the selected quarter
  await expect(page.locator('#quarter-label')).toContainText(label.trim());
});

// ── Setup screen connection cards ─────────────────────────────────────────────

test('Shapes card has Test Connection button', async ({ page }) => {
  await expect(page.locator('#start-shapes-test')).toBeVisible();
  await expect(page.locator('#start-shapes-test')).toHaveText('Test Connection');
});

test('Shapes card shows error when testing with no token', async ({ page }) => {
  await page.locator('#start-shapes-test').click();
  await expect(page.locator('#start-shapes-status')).toContainText('Enter a refresh or access token first');
});

test('Jira card has Test Connection button', async ({ page }) => {
  await expect(page.locator('#start-jira-test')).toBeVisible();
});

test('Holidays card is present with Load from Shapes button', async ({ page }) => {
  await expect(page.locator('#start-holidays-load')).toBeVisible();
  await expect(page.locator('#start-holidays-load')).toHaveText('Load from Shapes');
});

test('Holidays card Save button is hidden until countries are loaded', async ({ page }) => {
  await expect(page.locator('#start-holidays-save')).toBeHidden();
});

test('Holidays card shows error when loading without Shapes token', async ({ page }) => {
  await page.locator('#start-holidays-load').click();
  await expect(page.locator('#start-holidays-status')).toContainText('Connect Shapes first');
});

// ── Wish List screen ──────────────────────────────────────────────────────────

test('Wish List has Why column header', async ({ page }) => {
  // Navigate to Wish List (step 3) — need to pass Team Setup guard first
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('qp_state_v1') || '{}');
    state.team = [{ id: 't1', name: 'Alice', role: 'Algo', capacityPct: 100, availableWeeks: 13, personDays: 65 }];
    state.meta = { ...(state.meta || {}), currentStep: 3 };
    localStorage.setItem('qp_state_v1', JSON.stringify(state));
  });
  await page.reload();
  const headers = page.locator('#step-3 .data-table th');
  const texts = await headers.allTextContents();
  expect(texts).toContain('Why');
});

test('Wish List has Export CSV button', async ({ page }) => {
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('qp_state_v1') || '{}');
    state.meta = { ...(state.meta || {}), currentStep: 3 };
    localStorage.setItem('qp_state_v1', JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('#wl-export-csv')).toBeVisible();
  await expect(page.locator('#wl-export-csv')).toContainText('Export CSV');
});

test('Wish List Add Row creates row with Why input', async ({ page }) => {
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('qp_state_v1') || '{}');
    state.meta = { ...(state.meta || {}), currentStep: 3 };
    localStorage.setItem('qp_state_v1', JSON.stringify(state));
  });
  await page.reload();
  await page.locator('#wl-add-row').click();
  const row = page.locator('#wl-tbody tr').first();
  await expect(row.locator('input[data-field="why"]')).toBeVisible();
});
