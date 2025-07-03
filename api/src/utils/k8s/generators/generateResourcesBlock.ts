import toK8sResource from "../helpers/toK8sResource";

export function generateResourcesBlock(resources: any): string {
  if (!resources) return "";
  return `          resources:
            requests:
              cpu: "${toK8sResource(resources.requests?.cpuMilli, "cpu")}"
              memory: "${toK8sResource(resources.requests?.memoryMB, "memory")}"
            limits:
              cpu: "${toK8sResource(resources.limits?.cpuMilli, "cpu")}"
              memory: "${toK8sResource(resources.limits?.memoryMB, "memory")}"`;
}
