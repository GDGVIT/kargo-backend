import env from "../../../config/env";
import path from "path";

import { hashVolumeName } from "../../hashUtil";

export default function generatePV(
  volume: any,
  namespace: string,
  userId: string,
  appId: string,
  deploymentName: string
): string {
  if (!volume.name || !volume.size) return "";
  let rootPath = env.VOLUME_ROOT_PATH;
  if (!rootPath.startsWith("/")) {
    throw new Error(
      `VOLUME_ROOT_PATH must be a Linux-style absolute path (starts with /), got: ${rootPath}`
    );
  }
  const hash = hashVolumeName(`${volume.name}-${deploymentName}-${appId}`);
  const pvName = `${volume.name}-${hash}-pv`;
  const hostPath = path.posix.join(rootPath, userId, appId, pvName);
  return [
    `apiVersion: v1`,
    `kind: PersistentVolume`,
    `metadata:`,
    `  name: ${pvName}`,
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
