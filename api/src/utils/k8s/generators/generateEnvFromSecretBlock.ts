import IApplication from "../../../types/application.types";
import getEnvObject from "../helpers/getEnvObject";

export function generateEnvFromSecretBlock(sanitizedApp: IApplication): string {
  const envObj = getEnvObject(sanitizedApp.env);
  if (!envObj || Object.keys(envObj).length === 0) return "";
  return `          envFrom:\n            - secretRef:\n                name: ${sanitizedApp.name}-env-secret`;
}
