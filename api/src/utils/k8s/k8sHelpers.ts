import env from "../../config/env";

export function formatK8sName(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

export function getNamespace(userId: string, appName: string) {
  return `ns-${formatK8sName(userId)}-${formatK8sName(appName)}`;
}

export function getResourceName(type: string, appName: string) {
  return `${type}-${formatK8sName(appName)}`;
}

export const getBaseDomain = () => {
  let domain = env.INGRESS_BASE_DOMAIN || ".vitians.in";
  if (domain.startsWith(".")) domain = domain.slice(1);
  return domain;
};

export function buildIngressHost({
  username,
  subdomain,
}: {
  username: string;
  subdomain?: string;
}) {
  const baseDomain = getBaseDomain();
  if (typeof subdomain === "string" && subdomain.trim() !== "") {
    return `${formatK8sName(subdomain)}.${baseDomain}`;
  }
  return `${formatK8sName(username)}.${baseDomain}`;
}

export function buildSubdomainHost({
  subdomain,
  username,
}: {
  subdomain: string;
  username: string;
}) {
  return `${formatK8sName(subdomain)}-${formatK8sName(
    username
  )}.${getBaseDomain()}`;
}
