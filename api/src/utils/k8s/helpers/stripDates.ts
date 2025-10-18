export default function stripDates(obj: any): any {
  const seen = new WeakSet();

  function internalStrip(o: any): any {
    if (o && typeof o === 'object') {
      if (seen.has(o)) return o;
      seen.add(o);
    }

    if (Array.isArray(o)) return o.map(internalStrip);
    if (o && typeof o === 'object') {
      const clean: Record<string, any> = {};
      for (const key in o) {
        const val = o[key];
        clean[key] = val instanceof Date ? val.toISOString() : internalStrip(val);
      }
      return clean;
    }
    return o;
  }

  return internalStrip(obj);
}
