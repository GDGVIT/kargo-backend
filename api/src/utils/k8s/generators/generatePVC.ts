export default function generatePVC(volume: any, namespace: string): string {
  if (!volume.name || !volume.size) return '';
  return [
    `apiVersion: v1`,
    `kind: PersistentVolumeClaim`,
    `metadata:`,
    `  name: ${volume.name}-pvc`,
    `  namespace: ${namespace}`,
    `spec:`,
    `  accessModes: ["ReadWriteOnce"]`,
    `  storageClassName: manual`,
    `  resources:`,
    `    requests:`,
    `      storage: ${volume.size}`,
    `  volumeName: ${volume.name}-pv`,
  ].join('\n');
}
