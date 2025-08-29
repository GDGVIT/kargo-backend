export default function toK8sResource(
  val: string | number | undefined,
  type: "cpu" | "memory"
): string {
  if (val === undefined || val === null || val === "")
    return type === "cpu" ? "0m" : "0Mi";
  if (typeof val === "number") {
    if (type === "cpu") {
      // If value is less than 1, treat as millicores (e.g., 20 -> 20m)
      if (val < 1) return `${Math.round(val * 1000)}m`;
      return `${val}m`;
    }
    if (type === "memory") return `${val}Mi`;
  }
  if (typeof val === "string") {
    // If already ends with m, Mi, Gi, etc., return as is
    if (type === "cpu" && /m$/.test(val)) return val;
    if (type === "memory" && /(Mi|Gi)$/.test(val)) return val;
    // If it's a plain number string, add suffix
    if (/^\d+$/.test(val)) {
      return type === "cpu" ? `${val}m` : `${val}Mi`;
    }
    // If it's a float string for cpu, convert to millicores
    if (type === "cpu" && /^\d*\.\d+$/.test(val)) {
      return `${Math.round(parseFloat(val) * 1000)}m`;
    }
    return val;
  }
  return type === "cpu" ? "0m" : "0Mi";
}
