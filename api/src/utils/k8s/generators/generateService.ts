export default function generateService(sanitizedApp: any, namespace: string): string {
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
    .join('\n');
}

function generateServicePortsBlock(ports: any[]): string {
  if (!ports?.length) return `    - protocol: TCP\n      port: 80\n      targetPort: 3000`;
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
          p.protocol || 'TCP'
        }\n      port: ${p.servicePort || p.containerPort}\n      targetPort: ${p.containerPort}`
    )
    .join('\n');
}
