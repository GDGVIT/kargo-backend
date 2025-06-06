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

export function generateK8sManifests(app: IApplication): {
  deploymentYaml: string;
  serviceYaml: string;
  ingressYaml: string;
} {
  const safeApp = app.toObject ? app.toObject() : app;
  const sanitizedApp = stripDates(safeApp);
  const namespace = sanitizedApp.namespace || "default";

  // --- Validation for duplicate ports and ingress hosts ---
  if (sanitizedApp.ports?.length) {
    const portSet = new Set<number>();
    const hostSet = new Set<string>();
    for (const p of sanitizedApp.ports) {
      if (typeof p.containerPort !== "number") continue;
      if (portSet.has(p.containerPort)) {
        throw new Error(`Duplicate containerPort found: ${p.containerPort}`);
      }
      portSet.add(p.containerPort);
      if (p.ingressEnabled && p.ingressHost) {
        if (hostSet.has(p.ingressHost)) {
          throw new Error(`Duplicate ingressHost found: ${p.ingressHost}`);
        }
        hostSet.add(p.ingressHost);
      }
    }
  }
  // --- End validation ---

  const envBlock =
    sanitizedApp.env && Object.keys(sanitizedApp.env).length > 0
      ? `          env:\n${Object.entries(sanitizedApp.env)
          .map(
            ([key, value]) =>
              `            - name: ${key}\n              value: "${value}"`
          )
          .join("\n")}`
      : "";

  const resourcesBlock = sanitizedApp.resources
    ? `          resources:
            requests:
              cpu: "${sanitizedApp.resources.requests?.cpu || "100m"}"
              memory: "${sanitizedApp.resources.requests?.memory || "128Mi"}"
            limits:
              cpu: "${sanitizedApp.resources.limits?.cpu || "250m"}"
              memory: "${sanitizedApp.resources.limits?.memory || "256Mi"}"`
    : "";

  const volumeMountsBlock = sanitizedApp.volumes?.length
    ? `          volumeMounts:\n${sanitizedApp.volumes
        .map(
          (v: { name: string; mountPath: string }) =>
            `            - name: ${v.name}\n              mountPath: ${v.mountPath}`
        )
        .join("\n")}`
    : "";

  const volumesBlock = sanitizedApp.volumes?.length
    ? `      volumes:\n${sanitizedApp.volumes
        .map(
          (v: { name: string; pvcName: string }) =>
            `        - name: ${v.name}\n          persistentVolumeClaim:\n            claimName: ${v.pvcName}`
        )
        .join("\n")}`
    : "";

  const portsBlock = sanitizedApp.ports?.length
    ? `          ports:\n${sanitizedApp.ports
        .map(
          (p: { name: string; containerPort: number; protocol?: string }) =>
            `            - name: ${p.name}\n              containerPort: ${
              p.containerPort
            }\n              protocol: ${p.protocol || "TCP"}`
        )
        .join("\n")}`
    : "";

  const commandBlock = sanitizedApp.command?.length
    ? `          command: ${JSON.stringify(sanitizedApp.command)}`
    : "";

  const argsBlock = sanitizedApp.args?.length
    ? `          args: ${JSON.stringify(sanitizedApp.args)}`
    : "";

  const readinessProbeBlock = sanitizedApp.readinessProbe
    ? `          readinessProbe:\n${dump(
        stripDates(sanitizedApp.readinessProbe),
        {
          noRefs: true,
          skipInvalid: true,
        }
      )
        .split("\n")
        .map((line) => `            ${line}`)
        .join("\n")}`
    : "";

  const livenessProbeBlock = sanitizedApp.livenessProbe
    ? `          livenessProbe:\n${dump(
        stripDates(sanitizedApp.livenessProbe),
        {
          noRefs: true,
          skipInvalid: true,
        }
      )
        .split("\n")
        .map((line) => `            ${line}`)
        .join("\n")}`
    : "";

  const affinityBlock = sanitizedApp.affinity
    ? `          affinity:\n${dump(stripDates(sanitizedApp.affinity), {
        noRefs: true,
        skipInvalid: true,
      })
        .split("\n")
        .map((line) => `            ${line}`)
        .join("\n")}`
    : "";

  const tolerationsBlock = sanitizedApp.tolerations?.length
    ? `      tolerations:\n${dump(stripDates(sanitizedApp.tolerations), {
        noRefs: true,
        skipInvalid: true,
      })
        .split("\n")
        .map((line) => `        ${line}`)
        .join("\n")}`
    : "";

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
${envBlock ? envBlock + "\n" : ""}${portsBlock ? portsBlock + "\n" : ""}${
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

  let servicePorts = "";
  if (sanitizedApp.ports?.length) {
    servicePorts = sanitizedApp.ports
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
          `    - name: ${p.name || `port${idx}`}\n      protocol: ${
            p.protocol || "TCP"
          }\n      port: ${
            p.servicePort || p.containerPort
          }\n      targetPort: ${p.containerPort}`
      )
      .join("\n");
  } else {
    servicePorts = `    - protocol: TCP\n      port: 80\n      targetPort: 3000`;
  }

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

  // Single Ingress resource with multiple rules/hosts
  const ingressPorts = (sanitizedApp.ports || []).filter(
    (p: any) => p.ingressEnabled && p.ingressHost
  );
  let ingressYaml = "";
  if (ingressPorts.length > 0) {
    const rules = ingressPorts
      .map(
        (p: any) => `    - host: ${p.ingressHost}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${sanitizedApp.serviceName}
                port:
                  number: ${p.containerPort}`
      )
      .join("\n");
    ingressYaml = `---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${sanitizedApp.name}-ingress
  namespace: ${namespace}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
spec:
  rules:
${rules}
`;
  }

  return {
    deploymentYaml: deployment,
    serviceYaml: service,
    ingressYaml,
  };
}
