import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('tenant isolation schema coverage guard', () => {
  it('requires every Prisma model with businessId to be named in the real-Postgres isolation spec', () => {
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    const isolationSpec = readFileSync(resolve(__dirname, '../test/tenant-isolation.e2e-spec.ts'), 'utf8');
    const inventory = isolationSpec.match(/const schemaTenantCoverageInventory = \[([\s\S]*?)\] as const/);
    expect(inventory).not.toBeNull();
    const inventoryModels = [...(inventory?.[1] ?? '').matchAll(/['"](\w+)['"]/g)].map((match) => match[1]);
    const tenantModels = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)]
      .filter(([, , fields]) => /^\s*businessId\s+\S+/m.test(fields))
      .map((match) => match[1]);
    const missing = tenantModels.filter((model) => !inventoryModels.includes(model));

    expect(missing).toEqual([]);
  });
});
