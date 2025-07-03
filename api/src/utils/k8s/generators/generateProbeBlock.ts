import { dump } from "js-yaml";
import stripDates from "../helpers/stripDates";

export function generateProbeBlock(
  type: "readinessProbe" | "livenessProbe",
  probe: any
): string {
  if (!probe) return "";
  return `          ${type}:\n${dump(stripDates(probe), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line) => `            ${line}`)
    .join("\n")}`;
}
