import type IApplication from "../../types/application.types";
import generateDEployment from "./generators/generateDeployment";
import generateService from "./generators/generateService";
import generateSecret from "./generators/generateSecret";
import generateImagePullSecret from "./generators/generateImagePullSecret";
import generatePVC from "./generators/generatePVC";
import generatePV from "./generators/generatePV";
import stripDates from "./helpers/stripDates";
import generateIngress from "./generators/generateIngress";

export default function generateK8sManifests(
	app: IApplication
): Record<string, string> {
	// Sanitize app object
	const sanitizedApp = stripDates(app);
	const namespace = app.namespace || "default";
	const userId = (app.owner as any)?.toString?.() || app.owner;
	const appId = (app._id as any)?.toString?.() || app._id;

	// Auto-generate a single volume if storage is set in resources
	let autoVolume = null;
	let storageGB = 0;
	if (app.resources?.requests?.storage && app.resources.requests.storage > 0) {
		// Convert bytes to GB
		storageGB = Math.ceil(
			app.resources.requests.storage / (1024 * 1024 * 1024)
		);
	} else if (
		app.resources?.limits?.storage &&
		app.resources.limits.storage > 0
	) {
		// Convert bytes to GB
		storageGB = Math.ceil(app.resources.limits.storage / (1024 * 1024 * 1024));
	}
	if (storageGB > 0) {
		autoVolume = {
			name: `${app.name}-data`,
			mountPath: "/data",
			size: `${storageGB}Gi`,
			accessModes: ["ReadWriteOnce"],
			storageClassName: "manual",
			readOnly: false,
			type: "pvc",
		};
	}
	// Only use the auto-generated volume if present
	const volumes = autoVolume ? [autoVolume] : [];

	// Generate all manifests
	const deploymentYaml = generateDEployment(
		{ ...sanitizedApp, volumes },
		namespace
	);
	const serviceYaml = generateService(sanitizedApp, namespace);
	const ingressYaml = generateIngress(sanitizedApp, namespace);
	const secretYaml = generateSecret(sanitizedApp, namespace);
	const imagePullSecretYaml =
		typeof generateImagePullSecret === "function"
			? generateImagePullSecret(sanitizedApp, namespace)
			: undefined;

	// Generate PV and PVC manifests for persistent volumes
	const pvManifests = volumes
		.map((v) => generatePV(v, namespace, userId, appId))
		.filter((yaml) => yaml);
	const pvcManifests = volumes
		.map((v) => generatePVC(v, namespace))
		.filter((yaml) => yaml);

	// Compose output
	const manifests: Record<string, string> = {
		deployment: (deploymentYaml || "") + "\n",
		service: (serviceYaml || "") + "\n",
		ingress: (ingressYaml || "") + "\n",
		secret: (secretYaml || "") + "\n",
	};

	// Only add imagepullsecret if it exists
	if (imagePullSecretYaml) {
		manifests["imagepullsecret"] = imagePullSecretYaml + "\n";
	}

	if (pvManifests.length) {
		manifests["pvs"] = pvManifests.join("\n---\n") + "\n";
	}
	if (pvcManifests.length) {
		manifests["pvcs"] = pvcManifests.join("\n---\n") + "\n";
	}
	return manifests;
}
