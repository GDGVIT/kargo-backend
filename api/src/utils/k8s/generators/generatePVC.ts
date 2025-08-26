
import { hashVolumeName } from "../../hashUtil";

export default function generatePVC(volume: any, namespace: string, deploymentName: string, appId: string): string {
  if (!volume.name || !volume.size) return "";
  const hash = hashVolumeName(`${volume.name}-${deploymentName}-${appId}`);
  const pvName = `${volume.name}-${hash}-pv`;
  const pvcName = `${volume.name}-${hash}-pvc`;
  return [
    `apiVersion: v1`,
    `kind: PersistentVolumeClaim`,
    `metadata:`,
    `  name: ${pvcName}`,
    `  namespace: ${namespace}`,
    `spec:`,
    `  accessModes: ["ReadWriteOnce"]`,
    `  storageClassName: manual`,
    `  resources:`,
    `    requests:`,
    `      storage: ${volume.size}`,
    `  volumeName: ${pvName}`,
  ].join("\n");
}
