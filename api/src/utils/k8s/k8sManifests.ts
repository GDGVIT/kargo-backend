import type IApplication from "../../types/application.types";
import generateDeploymentYaml from "./generators/yamls/generateDeploymentYaml";
import generateServiceYaml from "./generators/yamls/generateServiceYaml";
import generateSecretYaml from "./generators/yamls/generateSecretYaml";
import generateImagePullSecretYaml from "./generators/yamls/generateImagePullSecretYaml";
import generatePVCYaml from "./generators/yamls/generatePVCYaml";
import generatePVYaml from "./generators/yamls/generatePVYaml";
import stripDates from "./helpers/stripDates";
import generateIngressYamlWithDeployment from "./generators/yamls/generateIngressYamlWithDeployment";

export default function generateK8sManifests(
  app: IApplication
): Record<string, string> {
  // Sanitize app object
  const sanitizedApp = stripDates(app);
  const namespace = app.namespace || "default";
  // Generate all manifests
  const deploymentYaml = generateDeploymentYaml(sanitizedApp, namespace);
  const serviceYaml = generateServiceYaml(sanitizedApp, namespace);
  const ingressYaml = generateIngressYamlWithDeployment(
    sanitizedApp,
    namespace
  );
  const secretYaml = generateSecretYaml(sanitizedApp, namespace);
  const imagePullSecretYaml =
    typeof generateImagePullSecretYaml === "function"
      ? generateImagePullSecretYaml(sanitizedApp, namespace)
      : "";
  const userId = (app.owner as any)?.toString?.() || app.owner;
  const appId = (app._id as any)?.toString?.() || app._id;
  // Generate PV and PVC manifests for persistent volumes
  const pvManifests = (app.volumes || [])
    .map((v) => generatePVYaml(v, namespace, userId, appId))
    .filter((yaml) => yaml);
  const pvcManifests = (app.volumes || [])
    .map((v) => generatePVCYaml(v, namespace))
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
