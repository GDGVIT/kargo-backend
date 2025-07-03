import { dump } from "js-yaml";
import stripDates from "../helpers/stripDates";

export function generateAffinityBlock(affinity: any): string {
  if (!affinity) return "";
  return `          affinity:\n${dump(stripDates(affinity), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line: string) => `            ${line}`)
    .join("\n")}`;
}
