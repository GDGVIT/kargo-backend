import { exec } from 'child_process';

/**
 * Checks if a PVC exists in the given namespace.
 * @param namespace Kubernetes namespace
 * @param pvcName Name of the PVC
 * @returns Promise<boolean>
 */
export function pvcExists(namespace: string, pvcName: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`kubectl get pvc ${pvcName} -n ${namespace}`, (err) => {
      if (err) return resolve(false);
      return resolve(true);
    });
  });
}

/**
 * Creates a PVC from a manifest file if it does not already exist.
 * @param namespace Kubernetes namespace
 * @param pvcName Name of the PVC
 * @param manifestPath Path to the PVC manifest YAML file
 * @returns Promise<boolean> true if created, false if already existed
 */
export async function createPvcIfNotExists(
  namespace: string,
  pvcName: string,
  manifestPath: string
): Promise<boolean> {
  const exists = await pvcExists(namespace, pvcName);
  if (exists) return false;
  return new Promise((resolve, reject) => {
    exec(`kubectl apply -f ${manifestPath} -n ${namespace}`, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(true);
    });
  });
}
