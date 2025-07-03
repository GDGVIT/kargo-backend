import { dump } from "js-yaml";
import type IApplication from "../../types/application.types";
import env from "../../config/env";
import path from "path";

function stripDates(obj: any): any {
  const seen = new WeakSet();

  function internalStrip(o: any): any {
    if (o && typeof o === "object") {
      if (seen.has(o)) return o;
      seen.add(o);
    }

    if (Array.isArray(o)) return o.map(internalStrip);
    if (o && typeof o === "object") {
      const clean: Record<string, any> = {};
      for (const key in o) {
        const val = o[key];
        clean[key] =
          val instanceof Date ? val.toISOString() : internalStrip(val);
      }
      return clean;
    }
    return o;
  }

  return internalStrip(obj);
}

// Add deployment label to all relevant resources
function generateIngressYamlWithDeployment(
  sanitizedApp: any,
  namespace: string
): string {
  const ingressPorts = (sanitizedApp.ports || []).filter(
    (p: any) => typeof p.subdomain === "string" && p.subdomain.trim() !== ""
  );
  if (ingressPorts.length === 0) return "";
  const rules = ingressPorts
    .map((p: any) => {
      const host = p.subdomain.endsWith(".")
        ? p.subdomain.slice(0, -1)
        : p.subdomain;
      return [
        `    - host: ${host}`,
        `      http:`,
        `        paths:`,
        `          - path: /`,
        `            pathType: Prefix`,
        `            backend:`,
        `              service:`,
        `                name: ${
          sanitizedApp.serviceName || sanitizedApp.name
        }-service`,
        `                port:`,
        `                  number: ${p.servicePort || p.containerPort || 80}`,
      ].join("\n");
    })
    .join("\n");
  // Collect all hosts for TLS
  const hosts = ingressPorts.map((p: any) =>
    p.subdomain.endsWith(".") ? p.subdomain.slice(0, -1) : p.subdomain
  );
  return [
    `---`,
    `apiVersion: networking.k8s.io/v1`,
    `kind: Ingress`,
    `metadata:`,
    `  name: ${sanitizedApp.name}-ingress`,
    `  namespace: ${namespace}`,
    `  labels:`,
    `    app: ${sanitizedApp.name}`,
    `    deployment: ${sanitizedApp.deploymentName}`,
    `  annotations:`,
    `    kubernetes.io/ingress.class: traefik`,
    `    cert-manager.io/cluster-issuer: letsencrypt-wildcard`,
    `spec:`,
    `  rules:`,
    rules,
    `  tls:`,
    `    - hosts:`,
    ...hosts.map((h: string) => `        - ${h}`),
    `      secretName: wildcard-tls`,
  ].join("\n");
}

function getEnvObject(env: any): Record<string, string> {
  if (!env) return {};
  if (env instanceof Map) {
    return Object.fromEntries(env.entries());
  }
  if (typeof env.toObject === "function") {
    return env.toObject();
  }

  if (typeof env === "object" && env !== null) {
    return JSON.parse(JSON.stringify(env));
  }
  return {};
}

function generateSecretYaml(
  sanitizedApp: IApplication,
  namespace: string
): string {
  const envObj = getEnvObject(sanitizedApp.env);
  const filtered = Object.entries(envObj).filter(
    ([k, v]) => k && typeof v === "string" && v.length > 0
  );
  let data = filtered
    .map(
      ([key, value]) =>
        `  ${key}: ${Buffer.from(value, "utf8").toString("base64")}`
    )
    .join("\n");
  if (!data) data = "  # No environment variables provided\n";
  return [
    `apiVersion: v1`,
    `kind: Secret`,
    `metadata:`,
    `  name: ${sanitizedApp.name}-env-secret`,
    `  namespace: ${namespace}`,
    `type: Opaque`,
    `data:`,
    data,
  ].join("\n");
}

