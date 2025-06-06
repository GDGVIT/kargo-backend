import { dump } from "js-yaml";
import { IApplication } from "../models/application.model";

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
  return [
    `---`,
    `apiVersion: networking.k8s.io/v1`,
    `kind: Ingress`,
    `metadata:`,
    `  name: ${sanitizedApp.name}-ingress`,
    `  namespace: ${namespace}`,
    `  annotations:`,
    `    nginx.ingress.kubernetes.io/rewrite-target: /$`,
    `    nginx.ingress.kubernetes.io/ssl-redirect: "false"`,
    `spec:`,
    `  rules:`,
    rules,
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
              cpu: "${resources.requests?.cpu || "100m"}"
              memory: "${resources.requests?.memory || "128Mi"}"
            limits:
              cpu: "${resources.limits?.cpu || "250m"}"
              memory: "${resources.limits?.memory || "256Mi"}"`;
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

export function generateK8sManifests(app: IApplication): {
  deploymentYaml: string;
  serviceYaml: string;
  ingressYaml: string;
  secretYaml?: string;
} {
  const safeApp = app.toObject ? app.toObject() : app;
  const sanitizedApp = stripDates(safeApp);
  const namespace = sanitizedApp.namespace || "default";

  if (sanitizedApp.ports?.length) {
    const portSet = new Set<number>();
    for (const p of sanitizedApp.ports) {
      if (typeof p.containerPort !== "number") continue;
      if (portSet.has(p.containerPort)) {
        throw new Error(`Duplicate containerPort found: ${p.containerPort}`);
      }
      portSet.add(p.containerPort);
    }
  }

  // Use env as secret (from original app, not sanitized)
  const secretYaml = generateSecretYaml(
    { ...sanitizedApp, env: app.env },
    namespace
  );
  const envFromSecretBlock = generateEnvFromSecretBlock({
    ...sanitizedApp,
    env: app.env,
  });
  const resourcesBlock = generateResourcesBlock(sanitizedApp.resources);
  const volumeMountsBlock = generateVolumeMountsBlock(sanitizedApp.volumes);
  const volumesBlock = generateVolumesBlock(sanitizedApp.volumes);
  const portsBlock = generatePortsBlock(sanitizedApp.ports);
  const commandBlock = generateCommandBlock(sanitizedApp.command);
  const argsBlock = generateArgsBlock(sanitizedApp.args);
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

  let envSection = "";
  if (envFromSecretBlock) {
    envSection = envFromSecretBlock + "\n";
  } else if (
    sanitizedApp.env &&
    Object.keys(getEnvObject(sanitizedApp.env)).length > 0
  ) {
    envSection = "          # WARNING: env present but secret not generated!\n";
  }

  const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${sanitizedApp.deploymentName}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${sanitizedApp.name}
  template:
    metadata:
      labels:
        app: ${sanitizedApp.name}
    spec:
      containers:
        - name: ${sanitizedApp.name}
          image: ${sanitizedApp.imageUrl}:${sanitizedApp.imageTag}
${envSection}${portsBlock ? portsBlock + "\n" : ""}${
    commandBlock ? commandBlock + "\n" : ""
  }${argsBlock ? argsBlock + "\n" : ""}${
    resourcesBlock ? resourcesBlock + "\n" : ""
  }${volumeMountsBlock ? volumeMountsBlock + "\n" : ""}${
    readinessProbeBlock ? readinessProbeBlock + "\n" : ""
  }${livenessProbeBlock ? livenessProbeBlock + "\n" : ""}${
    affinityBlock ? affinityBlock + "\n" : ""
  }
${volumesBlock ? volumesBlock + "\n" : ""}${
    tolerationsBlock ? tolerationsBlock : ""
  }`;

  const servicePorts = generateServicePortsBlock(sanitizedApp.ports);

  const service = `---
apiVersion: v1
kind: Service
metadata:
  name: ${sanitizedApp.serviceName}
  namespace: ${namespace}
spec:
  selector:
    app: ${sanitizedApp.name}
  ports:
${servicePorts}`;

  const ingressYaml = generateIngressYaml(sanitizedApp, namespace);

  return {
    deploymentYaml: deployment,
    serviceYaml: service,
    ingressYaml,
    secretYaml: secretYaml || undefined,
  };
}

export function generateRoleBindingYaml(namespace: string): string {
  return `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: kargo-backend-rb
  namespace: ${namespace}
subjects:
  - kind: ServiceAccount
    name: kargo-backend-sa
    namespace: default
roleRef:
  kind: ClusterRole
  name: kargo-backend-namespace-manager
  apiGroup: rbac.authorization.k8s.io
`;
}
