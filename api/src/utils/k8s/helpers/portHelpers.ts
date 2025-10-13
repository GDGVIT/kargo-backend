import { formatK8sName, getBaseDomain } from './k8sHelpers';

interface Port {
  subdomain?: string | null;
  containerPort: number;
  protocol: string;
}

export function mapPorts(ports: Port[], username: string) {
  const baseDomain = getBaseDomain();
  return ports.map((port: any, idx: number) => {
    let subdomain =
      typeof port.subdomain === 'string'
        ? port.subdomain.trim()
        : port.subdomain !== undefined && port.subdomain !== null
          ? String(port.subdomain).trim()
          : '';
    if (subdomain) {
      const fqdn = `${formatK8sName(subdomain)}.${formatK8sName(username)}.${baseDomain}`;
      if (!subdomain.endsWith(baseDomain) && !subdomain.endsWith(`.${baseDomain}`)) {
        subdomain = fqdn;
      }
    }
    return {
      name: `port${idx}`,
      containerPort: port.containerPort,
      protocol: port.protocol,
      subdomain,
    };
  });
}
