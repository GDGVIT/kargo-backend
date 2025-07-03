import env from "../../../config/env";
import path from "path";

export default function generatePVYaml(
  volume: any,
  namespace: string,
  userId: string,
  appId: string
): string {
  if (!volume.name || !volume.size) return "";
  // Use env var for root path
  const rootPath = env.VOLUME_ROOT_PATH || "/mnt/kargo-volumes";
  // Use path.posix for k8s hostPath (even on Windows dev)
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
