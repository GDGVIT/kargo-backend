import k8sClient from '../k8s/client';

export interface NodeArchitectureInfo {
  name: string;
  arch: string;
}

export interface ClusterArchitectureResult {
  nodeArchitectures: string[];
  nodeDetails: NodeArchitectureInfo[];
  error?: string;
}

export interface ArchitectureValidationResult {
  isSupported: boolean;
  supportedNodes: string[];
  unsupportedNodes: string[];
  suggestions: string[];
  recommendedNodeSelector?: { [key: string]: string };
}

/**
 * Get architectures of all nodes in the cluster (SECURE - uses Kubernetes SDK)
 */
export async function getClusterArchitectures(): Promise<ClusterArchitectureResult> {
  try {
    // Use secure Kubernetes client instead of kubectl command
    const { nodeArchitectures, nodeDetails } = await k8sClient.getNodeArchitectures();
    
    return { nodeArchitectures, nodeDetails };
  } catch (error) {
    console.error('Error getting cluster architectures:', error);
    return { 
      nodeArchitectures: [], 
      nodeDetails: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Extract supported architectures from Docker image manifest
 */
export function getImageArchitectures(manifestData: any): string[] {
  try {
    // Handle different manifest types
    if (manifestData.manifests && Array.isArray(manifestData.manifests)) {
      return manifestData.manifests
        .map((m: any) => m.platform?.architecture)
        .filter(Boolean);
    } else if (manifestData.architecture) {
      return [manifestData.architecture];
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Validate architecture compatibility between image and cluster
 */
export function validateArchitectureCompatibility(
  imageArchs: string[],
  clusterArchs: string[],
  nodeDetails: NodeArchitectureInfo[]
): ArchitectureValidationResult {
  const supportedNodes = nodeDetails
    .filter(node => imageArchs.includes(node.arch))
    .map(node => node.name);
  
  const unsupportedNodes = nodeDetails
    .filter(node => !imageArchs.includes(node.arch))
    .map(node => node.name);
  
  const suggestions: string[] = [];
  let recommendedNodeSelector: { [key: string]: string } | undefined;
  
  if (supportedNodes.length === 0) {
    suggestions.push(
      `Image supports [${imageArchs.join(', ')}] but cluster has [${clusterArchs.join(', ')}].`
    );
    suggestions.push("Consider using a multi-architecture image.");
  }

  else if (unsupportedNodes.length > 0) {

    const supportedArchsInCluster = nodeDetails
      .filter(node => imageArchs.includes(node.arch))
      .map(node => node.arch);
    
    const uniqueSupportedArchs = [...new Set(supportedArchsInCluster)];
    
    // If only one architecture is supported in the cluster, use nodeSelector
    if (uniqueSupportedArchs.length === 1) {
      recommendedNodeSelector = { 'kubernetes.io/arch': uniqueSupportedArchs[0] };
    }
    // If multiple architectures are supported, let Kubernetes scheduler decide
    // but still could add nodeSelector for the primary supported arch if needed
  }
  
  return {
    isSupported: supportedNodes.length > 0,
    supportedNodes,
    unsupportedNodes,
    suggestions,
    recommendedNodeSelector
  };
}
