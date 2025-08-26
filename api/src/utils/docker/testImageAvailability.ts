import axios, { AxiosError } from "axios";
import type { IRegistryCredential } from "../../types/user.types";
import log from "../logging/logger";
import {
  getClusterArchitectures,
  validateArchitectureCompatibility,
  getImageArchitectures,
} from "./architectureValidation";

interface ImageTestResult {
  available: boolean;
  error?: string;
  needsAuth?: boolean;
  authTested?: boolean;
  testedWith?: string;
  suggestions?: string[];
  isArchitectureIssue?: boolean;
  architectureSupported?: boolean;
  supportedArchitectures?: string[];
  clusterArchitectures?: string[];
  unsupportedNodes?: string[];
  recommendedNodeSelector?: { [key: string]: string };
}

export type { ImageTestResult };

interface RegistryInfo {
  type: string;
  registryUrl: string;
  hostService: string;
  tokenRealm: string;
}

/**
 * Validate image architecture against cluster
 */
async function validateImageArchitecture(
  manifestData: any
): Promise<Partial<ImageTestResult>> {
  const imageArchs = getImageArchitectures(manifestData);

  log({
    type: "info",
    message: `Found image architectures: ${
      imageArchs.join(", ") || "none detected"
    }`,
  });

  const clusterResult = await getClusterArchitectures();

  if (clusterResult.error) {
    log({
      type: "warning",
      message: `Architecture validation skipped: ${clusterResult.error}`,
    });
    return {
      available: false,
      error:
        "Cannot validate image architecture compatibility - cluster access required for deployment.",
      isArchitectureIssue: true,
      suggestions: [
        "Architecture validation skipped: kubectl not available in this environment.",
      ],
    };
  }

  if (imageArchs.length === 0) {
    log({
      type: "warning",
      message: "Could not determine image architecture from manifest",
    });
    return {
      available: false,
      error:
        "Cannot determine image architecture - deployment blocked for safety.",
      isArchitectureIssue: true,
      suggestions: ["Could not determine image architecture from manifest."],
    };
  }

  log({
    type: "info",
    message: `Found cluster architectures: ${clusterResult.nodeArchitectures.join(
      ", "
    )}`,
  });

  const validation = validateArchitectureCompatibility(
    imageArchs,
    clusterResult.nodeArchitectures,
    clusterResult.nodeDetails
  );

  const suggestions = [...validation.suggestions];

  if (!validation.isSupported) {
    suggestions.push(
      "Image architecture is not compatible with any cluster nodes."
    );
    return {
      available: false,
      error: "Image cannot run on any cluster nodes - deployment blocked.",
      isArchitectureIssue: true,
      suggestions,
    };
  }

  log({
    type: "success",
    message: `Architecture validation: compatible - ${suggestions.length} suggestions`,
  });

  return {
    architectureSupported: validation.isSupported,
    supportedArchitectures: imageArchs,
    clusterArchitectures: clusterResult.nodeArchitectures,
    unsupportedNodes: validation.unsupportedNodes,
    recommendedNodeSelector: validation.recommendedNodeSelector,
    suggestions,
  };
}

/**
 * Test if a Docker image is available for pulling
 * @param imageUrl The Docker image URL (e.g., nginx, ghcr.io/owner/repo)
 * @param imageTag The image tag (e.g., latest, v1.0.0)
 * @param credentials Array of registry credentials to try if public pull fails
 * @returns Promise with test result
 */