function generateEnvFromSecretBlock(sanitizedApp: IApplication): string {
  const envObj = getEnvObject(sanitizedApp.env);
  if (!envObj || Object.keys(envObj).length === 0) return "";
  return `          envFrom:\n            - secretRef:\n                name: ${sanitizedApp.name}-env-secret`;
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

function generatePVYaml(
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

function generatePVCYaml(volume: any, namespace: string): string {
  if (!volume.name || !volume.size) return "";
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
  ].join("\n");
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

function generateCommandBlock(command: string[] | undefined): string {
  if (!command?.length) return "";
  return `          command: ${JSON.stringify(command)}`;
}

function generateArgsBlock(args: string[] | undefined): string {
  if (!args?.length) return "";
  return `          args: ${JSON.stringify(args)}`;
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

function generateAffinityBlock(affinity: any): string {
  if (!affinity) return "";
  return `          affinity:\n${dump(stripDates(affinity), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line) => `            ${line}`)
    .join("\n")}`;
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

function generateServicePortsBlock(ports: any[]): string {
  if (!ports?.length)
    return `    - protocol: TCP\n      port: 80\n      targetPort: 3000`;
  return ports
    .map(
      (
        p: {
          name?: string;
          containerPort: number;
          protocol?: string;
          servicePort?: number;
        },
        idx: number
      ) =>
        `    - name: port${idx}\n      protocol: ${
          p.protocol || "TCP"
        }\n      port: ${p.servicePort || p.containerPort}\n      targetPort: ${
          p.containerPort
        }`
    )
    .join("\n");
}

function generateImagePullSecretYaml(
  app: IApplication,
  namespace: string
): string | undefined {
  if (
    !app.credentials ||
    !Array.isArray(app.credentials) ||
    app.credentials.length === 0
  )
    return undefined;
  // Only use the first credential for now (can be extended for multiple)
  const cred = app.credentials[0];
  const auth = Buffer.from(`${cred.username}:${cred.token}`).toString("base64");
  // Determine registry server
  let server = "";
  switch (cred.registryType) {
    case "dockerhub":
      server = "https://index.docker.io/v1/";
      break;
    case "github":
      server = "ghcr.io";
      break;
    case "gitlab":
      server = "registry.gitlab.com";
      break;
    case "other":
    default:
      server = cred.name || "";
      break;
  }
  const dockerConfig = {
    auths: {
      [server]: {
        auth,
        username: cred.username,
        password: cred.token,
      },
    },
  };
  return (
    `apiVersion: v1\n` +
    `kind: Secret\n` +
    `metadata:\n` +
    `  name: ${app.name}-regcred\n` +
    `  namespace: ${namespace}\n` +
    `type: kubernetes.io/dockerconfigjson\n` +
    `data:\n` +
    `  .dockerconfigjson: ${Buffer.from(JSON.stringify(dockerConfig)).toString(
      "base64"
    )}\n`
  );
}

// Utility to ensure resource values are in correct string format for k8s
function toK8sResource(
  val: string | number | undefined,
  type: "cpu" | "memory"
): string {
  if (val === undefined || val === null || val === "")
    return type === "cpu" ? "0m" : "0Mi";
  if (typeof val === "number") {
    if (type === "cpu") {
      // If value is less than 1, treat as millicores (e.g., 20 -> 20m)
      if (val < 1) return `${Math.round(val * 1000)}m`;
      return `${val}m`;
    }
    if (type === "memory") return `${val}Mi`;
  }
  if (typeof val === "string") {
    // If already ends with m, Mi, Gi, etc., return as is
    if (type === "cpu" && /m$/.test(val)) return val;
    if (type === "memory" && /(Mi|Gi)$/.test(val)) return val;
    // If it's a plain number string, add suffix
    if (/^\d+$/.test(val)) {
      return type === "cpu" ? `${val}m` : `${val}Mi`;
    }
    // If it's a float string for cpu, convert to millicores
    if (type === "cpu" && /^\d*\.\d+$/.test(val)) {
      return `${Math.round(parseFloat(val) * 1000)}m`;
    }
    return val;
  }
  return type === "cpu" ? "0m" : "0Mi";
}

export default function generateK8sManifests(
  app: IApplication
): Record<string, string> {
  // Sanitize app object
  const sanitizedApp = stripDates(app);
  const namespace = app.namespace || "default";
  // Generate all manifests
  const deploymentYaml = generateDeploymentYaml(sanitizedApp, namespace);
  const serviceYaml = generateServiceYaml(sanitizedApp, namespace);
  const ingressYaml = generateIngressYamlWithDeployment(
    sanitizedApp,
    namespace
  );
  const secretYaml = generateSecretYaml(sanitizedApp, namespace);
  const imagePullSecretYaml =
    typeof generateImagePullSecretYaml === "function"
      ? generateImagePullSecretYaml(sanitizedApp, namespace)
      : "";
  const userId = (app.owner as any)?.toString?.() || app.owner;
  const appId = (app._id as any)?.toString?.() || app._id;
  // Generate PV and PVC manifests for persistent volumes
  const pvManifests = (app.volumes || [])
    .map((v) => generatePVYaml(v, namespace, userId, appId))
    .filter((yaml) => yaml);
  const pvcManifests = (app.volumes || [])
    .map((v) => generatePVCYaml(v, namespace))
    .filter((yaml) => yaml);
  // Compose output
  const manifests: Record<string, string> = {
    deployment: deploymentYaml || "",
    service: serviceYaml || "",
    ingress: ingressYaml || "",
    secret: secretYaml || "",
    imagepullsecret: imagePullSecretYaml || "",
  };
  if (pvManifests.length) {
    manifests["pvs"] = pvManifests.join("\n---\n");
  }
  if (pvcManifests.length) {
    manifests["pvcs"] = pvcManifests.join("\n---\n");
  }
  return manifests;
}

function generateDeploymentYaml(sanitizedApp: any, namespace: string): string {
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

function generateServiceYaml(sanitizedApp: any, namespace: string): string {
  return [
    `apiVersion: v1`,
    `kind: Service`,
    `metadata:`,
    `  name: ${sanitizedApp.serviceName || sanitizedApp.name}-service`,
    `  namespace: ${namespace}`,
    `  labels:`,
    `    app: ${sanitizedApp.name}`,
    `    deployment: ${sanitizedApp.deploymentName || sanitizedApp.name}`,
    `spec:`,
    `  selector:`,
    `    app: ${sanitizedApp.name}`,
    `  ports:`,
    generateServicePortsBlock(sanitizedApp.ports),
  ]
    .filter(Boolean)
    .join("\n");
}
