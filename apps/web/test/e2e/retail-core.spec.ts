import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const apiUrl = process.env.API_URL ?? process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001';
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
  await expect(page).toHaveTitle('E Commerce Site');
  await page.getByLabel('Name', { exact: true }).fill(`Retail Owner ${unique}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Primary business type').selectOption('SUPERMARKET');
  await page.getByLabel('Password', { exact: true }).fill('RetailFlow!2026');
  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/auth/register',
  );
  await page.getByRole('button', { name: 'Create account' }).click();
  const registrationResponse = await registrationResponsePromise;
  const registration = (await registrationResponse.json()) as { accessToken: string };

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

  expect(registration.accessToken).toBeTruthy();
  const authHeaders = { Authorization: `Bearer ${registration.accessToken}` };

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
  const catalog = (await catalogResponse.json()) as {
    data: Array<{ id: string; name: string }>;
  };
  const product = catalog.data.find((item) => item.name === productName);
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
  const customers = (await customersResponse.json()) as {
    data: Array<{ id: string; name: string }>;
  };
  const customer = customers.data.find((entry) => entry.name === customerName);
  expect(customer).toBeTruthy();

  await page.goto('/sales');
  const saleForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'New sale' }) });
  await saleForm.getByRole('searchbox', { name: 'Customer (optional)' }).fill(customerName);
  await saleForm.getByRole('button', { name: customerName }).click();
  await page.getByRole('button', { name: '+ Add item' }).click();
  await expect(saleForm.getByText(productName, { exact: true })).toBeVisible();
  await saleForm.getByLabel('Qty', { exact: true }).fill('3');
  await saleForm.getByLabel('Payment status').selectOption('PARTIAL');
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
  await expect(page.getByText('1 sales · Page 1 of 1')).toBeVisible();

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
  const sales = (await salesResponse.json()) as { data: Array<{ id: string }> };
  expect(sales.data).toHaveLength(1);
  expect(sales.data[0].id).toBe(sale.id);
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

test('reservation booking moves through confirmation, check-in, and checkout', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `reservation-${suffix}@example.test`;
  const password = 'ReservationFlow!2026';
  const customerName = `Reservation Guest ${suffix}`;
  const businessName = `Reservation Business ${suffix}`;
  const propertyName = `Reservation Property ${suffix}`;
  const roomLabel = `R-${suffix.slice(-5)}`;

  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill(`Reservation Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Primary business type').selectOption('HOTEL');
  await page.getByLabel('Password', { exact: true }).fill(password);
  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/auth/register',
  );
  await page.getByRole('button', { name: 'Create account' }).click();
  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  const { accessToken } = (await registrationResponse.json()) as { accessToken: string };
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  await expect(page).toHaveURL(/\/business$/);
  await page.getByLabel('Business name').fill(businessName);
  await page.getByLabel('Phone').fill('08030000001');
  await page.getByLabel('Address').fill('1 Booking Road');
  const businessResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/businesses',
  );
  await page.getByRole('button', { name: 'Create business' }).click();
  const businessResponse = await businessResponsePromise;
  expect(businessResponse.status()).toBe(201);
  await expect(page).toHaveURL(/\/dashboard$/);

  const propertyResponse = await request.post(`${apiUrl}/properties`, {
    headers: authHeaders,
    data: { name: propertyName, address: '1 Booking Road', type: 'HOTEL' },
  });
  expect(propertyResponse.status()).toBe(201);
  const property = (await propertyResponse.json()) as { id: string };

  const roomResponse = await request.post(`${apiUrl}/properties/${property.id}/rooms`, {
    headers: authHeaders,
    data: { label: roomLabel, type: 'Standard', capacity: 2, basePrice: '100.00' },
  });
  expect(roomResponse.status()).toBe(201);
  const room = (await roomResponse.json()) as { id: string };

  const customerResponse = await request.post(`${apiUrl}/customers`, {
    headers: authHeaders,
    data: { name: customerName, phone: '+2348098765432' },
  });
  expect(customerResponse.status()).toBe(201);

  await page.goto('/bookings');
  await page.getByLabel('Customer').fill(customerName);
  await page.getByRole('button', { name: new RegExp(customerName) }).click();
  await page.getByLabel('Property').selectOption({ label: propertyName });
  await page.getByLabel('Room').selectOption(room.id);
  await page.getByLabel('Check-in').fill('2032-02-01');
  await page.getByLabel('Check-out').fill('2032-02-02');
  await expect(page.getByRole('status')).toContainText('Room is available');
  await page.getByRole('button', { name: 'Create booking' }).click();
  await expect(page).toHaveURL(/\/bookings\/.+/);
  await expect(page.getByRole('heading', { name: customerName })).toBeVisible();
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByText('CONFIRMED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByText('CHECKED IN', { exact: true })).toBeVisible();
  await expect(page.getByText('Room status: occupied')).toBeVisible();
  await page.getByRole('button', { name: 'Check out' }).click();
  await expect(page.getByText('CHECKED OUT', { exact: true })).toBeVisible();
  await expect(page.getByText('Room status: cleaning')).toBeVisible();
});
