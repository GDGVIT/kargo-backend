import { dump } from "js-yaml";
import stripDates from "../helpers/stripDates";
import IApplication from "../../../types/application.types";
import getEnvObject from "../helpers/getEnvObject";
import toK8sResource from "../helpers/toK8sResource";

export default function generateDeployment(
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
    `  annotations:`,
    `    keel.sh/policy: "force"`,
    `    keel.sh/trigger: "poll"`,
    `    keel.sh/container: "${sanitizedApp.name}"`,
    `    keel.sh/match-tag: "true"`,
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
    generateImagePullSecretsBlock(sanitizedApp),
    generateNodeSelectorBlock(sanitizedApp),
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

function generateAffinityBlock(affinity: any): string {
  if (!affinity) return "";
  return `          affinity:\n${dump(stripDates(affinity), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line: string) => `            ${line}`)
    .join("\n")}`;
}

function generateArgsBlock(args: string[] | undefined): string {
  if (!args?.length) return "";
  return `          args: ${JSON.stringify(args)}`;
}

function generateCommandBlock(command: string[] | undefined): string {
  if (!command?.length) return "";
  return `          command: ${JSON.stringify(command)}`;
}

function generateEnvFromSecretBlock(sanitizedApp: IApplication): string {
  const envObj = getEnvObject(sanitizedApp.env);
  if (!envObj || Object.keys(envObj).length === 0) return "";
  return `          envFrom:\n            - secretRef:\n                name: ${sanitizedApp.name}-env-secret`;
}

function generateImagePullSecretsBlock(sanitizedApp: IApplication): string {
  if (
    !sanitizedApp.credentials ||
    !Array.isArray(sanitizedApp.credentials) ||
    sanitizedApp.credentials.length === 0
  ) {
    return "";
  }
  return `      imagePullSecrets:\n        - name: ${sanitizedApp.name}-regcred`;
}

function generateNodeSelectorBlock(sanitizedApp: any): string {
  if (
    !sanitizedApp.nodeSelector ||
    Object.keys(sanitizedApp.nodeSelector).length === 0
  ) {
    return "";
  }
  
  const yamlLines = Object.entries(sanitizedApp.nodeSelector).map(
    ([key, value]) => `        ${key}: "${value}"`
  );
  return `      nodeSelector:\n${yamlLines.join('\n')}`;
}

function generatePortsBlock(ports: any[]): string {
  if (!ports?.length) return "";
  return (
    `          ports:\n` +
    ports
      .map(
        (
          p: { name?: string; containerPort: number; protocol?: string },
          idx: number
        ) =>
          `            - name: port${idx}` +
          `\n              containerPort: ${p.containerPort}` +
          `\n              protocol: ${p.protocol || "TCP"}`
      )
      .join("\n")
  );
}

function generateProbeBlock(
  type: "readinessProbe" | "livenessProbe",
  probe: any
): string {
  if (!probe) return "";
  return `          ${type}:\n${dump(stripDates(probe), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line) => `            ${line}`)
    .join("\n")}`;
}

function generateResourcesBlock(resources: any): string {
  if (!resources) return "";
  return `          resources:
            requests:
              cpu: "${toK8sResource(resources.requests?.cpuMilli, "cpu")}"
              memory: "${toK8sResource(resources.requests?.memoryMB, "memory")}"
            limits:
              cpu: "${toK8sResource(resources.limits?.cpuMilli, "cpu")}"
              memory: "${toK8sResource(resources.limits?.memoryMB, "memory")}"`;
}

function generateTolerationsBlock(tolerations: any[]): string {
  if (!tolerations?.length) return "";
  return `      tolerations:\n${dump(stripDates(tolerations), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line) => `        ${line}`)
    .join("\n")}`;
}

function generateVolumeMountsBlock(volumes: any[]): string {
  if (!volumes?.length) return "";
  return (
    `          volumeMounts:\n` +
    volumes
      .map(
        (v: { name: string; mountPath: string }) =>
          `            - name: ${v.name}-pvc\n              mountPath: ${v.mountPath}`
      )
      .join("\n")
  );
}

function generateVolumesBlock(volumes: any[]): string {
  if (!volumes?.length) return "";
  return (
    `      volumes:\n` +
    volumes
      .map(
        (v: any) =>
          `        - name: ${v.name}-pvc\n          persistentVolumeClaim:\n            claimName: ${v.name}-pvc`
      )
      .join("\n")
  );
}
