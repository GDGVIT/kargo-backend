export function generateVolumesBlock(volumes: any[]): string {
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
