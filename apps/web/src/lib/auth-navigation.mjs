const fallbackPath = '/dashboard';
const origin = 'https://staywise.invalid';

const ownerLinks = [
  ['Dashboard', '/dashboard'],
  ['Properties', '/properties', 'LODGING'],
  ['Bookings', '/bookings', 'LODGING'],
  ['Customers', '/customers'],
  ['Products & Services', '/products'],
  ['Inventory (Stock)', '/inventory'],
  ['Sales', '/sales'],
  ['Receipts', '/receipts'],
  ['Expenses', '/expenses'],
  ['Staff', '/staff'],
  ['Settings', '/settings'],
];

const staffLinks = [
  ['Dashboard', '/dashboard'],
  ['New sale', '/sales/new'],
  ['Sales history', '/sales'],
  ['Receipts', '/receipts'],
  ['Customers', '/customers'],
  ['Bookings', '/bookings', 'LODGING'],
];

/** @type {[string, string][]} */
const mobileOrder = [
  ['/dashboard', 'Home'],
  ['/sales/new', 'New sale'],
  ['/sales', 'Sales'],
  ['/products', 'Products'],
  ['/inventory', 'Stock'],
  ['/expenses', 'Expenses'],
  ['/receipts', 'Receipts'],
  ['/customers', 'Customers'],
  ['/bookings', 'Bookings'],
];

export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return fallbackPath;

  let decoded = value;
  let fullyDecoded = false;
  try {
    for (let i = 0; i < 32; i += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        fullyDecoded = true;
        break;
      }
      decoded = next;
    }
  } catch {
    return fallbackPath;
  }

  if (
    !fullyDecoded ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    /^\/(?:https?:|javascript:)/i.test(decoded)
  )
    return fallbackPath;

  try {
    if (new URL(value, origin).origin !== origin) return fallbackPath;
  } catch {
    return fallbackPath;
  }
  return value;
}

export function getNavigationLinks(role, enabledModules = []) {
  const enabled = new Set(enabledModules);
  const links = role === 'OWNER' ? ownerLinks : staffLinks;
  return links.filter(
    (item) =>
      (!item[2] || enabled.has(item[2])) &&
      (item[1] !== '/inventory' ||
        ['FOOD', 'BEVERAGE', 'GYM'].some((module) => enabled.has(module))),
  );
}

export function getMobileNavigationLinks(role, enabledModules = []) {
  const allowed = new Set(getNavigationLinks(role, enabledModules).map(([, href]) => href));
  return mobileOrder.filter(([href]) => allowed.has(href));
}
