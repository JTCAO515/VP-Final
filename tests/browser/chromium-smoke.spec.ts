import { expect, test } from '@playwright/test';

test('Chromium launches and renders a local page', async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <title>Chromium smoke</title>
      </head>
      <body>
        <main>
          <h1>Chromium automation ready</h1>
        </main>
      </body>
    </html>
  `);

  await expect(page.getByRole('heading', { name: 'Chromium automation ready' })).toBeVisible();
});