export default async function testImageAvailability(
  imageUrl: string,
  imageTag: string = "latest",
  credentials?: IRegistryCredential[]
): Promise<ImageTestResult> {
  const fullImageName = `${imageUrl}:${imageTag}`;

  log({
    type: "info",
    message: `Testing availability of Docker image: ${fullImageName}`,
  });

  const registry = parseRegistryFromImage(imageUrl);
  const name = normalizeImageName(imageUrl, registry);

  // First try without authentication (public image)
  const publicResult = await testImagePull(name, imageTag, registry);
  if (publicResult.available) {
    log({
      type: "success",
      message: `Image ${fullImageName} is publicly available`,
    });

    const architectureResult = await validateImageArchitecture(
      publicResult.manifestData
    );

    return {
      available: true,
      ...architectureResult,
    };
  }

  // If public pull failed and we have credentials, try with authentication
  if (credentials && credentials.length > 0) {
    log({
      type: "info",
      message: `Public pull failed, testing with ${credentials.length} credential(s)`,
    });

    const suggestions: string[] = [];
    let testedCredentials = 0;

    for (const credential of credentials) {
      // Check if this credential is relevant for the image registry
      if (isCredentialRelevant(imageUrl, credential)) {
        testedCredentials++;
        const authResult = await testImagePullWithAuth(
          name,
          imageTag,
          registry,
          credential
        );

        if (authResult.available) {
          log({
            type: "success",
            message: `Image ${fullImageName} is available with authentication`,
          });

          const architectureResult = await validateImageArchitecture(
            authResult.manifestData
          );

          return {
            available: true,
            authTested: true,
            testedWith: `${credential.name} (${credential.registryType})`,
            ...architectureResult,
          };
        } else {
          suggestions.push(
            `Failed with ${credential.name} (${credential.registryType}): ${authResult.error}`
          );
        }
      }
    }

    if (testedCredentials === 0) {
      suggestions.push(
        "No credentials found that match this registry. Consider adding credentials for the appropriate registry type."
      );
    }

    return {
      available: false,
      needsAuth: true,
      authTested: true,
      error: `Image not accessible with ${testedCredentials} tested credential(s)`,
      suggestions,
    };
  }

  // No credentials provided or available, return suggestions
  const suggestions: string[] = [];

  // Determine registry type and suggest appropriate credentials
  if (fullImageName.includes("ghcr.io")) {
    suggestions.push(
      "This appears to be a GitHub Container Registry image. Consider adding GitHub registry credentials."
    );
  } else if (fullImageName.includes("registry.gitlab.com")) {
    suggestions.push(
      "This appears to be a GitLab Container Registry image. Consider adding GitLab registry credentials."
    );
  } else if (
    !fullImageName.includes("/") ||
    fullImageName.includes("docker.io")
  ) {
    suggestions.push(
      "This appears to be a Docker Hub image. Consider adding Docker Hub registry credentials if it's private."
    );
  } else {
    suggestions.push(
      "This appears to be a private registry image. Consider adding appropriate registry credentials."
    );
  }

  return {
    available: false,
    needsAuth: true,
    error:
      publicResult.error ||
      "Image not publicly accessible and no credentials provided",
    suggestions,
  };
}

/**
 * Test image pull with authentication
 */
async function testImagePullWithAuth(
  repo: string,
  tag: string,
  registry: RegistryInfo,
  credential: IRegistryCredential
): Promise<ImageTestResult & { manifestData?: any }> {
  try {
    const url = `${registry.registryUrl}/v2/${repo}/manifests/${tag}`;

    const headers: Record<string, string> = {
      Accept:
        "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json",
    };

    const token = await getAuthToken(repo, registry, credential);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await axios.get(url, {
      headers,
      timeout: 10000,
    });
    if (res.status === 200) {
      return { available: true, manifestData: res.data };
    }
    return { available: false, error: `Unexpected HTTP ${res.status}` };
  } catch (err) {
    const e = err as AxiosError;
    const errorData = e.response?.data as any;
    const errorMsg =
      errorData?.errors?.[0]?.message || e.response?.statusText || e.message;
    return { available: false, error: errorMsg };
  }
}

