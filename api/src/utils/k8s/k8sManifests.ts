import { dump } from "js-yaml";
import type IApplication from "../../types/application.types";

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

function generateIngressYaml(sanitizedApp: any, namespace: string): string {
  const ingressPorts = (sanitizedApp.ports || []).filter(
    (p: any) => typeof p.subdomain === "string" && p.subdomain.trim() !== ""
  );
  if (ingressPorts.length === 0) return "";
  const rules = ingressPorts
    .map((p: any) => {
      let host = p.subdomain;
      if (host.endsWith(".")) host = host.slice(0, -1);
      return [
        `    - host: ${host}`,
        `      http:`,
        `        paths:`,
        `          - path: /`,
        `            pathType: Prefix`,
        `            backend:`,
        `              service:`,
        `                name: ${sanitizedApp.serviceName}`,
        `                port:`,
        `                  number: ${p.containerPort}`,
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
    `    nginx.ingress.kubernetes.io/rewrite-target: /$`,
    `    nginx.ingress.kubernetes.io/ssl-redirect: "true"`,
    `spec:`,
    `  rules:`,
    rules,
    `  tls:`,
    `    - hosts:`,
    ...hosts.map((h: string) => `        - ${h}`),
    `      secretName: wildcard-tls`,
  ].join("\n");
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
      let host = p.subdomain;
      if (host.endsWith(".")) host = host.slice(0, -1);
      return [
        `    - host: ${host}`,
        `      http:`,
        `        paths:`,
        `          - path: /`,
        `            pathType: Prefix`,
        `            backend:`,
        `              service:`,
        `                name: ${sanitizedApp.serviceName}`,
        `                port:`,
        `                  number: ${p.containerPort}`,
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
    `    nginx.ingress.kubernetes.io/rewrite-target: /$`,
    `    nginx.ingress.kubernetes.io/ssl-redirect: "true"`,
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
              cpu: "${toK8sResource(resources.requests?.cpu, "cpu")}"
              memory: "${toK8sResource(resources.requests?.memory, "memory")}"
            limits:
              cpu: "${toK8sResource(resources.limits?.cpu, "cpu")}"
              memory: "${toK8sResource(resources.limits?.memory, "memory")}"`;
}

function generateVolumeMountsBlock(volumes: any[]): string {
  if (!volumes?.length) return "";
  return (
    `          volumeMounts:\n` +
    volumes
      .map(
        (v: { name: string; mountPath: string }) =>
          `            - name: ${v.name}\n              mountPath: ${v.mountPath}`
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
        (v: { name: string; pvcName: string }) =>
          `        - name: ${v.name}\n          persistentVolumeClaim:\n            claimName: ${v.pvcName}`
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

export default function generateK8sManifests(app: IApplication): {
  deploymentYaml: string;
  serviceYaml: string;
  ingressYaml: string;
  secretYaml?: string;
  imagePullSecretYaml?: string;
} {
  const sanitizedApp = stripDates(app);
  const namespace = sanitizedApp.namespace || "default";

  const envSection = generateEnvFromSecretBlock(sanitizedApp);
  const portsBlock = generatePortsBlock(sanitizedApp.ports);
  const commandBlock = generateCommandBlock(sanitizedApp.command);
  const argsBlock = generateArgsBlock(sanitizedApp.args);
  const resourcesBlock = generateResourcesBlock(sanitizedApp.resources);
  const volumeMountsBlock = generateVolumeMountsBlock(
    sanitizedApp.volumeMounts
  );
  const volumesBlock = generateVolumesBlock(sanitizedApp.volumes);
  const readinessProbeBlock = generateProbeBlock(
    "readinessProbe",
    sanitizedApp.readinessProbe
  );
  const livenessProbeBlock = generateProbeBlock(
    "livenessProbe",
    sanitizedApp.livenessProbe
  );
  const affinityBlock = generateAffinityBlock(sanitizedApp.affinity);
  const tolerationsBlock = generateTolerationsBlock(sanitizedApp.tolerations);
  const servicePortsBlock = generateServicePortsBlock(sanitizedApp.ports);
  const secretYaml = generateSecretYaml(sanitizedApp, namespace);
  const imagePullSecretYaml = generateImagePullSecretYaml(app, namespace);
  const ingressYaml = generateIngressYamlWithDeployment(
    sanitizedApp,
    namespace
  );

  const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${sanitizedApp.deploymentName}
  namespace: ${namespace}
  labels:
    app: ${sanitizedApp.name}
    deployment: ${sanitizedApp.deploymentName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${sanitizedApp.name}
      deployment: ${sanitizedApp.deploymentName}
  template:
    metadata:
      labels:
        app: ${sanitizedApp.name}
        deployment: ${sanitizedApp.deploymentName}
    spec:
      containers:
        - name: ${sanitizedApp.name}
          image: ${sanitizedApp.imageUrl}:${sanitizedApp.imageTag}
${envSection ? envSection + "\n" : ""}${portsBlock ? portsBlock + "\n" : ""}${
    commandBlock ? commandBlock + "\n" : ""
  }${argsBlock ? argsBlock + "\n" : ""}${
    resourcesBlock ? resourcesBlock + "\n" : ""
  }${volumeMountsBlock ? volumeMountsBlock + "\n" : ""}${
    readinessProbeBlock ? readinessProbeBlock + "\n" : ""
  }${livenessProbeBlock ? livenessProbeBlock + "\n" : ""}${
    affinityBlock ? affinityBlock + "\n" : ""
  }${volumesBlock ? volumesBlock + "\n" : ""}${
    tolerationsBlock ? tolerationsBlock : ""
  }${
    app.credentials && app.credentials.length > 0
      ? `\n      imagePullSecrets:\n        - name: ${sanitizedApp.name}-regcred`
      : ""
  }`;

  const service = `apiVersion: v1
kind: Service
metadata:
  name: ${sanitizedApp.serviceName}
  namespace: ${namespace}
  labels:
    app: ${sanitizedApp.name}
    deployment: ${sanitizedApp.deploymentName}
spec:
  type: ClusterIP
  selector:
    app: ${sanitizedApp.name}
    deployment: ${sanitizedApp.deploymentName}
  ports:
${servicePortsBlock}
`;

  return {
    deploymentYaml: deployment,
    serviceYaml: service,
    ingressYaml: ingressYaml,
    secretYaml: secretYaml || undefined,
    imagePullSecretYaml: imagePullSecretYaml || undefined,
  };
}
