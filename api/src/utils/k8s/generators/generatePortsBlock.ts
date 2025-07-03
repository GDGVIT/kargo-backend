export function generatePortsBlock(ports: any[]): string {
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
