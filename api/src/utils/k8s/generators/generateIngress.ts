import env from '../../../config/env';

export default function generateIngress(sanitizedApp: any, namespace: string): string {
  const ingressPorts = (sanitizedApp.ports || []).filter(
    (p: any) => typeof p.subdomain === 'string' && p.subdomain.trim() !== ''
  );
  if (ingressPorts.length === 0) return '';
  const rules = ingressPorts
    .map((p: any) => {
      const host = p.subdomain.endsWith('.') ? p.subdomain.slice(0, -1) : p.subdomain;
      return [
        `    - host: ${host}`,
        `      http:`,
        `        paths:`,
        `          - path: /`,
        `            pathType: Prefix`,
        `            backend:`,
        `              service:`,
        `                name: ${sanitizedApp.serviceName || sanitizedApp.name}-service`,
        `                port:`,
        `                  number: ${p.servicePort || p.containerPort || 80}`,
      ].join('\n');
    })
    .join('\n');
  // Collect all hosts for TLS
  const hosts = ingressPorts.map((p: any) =>
    p.subdomain.endsWith('.') ? p.subdomain.slice(0, -1) : p.subdomain
  );

  // For development, skip cert-manager and TLS
  const isDev = env.NODE_ENV === 'development';
  const annotations = [
    `    kubernetes.io/ingress.class: traefik`,
    !isDev ? `    cert-manager.io/cluster-issuer: letsencrypt-wildcard` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const lines = [
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
    annotations,
    `spec:`,
    `  rules:`,
    rules,
  ];

  if (!isDev) {
    lines.push(`  tls:`);
    lines.push(`    - hosts:`);
    hosts.forEach((h: string) => lines.push(`        - ${h}`));
    lines.push(`      secretName: wildcard-tls`);
  }

  return lines.join('\n');
}
