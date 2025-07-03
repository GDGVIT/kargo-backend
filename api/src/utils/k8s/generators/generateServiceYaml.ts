import { generateServicePortsBlock } from "./generateServicePortsBlock";

export default function generateServiceYaml(
  sanitizedApp: any,
  namespace: string
): string {
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
