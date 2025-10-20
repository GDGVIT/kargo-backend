export default function toK8sResource(
  val: string | number | undefined,
  type: 'cpu' | 'memory'
): string {
  if (val === undefined || val === null || val === '') return type === 'cpu' ? '0m' : '0Mi';

  // Frontend/base units:
  // - CPU is provided in millicores (m)
  // - Memory is provided in megabytes (MB ~ MiB)
  if (typeof val === 'number') {
    if (type === 'cpu') {
      // CPU already in millicores
      return `${Math.round(val)}m`;
    }
    if (type === 'memory') {
      // Memory already in MB -> use Mi in K8s
      return `${Math.round(val)}Mi`;
    }
  }

  if (typeof val === 'string') {
    // If already ends with appropriate unit, return as-is
    if (type === 'cpu' && /m$/.test(val)) return val;
    if (type === 'memory' && /(Mi|Gi)$/.test(val)) return val;

    // If it's a plain number string, interpret using base units above
    const numVal = Number(val);
    if (!isNaN(numVal)) {
      if (type === 'cpu') return `${Math.round(numVal)}m`;
      return `${Math.round(numVal)}Mi`;
    }
    return val;
  }

  return type === 'cpu' ? '0m' : '0Mi';
}
