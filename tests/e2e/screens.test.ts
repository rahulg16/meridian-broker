import { test, expect } from '@playwright/test';

test.describe('Meridian Broker Screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('home page loads with market status and virtualized stocks', async ({ page }) => {
    await expect(page).toHaveTitle(/Meridian Broker/);
    await expect(page.locator('text=Meridian')).toBeVisible();
    await expect(page.locator('text=$124,582.30')).toBeVisible();
    await expect(page.locator('text=Popular Stocks')).toBeVisible();
    await expect(page.locator('text=AAPL')).toBeVisible();
    await expect(page.locator('text=TSLA')).toBeVisible();
    await expect(page.locator('text=Market Movers')).toBeVisible();
  });

  test('navigate to portfolio page', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/portfolio');
    await expect(page.locator('text=Portfolio')).toBeVisible();
    await expect(page.locator('text=Wallet cash')).toBeVisible();
  });

  test('navigate to watchlist page', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/watchlist');
    await expect(page.locator('text=Watchlist')).toBeVisible();
    await expect(page.locator('text=Add Symbol')).toBeVisible();
  });

  test('navigate to profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('text=Rahul Gangadharan')).toBeVisible();
    await expect(page.locator('text=rahul@example.com')).toBeVisible();
  });

  test('navigate to trading page', async ({ page }) => {
    await page.goto('/trade/AAPL');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/trade\/AAPL/);
    await expect(page.locator('text=Trade Ticket')).toBeVisible();
    await expect(page.locator('text=Order Book L2')).toBeVisible();
    await expect(page.locator('text=Time & Sales')).toBeVisible();
    await expect(page.locator('text=Order History')).toBeVisible();
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await expect(page.locator('text=Home')).toBeVisible();
    await expect(page.locator('text=Portfolio')).toBeVisible();
    await expect(page.locator('text=Watchlist')).toBeVisible();
    await expect(page.locator('text=Profile')).toBeVisible();
  });

  test('virtualized list renders stock rows', async ({ page }) => {
    await expect(page.locator('text=AAPL')).toBeVisible();
    await expect(page.locator('text=MSFT')).toBeVisible();
    await expect(page.locator('text=GOOGL')).toBeVisible();
  });

  test('watchlist add symbol dialog opens', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.click('text=Add Symbol');
    await expect(page.locator('text=Add Symbol')).toBeVisible();
    await expect(page.locator('input[placeholder*="AAPL"]')).toBeVisible();
  });

  test('order book and tape render on trading page', async ({ page }) => {
    await page.goto('/trade/AAPL');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Order Book L2')).toBeVisible();
    await expect(page.locator('text=Time & Sales')).toBeVisible();
    await expect(page.locator('text=Spread')).toBeVisible();
  });
});
