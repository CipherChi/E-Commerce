export function trustProxySetting(value?: string): boolean | number {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'false' || normalized === 'off') return false;
  if (/^\d+$/.test(normalized)) {
    const hops = Number(normalized);
    return Number.isSafeInteger(hops) && hops > 0 ? hops : false;
  }
  // Never enable Express's blanket `trust proxy = true` mode from configuration.
  return false;
}
