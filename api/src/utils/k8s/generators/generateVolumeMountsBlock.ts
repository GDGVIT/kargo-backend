export function generateVolumeMountsBlock(volumes: any[]): string {
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
