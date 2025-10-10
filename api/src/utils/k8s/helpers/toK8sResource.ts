export default function toK8sResource(
	val: string | number | undefined,
	type: "cpu" | "memory"
): string {
	if (val === undefined || val === null || val === "")
		return type === "cpu" ? "0m" : "0Mi";
	if (typeof val === "number") {
		if (type === "cpu") {
			// CPU is in cores (e.g., 0.25 = 250m, 1 = 1000m)
			if (val < 1) return `${Math.round(val * 1000)}m`;
			return `${Math.round(val * 1000)}m`;
		}
		if (type === "memory") {
			// Memory is in bytes, convert to MiB for K8s
			return `${Math.round(val / (1024 * 1024))}Mi`;
		}
	}
	if (typeof val === "string") {
		// If already ends with m, Mi, Gi, etc., return as is
		if (type === "cpu" && /m$/.test(val)) return val;
		if (type === "memory" && /(Mi|Gi)$/.test(val)) return val;
		// If it's a plain number string, parse and convert
		const numVal = parseFloat(val);
		if (!isNaN(numVal)) {
			if (type === "cpu") {
				return `${Math.round(numVal * 1000)}m`;
			}
			return `${Math.round(numVal / (1024 * 1024))}Mi`;
		}
		return val;
	}
	return type === "cpu" ? "0m" : "0Mi";
}
