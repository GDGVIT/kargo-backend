import env from "../../../config/env";
import path from "path";

export default function generatePV(
	volume: any,
	namespace: string,
	userId: string,
	appId: string
): string {
	if (!volume.name || !volume.size) return "";
	// Use env var for root path, must be Linux-style absolute path
	let rootPath = env.VOLUME_ROOT_PATH;
	// Ensure rootPath is Linux-style absolute
	if (!rootPath.startsWith("/")) {
		throw new Error(
			`VOLUME_ROOT_PATH must be a Linux-style absolute path (starts with /), got: ${rootPath}`
		);
	}
	// Always use posix.join for k8s hostPath
	const hostPath = path.posix.join(rootPath, userId, appId, volume.name);
	return [
		`apiVersion: v1`,
		`kind: PersistentVolume`,
		`metadata:`,
		`  name: ${volume.name}-pv`,
		`  labels:`,
		`    app: ${namespace}`,
		`spec:`,
		`  capacity:`,
		`    storage: ${volume.size}`,
		`  accessModes: ["ReadWriteOnce"]`,
		`  persistentVolumeReclaimPolicy: Retain`,
		`  storageClassName: manual`,
		`  hostPath:`,
		`    path: ${hostPath}`,
	].join("\n");
}
