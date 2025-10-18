export default function getEnvObject(env: any): Record<string, string> {
  if (!env) return {};
  if (env instanceof Map) {
    return Object.fromEntries(env.entries());
  }
  if (typeof env.toObject === 'function') {
    return env.toObject();
  }

  if (typeof env === 'object' && env !== null) {
    return JSON.parse(JSON.stringify(env));
  }
  return {};
}
