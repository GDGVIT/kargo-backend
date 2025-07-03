import { generateEnvFromSecretBlock } from "../generateEnvFromSecretBlock";
import { generateResourcesBlock } from "../generateResourcesBlock";
import { generatePortsBlock } from "../generatePortsBlock";
import { generateVolumeMountsBlock } from "../generateVolumeMountsBlock";
import { generateVolumesBlock } from "../generateVolumesBlock";
import { generateCommandBlock } from "../generateCommandBlock";
import { generateArgsBlock } from "../generateArgsBlock";
import { generateProbeBlock } from "../generateProbeBlock";
import { generateAffinityBlock } from "../generateAffinityBlock";
import { generateTolerationsBlock } from "../generateTolerationsBlock";

export default function generateDeploymentYaml(
  sanitizedApp: any,
  namespace: string
): string {
  return [
    `apiVersion: apps/v1`,
    `kind: Deployment`,
    `metadata:`,
    `  name: ${sanitizedApp.deploymentName || sanitizedApp.name}-deployment`,
    `  namespace: ${namespace}`,
    `  labels:`,
    `    app: ${sanitizedApp.name}`,
    `    deployment: ${sanitizedApp.deploymentName || sanitizedApp.name}`,
    `spec:`,
    `  replicas: 1`,
    `  selector:`,
    `    matchLabels:`,
    `      app: ${sanitizedApp.name}`,
    `  template:`,
    `    metadata:`,
    `      labels:`,
    `        app: ${sanitizedApp.name}`,
    `        deployment: ${sanitizedApp.deploymentName || sanitizedApp.name}`,
    `    spec:`,
    `      containers:`,
    `        - name: ${sanitizedApp.name}`,
    `          image: ${sanitizedApp.imageUrl}:${sanitizedApp.imageTag}`,
    generateEnvFromSecretBlock(sanitizedApp),
    generateResourcesBlock(sanitizedApp.resources),
    generatePortsBlock(sanitizedApp.ports),
    generateVolumeMountsBlock(sanitizedApp.volumes),
    generateCommandBlock(sanitizedApp.command),
    generateArgsBlock(sanitizedApp.args),
    generateProbeBlock("livenessProbe", sanitizedApp.livenessProbe),
    generateProbeBlock("readinessProbe", sanitizedApp.readinessProbe),
    generateAffinityBlock(sanitizedApp.affinity),
    `      restartPolicy: Always`,
    generateVolumesBlock(sanitizedApp.volumes),
    generateTolerationsBlock(sanitizedApp.tolerations),
  ]
    .filter(Boolean)
    .join("\n");
}
