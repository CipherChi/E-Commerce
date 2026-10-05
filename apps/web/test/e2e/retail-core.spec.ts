import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3001';
const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test('retail sale, receipt, PDF, tenant isolation, and idempotent replay', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const email = `retail-${unique}@example.test`;
  const customerName = `Retail Customer ${unique}`;
  const businessName = `Retail Shop ${unique}`;
  const productName = `Stocked Item ${unique}`;
  let saleRequest: { body: Record<string, unknown>; key: string } | undefined;

  page.on('request', (requestEvent) => {
    if (requestEvent.method() !== 'POST' || new URL(requestEvent.url()).pathname !== '/sales')
      return;
    const headers = requestEvent.headers();
    const body = requestEvent.postDataJSON() as Record<string, unknown>;
    saleRequest = { body, key: headers['idempotency-key'] };
  });

  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill(`Retail Owner ${unique}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Primary business type').selectOption('SUPERMARKET');
  await page.getByLabel('Password', { exact: true }).fill('RetailFlow!2026');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/business$/);
  await page.getByLabel('Business name').fill(businessName);
  await page.getByLabel('Phone').fill('08030000001');
  await page.getByLabel('Address').fill('1 Market Road');
  const businessResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/businesses',
  );
  await page.getByRole('button', { name: 'Create business' }).click();
  const businessResponse = await businessResponsePromise;
  const businessResponseBody = await businessResponse.text();
  expect(
    businessResponse.status(),
    `Business creation returned ${businessResponse.status()}: ${businessResponseBody}`,
  ).toBe(201);
  await expect(page).toHaveURL(/\/dashboard$/);

  const token = await page.evaluate(() => sessionStorage.getItem('staywise.accessToken'));
  expect(token).toBeTruthy();
  const authHeaders = { Authorization: `Bearer ${token}` };

  await page.goto('/products');
  const productForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Add item' }) });
  await productForm.getByLabel('Name', { exact: true }).fill(productName);
  await productForm.locator('select[name="module"]').selectOption('FOOD');
  await productForm.locator('input[name="category"]').fill('Retail');
  await productForm.locator('input[name="sellingPrice"]').fill('1000');
  await productForm.getByLabel('Track this item in inventory').check();
  await productForm.getByRole('button', { name: 'Create item' }).click();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  const catalogResponse = await request.get(`${apiUrl}/catalog`, { headers: authHeaders });
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = (await catalogResponse.json()) as Array<{ id: string; name: string }>;
  const product = catalog.find((item) => item.name === productName);
  expect(product).toBeTruthy();

  await page.goto('/inventory');
  await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption(product!.id);
  await page.getByLabel('Quantity', { exact: true }).fill('10');
  await page.getByLabel('Note (optional)').fill('Opening stock');
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.getByText('+10', { exact: true })).toBeVisible();

  await page.goto('/customers');
  await page.getByLabel('Full name').fill(customerName);
  await page.getByLabel('Phone', { exact: true }).fill('08030000002');
  await page.getByRole('button', { name: 'Save guest' }).click();
  await expect(page.getByRole('link', { name: customerName })).toBeVisible();
  const customersResponse = await request.get(`${apiUrl}/customers`, { headers: authHeaders });
  const customers = (await customersResponse.json()) as Array<{ id: string; name: string }>;
  const customer = customers.find((entry) => entry.name === customerName);
  expect(customer).toBeTruthy();

  await page.goto('/sales');
  const saleForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'New sale' }) });
  await saleForm.getByRole('combobox').nth(0).selectOption(customer!.id);
  await page.getByRole('button', { name: '+ Add item' }).click();
  await saleForm.getByRole('combobox').nth(1).selectOption(product!.id);
  await saleForm.getByLabel('Qty', { exact: true }).fill('3');
  await saleForm.getByRole('combobox').nth(3).selectOption('PARTIAL');
  await saleForm.getByLabel('Amount received').fill('1000');
  const saleResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/sales',
  );
  await saleForm.getByRole('button', { name: 'Complete sale' }).click();
  const saleResponse = await saleResponsePromise;
  expect(saleResponse.status()).toBe(201);
  const sale = (await saleResponse.json()) as { id: string; receiptNumber: string; total: string };
  expect(saleRequest?.key).toBeTruthy();
  await expect(page.getByRole('link', { name: 'View receipt' })).toBeVisible();
  await expect(page.getByText('1 recent sales')).toBeVisible();

  const currentResponse = await request.get(`${apiUrl}/inventory/${product!.id}/current`, {
    headers: authHeaders,
  });
  expect(currentResponse.ok()).toBeTruthy();
  expect((await currentResponse.json()).quantity).toBe(7);
  const saleDetailResponse = await request.get(`${apiUrl}/sales/${sale.id}`, {
    headers: authHeaders,
  });
  expect(saleDetailResponse.ok()).toBeTruthy();
  const saleDetail = (await saleDetailResponse.json()) as {
    businessId: string;
    total: string;
    items: Array<{ businessId: string | null }>;
    movements: Array<{ type: string; quantity: number }>;
  };
  expect(
    saleDetail.movements.some(
      (movement) => movement.type === 'STOCK_OUT' && movement.quantity === -3,
    ),
  ).toBeTruthy();
  expect(saleDetail.items.length).toBe(1);
  expect(saleDetail.businessId).toBeTruthy();
  for (const item of saleDetail.items) {
    expect(item.businessId).toBeTruthy();
    expect(item.businessId).toBe(saleDetail.businessId);
  }
  expect(saleDetail.total).toBe('3000');

  const receiptLink = page.getByRole('link', { name: 'View receipt' });
  const receiptHref = await receiptLink.getAttribute('href');
  expect(receiptHref).toBe(`/receipts/${sale.id}`);
  await receiptLink.click();
  await expect(page).toHaveURL(new RegExp(`/receipts/${sale.id}$`));
  await expect(page.getByRole('heading', { name: businessName })).toBeVisible();
  await expect(page.getByText(sale.receiptNumber, { exact: true })).toBeVisible();
  await expect(page.getByText(`Customer: ${customerName} 08030000002`)).toBeVisible();
  await expect(page.getByText(`${productName} (3 × NGN 1,000.00)`)).toBeVisible();
  await expect(page.getByText('Subtotal NGN 3,000.00')).toBeVisible();
  await expect(page.getByText('Total NGN 3,000.00', { exact: true })).toBeVisible();
  await expect(page.getByText('CASH · PARTIAL')).toBeVisible();
  await expect(page.getByText('Paid NGN 1,000.00 · Balance NGN 2,000.00')).toBeVisible();
  expect(sale.receiptNumber).toMatch(/^RCT-\d{4}-\d{6}$/);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const pdf = await readFile(pdfPath!);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.byteLength).toBeGreaterThan(500);

  const receiptResponse = await request.get(`${apiUrl}/receipts/${sale.id}`, {
    headers: authHeaders,
  });
  expect(receiptResponse.ok()).toBeTruthy();
  const receipt = (await receiptResponse.json()) as {
    publicUrl: string;
    receiptNumber: string;
    balance: string;
    paymentStatus: string;
  };
  expect(receipt.receiptNumber).toBe(sale.receiptNumber);
  expect(receipt.paymentStatus).toBe('PARTIAL');
  expect(receipt.balance).toBe('2000');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(receipt.publicUrl);
  await expect(anonymousPage.getByRole('heading', { name: businessName })).toBeVisible();
  await expect(anonymousPage.getByText(sale.receiptNumber, { exact: true })).toBeVisible();
  await anonymousContext.close();

  const publicToken = new URL(receipt.publicUrl).pathname.split('/').at(-1)!;
  const tamperedToken = `${publicToken.slice(0, -1)}${publicToken.endsWith('a') ? 'b' : 'a'}`;
  const tamperedResponse = await request.get(`${apiUrl}/receipts/public/${tamperedToken}`);
  expect(tamperedResponse.status()).toBe(404);

  expect(saleRequest).toBeTruthy();
  const replay = await request.post(`${apiUrl}/sales`, {
    headers: { ...authHeaders, 'Idempotency-Key': saleRequest!.key },
    data: saleRequest!.body,
  });
  expect(replay.ok()).toBeTruthy();
  const replayedSale = (await replay.json()) as { id: string; receiptNumber: string };
  expect(replayedSale.id).toBe(sale.id);
  expect(replayedSale.receiptNumber).toBe(sale.receiptNumber);
  const salesResponse = await request.get(`${apiUrl}/sales`, { headers: authHeaders });
  const sales = (await salesResponse.json()) as Array<{ id: string }>;
  expect(sales).toHaveLength(1);
  expect(sales[0].id).toBe(sale.id);
  expect(
    (
      await (
        await request.get(`${apiUrl}/inventory/${product!.id}/current`, { headers: authHeaders })
      ).json()
    ).quantity,
  ).toBe(7);

  const secondEmail = `other-${unique}@example.test`;
  const secondRegister = await request.post(`${apiUrl}/auth/register`, {
    data: {
      name: `Other Owner ${unique}`,
      email: secondEmail,
      password: 'RetailFlow!2026',
      primaryType: 'SUPERMARKET',
    },
  });
  const secondRegisterBody = await secondRegister.text();
  expect(
    secondRegister.ok(),
    `Second registration returned ${secondRegister.status()}: ${secondRegisterBody}`,
  ).toBeTruthy();
  const secondTokens = JSON.parse(secondRegisterBody) as { accessToken: string };
  const secondBusiness = await request.post(`${apiUrl}/businesses`, {
    headers: { Authorization: `Bearer ${secondTokens.accessToken}` },
    data: { name: `Other Shop ${unique}`, primaryType: 'SUPERMARKET' },
  });
  expect(secondBusiness.ok()).toBeTruthy();
  const crossTenantReceipt = await request.get(`${apiUrl}/receipts/${sale.id}`, {
    headers: { Authorization: `Bearer ${secondTokens.accessToken}` },
  });
  expect(crossTenantReceipt.status()).toBe(404);
});
