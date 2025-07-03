import { dump } from "js-yaml";
import stripDates from "../helpers/stripDates";

export function generateTolerationsBlock(tolerations: any[]): string {
  if (!tolerations?.length) return "";
  return `      tolerations:\n${dump(stripDates(tolerations), {
    noRefs: true,
    skipInvalid: true,
  })
    .split("\n")
    .map((line) => `        ${line}`)
    .join("\n")}`;
}