async function testImagePull(
  repo: string,
  tag: string,
  registry: RegistryInfo
): Promise<ImageTestResult & { manifestData?: any }> {
  try {
    const url = `${registry.registryUrl}/v2/${repo}/manifests/${tag}`;

    const headers: Record<string, string> = {
      Accept:
        "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json",
    };

    // Get an auth token most registries require this
    const token = await getAuthToken(repo, registry);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await axios.get(url, {
      headers,
      timeout: 10000,
    });
    if (res.status === 200) {
      return { available: true, manifestData: res.data };
    }
    return { available: false, error: `Unexpected HTTP ${res.status}` };
  } catch (err) {
    const e = err as AxiosError;
    const errorData = e.response?.data as any;
    const errorMsg =
      errorData?.errors?.[0]?.message || e.response?.statusText || e.message;
    return { available: false, error: errorMsg };
  }
}

async function getAuthToken(
  repo: string,
  registry: RegistryInfo,
  credential?: IRegistryCredential
): Promise<string | undefined> {
  try {
    const service = registry.hostService;
    const realm = registry.tokenRealm;
    const scope = `repository:${repo}:pull`;
    const params = { service, scope };
    const url = `${realm}?${new URLSearchParams(params).toString()}`;

    const opts: any = { timeout: 10000 };
    if (credential) {
      opts.auth = { username: credential.username, password: credential.token };
    }

    const res = await axios.get(url, opts);
    const token = res.data?.token;

    if (!token) {
      return undefined;
    }

    return token;
  } catch (err) {
    const e = err as AxiosError;
    const errorData = e.response?.data as any;
    const errorMsg = errorData?.details || e.response?.statusText || e.message;
    return undefined;
  }
}

function parseRegistryFromImage(imageUrl: string): RegistryInfo {
  const lower = imageUrl.toLowerCase();
  if (lower.includes("ghcr.io")) {
    return {
      type: "ghcr",
      registryUrl: "https://ghcr.io",
      hostService: "ghcr.io",
      tokenRealm: "https://ghcr.io/token",
    };
  }
  if (lower.includes("registry.gitlab.com")) {
    return {
      type: "gitlab",
      registryUrl: "https://registry.gitlab.com",
      hostService: "container_registry",
      tokenRealm: "https://gitlab.com/jwt/auth",
    };
  }
  if (
    lower.includes("docker.io") ||
    lower.includes("index.docker.io") ||
    !lower.includes(".")
  ) {
    return {
      type: "dockerhub",
      registryUrl: "https://registry-1.docker.io",
      hostService: "registry.docker.io",
      tokenRealm: "https://auth.docker.io/token",
    };
  }

  const hostMatch = imageUrl.match(/^([^\/]+)/);
  const host = hostMatch ? hostMatch[1] : imageUrl;
  return {
    type: "other",
    registryUrl: `https://${host}`,
    hostService: host,
    tokenRealm: `https://${host}/v2/token`,
  };
}

function normalizeImageName(imageUrl: string, registry: RegistryInfo): string {
  if (registry.type === "dockerhub") {
    if (!imageUrl.includes("/")) return `library/${imageUrl}`;
    return imageUrl.replace(/^(docker\.io\/|index\.docker\.io\/)/, "");
  }
  const registryHostname = new URL(registry.registryUrl).hostname;
  return imageUrl.replace(new RegExp(`^${registryHostname}/`), "");
}

/**
 * Check if a credential is relevant for the given image URL
 */
function isCredentialRelevant(
  imageUrl: string,
  credential: IRegistryCredential
): boolean {
  const lowerImageUrl = imageUrl.toLowerCase();

  switch (credential.registryType) {
    case "dockerhub":
      // Docker Hub images don't have a hostname or use docker.io
      return (
        !lowerImageUrl.includes("/") ||
        lowerImageUrl.includes("docker.io") ||
        lowerImageUrl.includes("index.docker.io")
      );

    case "github":
      return lowerImageUrl.includes("ghcr.io");

    case "gitlab":
      return lowerImageUrl.includes("registry.gitlab.com");

    case "other":
      // For custom registries, check if the credential name matches part of the URL
      return credential.name
        ? lowerImageUrl.includes(credential.name.toLowerCase())
        : false;

    default:
      return false;
  }
}
