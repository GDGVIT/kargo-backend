import * as k8s from "@kubernetes/client-node";
import log from "../logging/logger";

/**
 * Secure Kubernetes Client Utility
 * Replaces direct kubectl commands to prevent command injection
 */
export class KubernetesClient {
  private coreV1Api?: k8s.CoreV1Api;
  private appsV1Api?: k8s.AppsV1Api;
  private customObjectsApi?: k8s.CustomObjectsApi;
  private kubeConfig?: k8s.KubeConfig;
  private initialized = false;
  private available = false;
  private initPromise?: Promise<void>;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Prevent multiple concurrent initialization attempts
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      this.kubeConfig = new k8s.KubeConfig();
      // Load config from default locations (in-cluster, ~/.kube/config, etc.)
      this.kubeConfig.loadFromDefault();

      this.coreV1Api = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
      this.appsV1Api = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
      this.customObjectsApi = this.kubeConfig.makeApiClient(
        k8s.CustomObjectsApi
      );

      this.initialized = true;
      this.available = true;

      log({
        type: "success",
        message: "Kubernetes client initialized successfully",
      });
    } catch (error) {
      this.initialized = true;
      this.available = false;

      log({
        type: "warning",
        message:
          "Kubernetes configuration not available - cluster operations will return unavailable status",
        meta: error,
      });
    }
  }

  /**
   * Get cluster node architectures (replaces kubectl get nodes)
   */
  async getNodeArchitectures(): Promise<{
    nodeArchitectures: string[];
    nodeDetails: Array<{ name: string; arch: string }>;
  }> {
    await this.ensureInitialized();
    try {
      const response = await this.coreV1Api!.listNode();
      const nodes = response.items;

      const nodeDetails = nodes
        .map((node: any) => ({
          name: node.metadata?.name || "unknown",
          arch: node.status?.nodeInfo?.architecture || "unknown",
        }))
        .filter(
          (node: { name: string; arch: string }) =>
            node.name !== "unknown" && node.arch !== "unknown"
        );

      const nodeArchitectures = [
        ...new Set(
          nodeDetails.map((node: { name: string; arch: string }) => node.arch)
        ),
      ] as string[];

      return { nodeArchitectures, nodeDetails };
    } catch (error) {
      log({
        type: "error",
        message: "Failed to get node architectures",
        meta: error,
      });
      throw new Error("Failed to fetch cluster node information");
    }
  }

  /**
   * Create namespace (secure replacement for kubectl create namespace)
   */
  async createNamespace(name: string): Promise<void> {
    await this.ensureInitialized();
    // Input validation - prevent injection
    if (!this.isValidKubernetesName(name)) {
      throw new Error("Invalid namespace name");
    }

    try {
      const namespace = {
        metadata: {
          name: name,
          labels: {
            "app.kubernetes.io/managed-by": "kargo-platform",
          },
        },
      };

      await this.coreV1Api!.createNamespace({ body: namespace });
      log({
        type: "success",
        message: `Namespace created: ${name}`,
      });
    } catch (error) {
      log({
        type: "error",
        message: `Failed to create namespace: ${name}`,
        meta: error,
      });
      throw new Error(`Failed to create namespace: ${name}`);
    }
  }

  /**
   * Delete namespace (secure replacement for kubectl delete namespace)
   */
  async deleteNamespace(
    name: string
  ): Promise<{ success: boolean; message: string }> {
    await this.ensureInitialized();
    // Input validation - prevent injection
    if (!this.isValidKubernetesName(name)) {
      throw new Error("Invalid namespace name");
    }

    try {
      await this.coreV1Api!.deleteNamespace({ name });
      log({
        type: "success",
        message: `Namespace deleted: ${name}`,
      });
      return {
        success: true,
        message: `Namespace ${name} deleted successfully`,
      };
    } catch (error) {
      log({
        type: "error",
        message: `Failed to delete namespace: ${name}`,
        meta: error,
      });
      throw new Error(`Failed to delete namespace: ${name}`);
    }
  }

  /**
   * Apply Kubernetes resource from YAML object (secure replacement for kubectl apply)
   */
  async applyResource(resource: any, namespace?: string): Promise<void> {
    await this.ensureInitialized();
    try {
      const { kind, apiVersion } = resource;

      if (!kind || !apiVersion) {
        throw new Error("Resource must have kind and apiVersion");
      }

      // Route to appropriate API based on resource kind
      switch (kind.toLowerCase()) {
        case "namespace":
          await this.applyNamespace(resource);
          break;
        case "deployment":
          await this.applyDeployment(resource, namespace);
          break;
        case "service":
          await this.applyService(resource, namespace);
          break;
        case "secret":
          await this.applySecret(resource, namespace);
          break;
        case "persistentvolume":
          await this.applyPersistentVolume(resource);
          break;
        case "persistentvolumeclaim":
          await this.applyPersistentVolumeClaim(resource, namespace);
          break;
        default:
          // Handle custom resources or other types
          await this.applyCustomResource(resource, namespace);
      }
    } catch (error) {
      log({
        type: "error",
        message: "Failed to apply Kubernetes resource",
        meta: { error, resource: resource.kind },
      });
      throw error;
    }
  }

  /**
   * Get pods in namespace (secure replacement for kubectl get pods)
   */
  async getPodsInNamespace(namespace: string): Promise<any[]> {
    await this.ensureInitialized();
    if (!this.isValidKubernetesName(namespace)) {
      throw new Error("Invalid namespace name");
    }

    try {
      const response = await this.coreV1Api!.listNamespacedPod({ namespace });
      return response.items;
    } catch (error) {
      log({
        type: "error",
        message: `Failed to get pods in namespace: ${namespace}`,
        meta: error,
      });
      throw new Error(`Failed to get pods in namespace: ${namespace}`);
    }
  }

  /**
   * Get pod logs (secure replacement for kubectl logs)
   */
  async getPodLogs(
    podName: string,
    namespace: string,
    container?: string
  ): Promise<string> {
    await this.ensureInitialized();
    if (
      !this.isValidKubernetesName(podName) ||
      !this.isValidKubernetesName(namespace)
    ) {
      throw new Error("Invalid pod or namespace name");
    }

    try {
      const response = await this.coreV1Api!.readNamespacedPodLog({
        name: podName,
        namespace: namespace,
        container: container,
        tailLines: 1000,
      });
      return response;
    } catch (error) {
      log({
        type: "error",
        message: `Failed to get logs for pod: ${podName}`,
        meta: error,
      });
      throw new Error(`Failed to get pod logs: ${podName}`);
    }
  }

  /**
   * Restart deployment (secure replacement for kubectl rollout restart)
   */
  async restartDeployment(
    deploymentName: string,
    namespace: string
  ): Promise<{ success: boolean; message: string }> {
    await this.ensureInitialized();
    // Input validation - prevent injection
    if (
      !this.isValidKubernetesName(deploymentName) ||
      !this.isValidKubernetesName(namespace)
    ) {
      throw new Error("Invalid deployment or namespace name");
    }

    try {
      // Get the current deployment
      const deployment = await this.appsV1Api!.readNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
      });

      // Ensure spec exists
      if (!deployment.spec) {
        throw new Error("Deployment spec is missing");
      }

      // Add restart annotation to trigger rollout
      const now = new Date().toISOString();
      if (!deployment.spec.template.metadata?.annotations) {
        if (!deployment.spec.template.metadata) {
          deployment.spec.template.metadata = {};
        }
        deployment.spec.template.metadata.annotations = {};
      }

      deployment.spec.template.metadata.annotations[
        "kubectl.kubernetes.io/restartedAt"
      ] = now;

      // Update the deployment to trigger restart
      await this.appsV1Api!.replaceNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
        body: deployment,
      });

      return {
        success: true,
        message: `Deployment ${deploymentName} restart initiated in namespace ${namespace}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to restart deployment ${deploymentName}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Scale deployment (secure replacement for kubectl scale)
   */
  async scaleDeployment(
    deploymentName: string,
    namespace: string,
    replicas: number
  ): Promise<{ success: boolean; message: string }> {
    await this.ensureInitialized();
    // Input validation - prevent injection
    if (
      !this.isValidKubernetesName(deploymentName) ||
      !this.isValidKubernetesName(namespace)
    ) {
      throw new Error("Invalid deployment or namespace name");
    }

    if (replicas < 0) {
      throw new Error("Replicas count cannot be negative");
    }

    try {
      // Get the current deployment
      const deployment = await this.appsV1Api!.readNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
      });

      // Update the replicas count
      if (!deployment.spec) {
        throw new Error("Deployment spec is missing");
      }

      deployment.spec.replicas = replicas;

      // Update the deployment
      await this.appsV1Api!.replaceNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
        body: deployment,
      });

      return {
        success: true,
        message: `Deployment ${deploymentName} scaled to ${replicas} replicas in namespace ${namespace}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to scale deployment ${deploymentName}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get deployment status (secure replacement for kubectl get deployment)
   */
  async getDeploymentStatus(
    deploymentName: string,
    namespace: string
  ): Promise<{ replicas: number; availableReplicas: number }> {
    await this.ensureInitialized();

    // Check if Kubernetes client is available
    if (!this.available) {
      throw new Error(
        "Kubernetes client is not available - cluster configuration not found"
      );
    }

    // Input validation - prevent injection
    if (
      !this.isValidKubernetesName(deploymentName) ||
      !this.isValidKubernetesName(namespace)
    ) {
      throw new Error("Invalid deployment or namespace name");
    }

    try {
      const deployment = await this.appsV1Api!.readNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
      });

      return {
        replicas: deployment.status?.replicas ?? 0,
        availableReplicas: deployment.status?.availableReplicas ?? 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to get deployment status ${deploymentName}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete Kubernetes resource from YAML object (secure replacement for kubectl delete)
   */
  async deleteResource(
    resource: any,
    namespace?: string
  ): Promise<{ success: boolean; message: string }> {
    await this.ensureInitialized();
    try {
      const { kind, apiVersion } = resource;

      if (!kind || !apiVersion) {
        throw new Error("Resource must have kind and apiVersion");
      }

      const name = resource.metadata?.name;
      if (!name) {
        throw new Error("Resource must have a name");
      }

      // Route to appropriate API based on resource kind
      switch (kind.toLowerCase()) {
        case "namespace":
          await this.coreV1Api!.deleteNamespace({ name });
          break;
        case "deployment":
          const ns = namespace || resource.metadata?.namespace;
          await this.appsV1Api!.deleteNamespacedDeployment({
            name,
            namespace: ns,
          });
          break;
        case "service":
          const serviceNs = namespace || resource.metadata?.namespace;
          await this.coreV1Api!.deleteNamespacedService({
            name,
            namespace: serviceNs,
          });
          break;
        case "secret":
          const secretNs = namespace || resource.metadata?.namespace;
          await this.coreV1Api!.deleteNamespacedSecret({
            name,
            namespace: secretNs,
          });
          break;
        case "persistentvolume":
          await this.coreV1Api!.deletePersistentVolume({ name });
          break;
        case "persistentvolumeclaim":
          const pvcNs = namespace || resource.metadata?.namespace;
          await this.coreV1Api!.deleteNamespacedPersistentVolumeClaim({
            name,
            namespace: pvcNs,
          });
          break;
        default:
          // Handle custom resources or other types
          await this.deleteCustomResource(resource, namespace);
      }

      return {
        success: true,
        message: `${kind} ${name} deleted successfully`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      log({
        type: "error",
        message: "Failed to delete Kubernetes resource",
        meta: { error, resource: resource.kind },
      });
      throw new Error(`Failed to delete resource: ${errorMsg}`);
    }
  }

  /**
   * Delete Kubernetes resource by name and kind (secure replacement for kubectl delete)
   */
  async deleteResourceByNameAndKind(
    name: string,
    kind: string,
    namespace?: string
  ): Promise<{ success: boolean; message: string }> {
    await this.ensureInitialized();
    // Input validation - prevent injection
    if (!this.isValidKubernetesName(name)) {
      throw new Error("Invalid resource name");
    }

    if (namespace && !this.isValidKubernetesName(namespace)) {
      throw new Error("Invalid namespace name");
    }

    try {
      // Route to appropriate API based on resource kind
      switch (kind.toLowerCase()) {
        case "namespace":
          await this.coreV1Api!.deleteNamespace({ name });
          break;
        case "deployment":
          if (!namespace) throw new Error("Namespace required for deployment");
          await this.appsV1Api!.deleteNamespacedDeployment({ name, namespace });
          break;
        case "service":
          if (!namespace) throw new Error("Namespace required for service");
          await this.coreV1Api!.deleteNamespacedService({ name, namespace });
          break;
        case "secret":
          if (!namespace) throw new Error("Namespace required for secret");
          await this.coreV1Api!.deleteNamespacedSecret({ name, namespace });
          break;
        case "ingress":
          if (!namespace) throw new Error("Namespace required for ingress");
          await this.customObjectsApi!.deleteNamespacedCustomObject({
            group: "networking.k8s.io",
            version: "v1",
            namespace,
            plural: "ingresses",
            name,
          });
          break;
        case "persistentvolume":
          await this.coreV1Api!.deletePersistentVolume({ name });
          break;
        case "persistentvolumeclaim":
          if (!namespace) throw new Error("Namespace required for PVC");
          await this.coreV1Api!.deleteNamespacedPersistentVolumeClaim({
            name,
            namespace,
          });
          break;
        default:
          throw new Error(`Unsupported resource kind: ${kind}`);
      }

      return {
        success: true,
        message: `${kind} ${name} deleted successfully`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to delete ${kind} ${name}: ${errorMsg}`);
    }
  }

  private async deleteCustomResource(
    resource: any,
    namespace?: string
  ): Promise<void> {
    const { group, version } = this.parseApiVersion(resource.apiVersion);
    const plural = this.kindToPlural(resource.kind);
    const name = resource.metadata?.name;
    const ns = namespace || resource.metadata?.namespace;

    if (ns) {
      await this.customObjectsApi!.deleteNamespacedCustomObject({
        group,
        version,
        namespace: ns,
        plural,
        name,
      });
    } else {
      await this.customObjectsApi!.deleteClusterCustomObject({
        group,
        version,
        plural,
        name,
      });
    }
  }

  // Private helper methods for applying different resource types

  private async applyNamespace(resource: any): Promise<void> {
    const name = resource.metadata?.name;
    if (!name) throw new Error("Namespace must have a name");

    try {
      // Try to get existing namespace
      await this.coreV1Api!.readNamespace({ name });
      // If it exists, we don't need to update it - namespaces are typically static
      log({
        type: "info",
        message: `Namespace ${name} already exists - skipping update`,
      });
    } catch (error: any) {
      // Check for 404 error indicating namespace doesn't exist
      if (
        error.code === 404 ||
        error.response?.statusCode === 404 ||
        (error.body && error.body.includes("not found"))
      ) {
        // Namespace doesn't exist, create it
        try {
          await this.coreV1Api!.createNamespace({ body: resource });
          log({
            type: "success",
            message: `Namespace ${name} created successfully`,
          });
        } catch (createError: any) {
          throw new Error(
            `Failed to create namespace ${name}: ${
              createError.message || createError
            }`
          );
        }
      } else {
        throw error;
      }
    }
  }

  private async applyDeployment(
    resource: any,
    namespace?: string
  ): Promise<void> {
    const name = resource.metadata?.name;
    const ns = namespace || resource.metadata?.namespace;

    if (!name || !ns)
      throw new Error("Deployment must have name and namespace");

    try {
      await this.appsV1Api!.readNamespacedDeployment({ name, namespace: ns });
      // If it exists, replace it (more reliable than patching)
      await this.appsV1Api!.replaceNamespacedDeployment({
        name,
        namespace: ns,
        body: resource,
      });
    } catch (error: any) {
      if (
        error.code === 404 ||
        error.response?.statusCode === 404 ||
        (error.body && error.body.includes("not found"))
      ) {
        await this.appsV1Api!.createNamespacedDeployment({
          namespace: ns,
          body: resource,
        });
      } else {
        throw error;
      }
    }
  }

  private async applyService(resource: any, namespace?: string): Promise<void> {
    const name = resource.metadata?.name;
    const ns = namespace || resource.metadata?.namespace;

    if (!name || !ns) throw new Error("Service must have name and namespace");

    try {
      await this.coreV1Api!.readNamespacedService({ name, namespace: ns });
      // If it exists, replace it (more reliable than patching)
      await this.coreV1Api!.replaceNamespacedService({
        name,
        namespace: ns,
        body: resource,
      });
    } catch (error: any) {
      if (
        error.code === 404 ||
        error.response?.statusCode === 404 ||
        (error.body && error.body.includes("not found"))
      ) {
        await this.coreV1Api!.createNamespacedService({
          namespace: ns,
          body: resource,
        });
      } else {
        throw error;
      }
    }
  }

  private async applySecret(resource: any, namespace?: string): Promise<void> {
    const name = resource.metadata?.name;
    const ns = namespace || resource.metadata?.namespace;

    if (!name || !ns) throw new Error("Secret must have name and namespace");

    try {
      await this.coreV1Api!.readNamespacedSecret({ name, namespace: ns });
      // If it exists, replace it (more reliable than patching)
      await this.coreV1Api!.replaceNamespacedSecret({
        name,
        namespace: ns,
        body: resource,
      });
    } catch (error: any) {
      if (
        error.code === 404 ||
        error.response?.statusCode === 404 ||
        (error.body && error.body.includes("not found"))
      ) {
        await this.coreV1Api!.createNamespacedSecret({
          namespace: ns,
          body: resource,
        });
      } else {
        throw error;
      }
    }
  }

  private async applyPersistentVolume(resource: any): Promise<void> {
    const name = resource.metadata?.name;
    if (!name) throw new Error("PersistentVolume must have a name");

    try {
      await this.coreV1Api!.readPersistentVolume({ name });
      // If it exists, replace it (more reliable than patching)
      await this.coreV1Api!.replacePersistentVolume({ name, body: resource });
    } catch (error: any) {
      if (
        error.code === 404 ||
        error.response?.statusCode === 404 ||
        (error.body && error.body.includes("not found"))
      ) {
        await this.coreV1Api!.createPersistentVolume({ body: resource });
      } else {
        throw error;
      }
    }
  }

  private async applyPersistentVolumeClaim(
    resource: any,
    namespace?: string
  ): Promise<void> {
    const name = resource.metadata?.name;
    const ns = namespace || resource.metadata?.namespace;

    if (!name || !ns)
      throw new Error("PersistentVolumeClaim must have name and namespace");

    try {
      await this.coreV1Api!.readNamespacedPersistentVolumeClaim({
        name,
        namespace: ns,
      });
      // If it exists, replace it (more reliable than patching)
      await this.coreV1Api!.replaceNamespacedPersistentVolumeClaim({
        name,
        namespace: ns,
        body: resource,
      });
    } catch (error: any) {
      if (
        error.code === 404 ||
        error.response?.statusCode === 404 ||
        (error.body && error.body.includes("not found"))
      ) {
        await this.coreV1Api!.createNamespacedPersistentVolumeClaim({
          namespace: ns,
          body: resource,
        });
      } else {
        throw error;
      }
    }
  }

  private async applyCustomResource(
    resource: any,
    namespace?: string
  ): Promise<void> {
    // Handle custom resources or other types
    const { group, version } = this.parseApiVersion(resource.apiVersion);
    const plural = this.kindToPlural(resource.kind);
    const name = resource.metadata?.name;
    const ns = namespace || resource.metadata?.namespace;

    if (ns) {
      // Namespaced resource
      try {
        await this.customObjectsApi!.getNamespacedCustomObject({
          group,
          version,
          namespace: ns,
          plural,
          name,
        });
        // If it exists, replace it (more reliable than patching)
        await this.customObjectsApi!.replaceNamespacedCustomObject({
          group,
          version,
          namespace: ns,
          plural,
          name,
          body: resource,
        });
      } catch (error: any) {
        if (
          error.code === 404 ||
          error.response?.statusCode === 404 ||
          (error.body && error.body.includes("not found"))
        ) {
          await this.customObjectsApi!.createNamespacedCustomObject({
            group,
            version,
            namespace: ns,
            plural,
            body: resource,
          });
        } else {
          throw error;
        }
      }
    } else {
      // Cluster-wide resource
      try {
        await this.customObjectsApi!.getClusterCustomObject({
          group,
          version,
          plural,
          name,
        });
        // If it exists, replace it (more reliable than patching)
        await this.customObjectsApi!.replaceClusterCustomObject({
          group,
          version,
          plural,
          name,
          body: resource,
        });
      } catch (error: any) {
        if (
          error.code === 404 ||
          error.response?.statusCode === 404 ||
          (error.body && error.body.includes("not found"))
        ) {
          await this.customObjectsApi!.createClusterCustomObject({
            group,
            version,
            plural,
            body: resource,
          });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Validate Kubernetes resource names to prevent injection
   */
  private isValidKubernetesName(name: string): boolean {
    // Kubernetes name validation rules:
    // - lowercase alphanumeric characters or '-'
    // - start and end with alphanumeric character
    // - max 253 characters
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    return nameRegex.test(name) && name.length <= 253;
  }

  /**
   * Parse apiVersion into group and version
   */
  private parseApiVersion(apiVersion: string): {
    group: string;
    version: string;
  } {
    const parts = apiVersion.split("/");
    if (parts.length === 1) {
      return { group: "", version: parts[0] };
    }
    return { group: parts[0], version: parts[1] };
  }

  /**
   * Convert Kind to plural form for API calls
   */
  private kindToPlural(kind: string): string {
    const pluralMap: { [key: string]: string } = {
      Deployment: "deployments",
      Service: "services",
      Pod: "pods",
      Secret: "secrets",
      ConfigMap: "configmaps",
      PersistentVolume: "persistentvolumes",
      PersistentVolumeClaim: "persistentvolumeclaims",
      Namespace: "namespaces",
    };

    return pluralMap[kind] || `${kind.toLowerCase()}s`;
  }
}

// Create a lazy-initialized singleton instance
let k8sClientInstance: KubernetesClient | null = null;

export const getK8sClient = (): KubernetesClient => {
  if (!k8sClientInstance) {
    k8sClientInstance = new KubernetesClient();
  }
  return k8sClientInstance;
};

// For backward compatibility
export const k8sClient = getK8sClient();
export default k8sClient;
