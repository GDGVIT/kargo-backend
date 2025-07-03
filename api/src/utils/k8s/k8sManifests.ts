import type IApplication from "../../types/application.types";
import generateDEployment from "./generators/yamls/generateDeployment";
import generateService from "./generators/yamls/generateServiceYaml";
import generateSecret from "./generators/yamls/generateSecret";
import generateImagePullSecret from "./generators/yamls/generateImagePullSecret";
import generatePVC from "./generators/yamls/generatePVC";
import generatePV from "./generators/yamls/generatePV";
import stripDates from "./helpers/stripDates";
import generateIngress from "./generators/yamls/generateIngress";

export default function generateK8sManifests(
  app: IApplication
): Record<string, string> {
  // Sanitize app object
  const sanitizedApp = stripDates(app);
  const namespace = app.namespace || "default";
  // Generate all manifests
  const deploymentYaml = generateDEployment(sanitizedApp, namespace);
  const serviceYaml = generateService(sanitizedApp, namespace);
  const ingressYaml = generateIngress(sanitizedApp, namespace);
  const secretYaml = generateSecret(sanitizedApp, namespace);
  const imagePullSecretYaml =
    typeof generateImagePullSecret === "function"
      ? generateImagePullSecret(sanitizedApp, namespace)
      : "";
  const userId = (app.owner as any)?.toString?.() || app.owner;
  const appId = (app._id as any)?.toString?.() || app._id;
  // Generate PV and PVC manifests for persistent volumes
  const pvManifests = (app.volumes || [])
    .map((v) => generatePV(v, namespace, userId, appId))
    .filter((yaml) => yaml);
  const pvcManifests = (app.volumes || [])
    .map((v) => generatePVC(v, namespace))
    .filter((yaml) => yaml);
  // Compose output
  const manifests: Record<string, string> = {
    deployment: deploymentYaml || "",
    service: serviceYaml || "",
    ingress: ingressYaml || "",
    secret: secretYaml || "",
    imagepullsecret: imagePullSecretYaml || "",
  };
  if (pvManifests.length) {
    manifests["pvs"] = pvManifests.join("\n---\n");
  }
  if (pvcManifests.length) {
    manifests["pvcs"] = pvcManifests.join("\n---\n");
  }
  return manifests;
}
