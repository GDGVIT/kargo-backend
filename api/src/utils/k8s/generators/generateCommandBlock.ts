export function generateCommandBlock(command: string[] | undefined): string {
  if (!command?.length) return "";
  return `          command: ${JSON.stringify(command)}`;
}
