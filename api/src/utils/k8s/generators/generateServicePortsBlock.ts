export function generateServicePortsBlock(ports: any[]): string {
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
