import IApplication from "../../../types/application.types";
import getEnvObject from "../helpers/getEnvObject";

export default function generateSecret(
	sanitizedApp: IApplication,
	namespace: string
): string {
	const envObj = getEnvObject(sanitizedApp.env);
	const filtered = Object.entries(envObj).filter(
		([k, v]) => k && typeof v === "string" && v.length > 0
	);
	let data = filtered
		.map(
			([key, value]) =>
				`  ${key}: ${Buffer.from(value, "utf8").toString("base64")}`
		)
		.join("\n");
	if (!data) data = "  # No environment variables provided\n";
	return [
		`apiVersion: v1`,
		`kind: Secret`,
		`metadata:`,
		`  name: ${sanitizedApp.name}-env-secret`,
		`  namespace: ${namespace}`,
		`type: Opaque`,
		`data:`,
		data,
	].join("\n");
}
