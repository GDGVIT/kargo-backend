export function generateArgsBlock(args: string[] | undefined): string {
  if (!args?.length) return "";
  return `          args: ${JSON.stringify(args)}`;
}
