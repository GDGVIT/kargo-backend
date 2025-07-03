import type IApplication from "../../../../types/application.types";

export default function generateImagePullSecret(
  app: IApplication,
  namespace: string
): string | undefined {
  if (
    !app.credentials ||
    !Array.isArray(app.credentials) ||
    app.credentials.length === 0
  )
    return undefined;
  // Only use the first credential for now (can be extended for multiple)
  const cred = app.credentials[0];
  const auth = Buffer.from(`${cred.username}:${cred.token}`).toString("base64");
  // Determine registry server
  let server = "";
  switch (cred.registryType) {
    case "dockerhub":
      server = "https://index.docker.io/v1/";
      break;
    case "github":
      server = "ghcr.io";
      break;
    case "gitlab":
      server = "registry.gitlab.com";
      break;
    case "other":
    default:
      server = cred.name || "";
      break;
  }
  const dockerConfig = {
    auths: {
      [server]: {
        auth,
        username: cred.username,
        password: cred.token,
      },
    },
  };
  return (
    `apiVersion: v1\n` +
    `kind: Secret\n` +
    `metadata:\n` +
    `  name: ${app.name}-regcred\n` +
    `  namespace: ${namespace}\n` +
    `type: kubernetes.io/dockerconfigjson\n` +
    `data:\n` +
    `  .dockerconfigjson: ${Buffer.from(JSON.stringify(dockerConfig)).toString(
      "base64"
    )}\n`
  );
}
