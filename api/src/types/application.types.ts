import mongoose from "mongoose";

export interface IApplication {
  _id?: mongoose.Types.ObjectId | string;
  name: string;
  imageUrl: string;
  imageTag: string;
  namespace?: string;
  deploymentName?: string;
  serviceName?: string;
  env?: Record<string, string>;
  owner: mongoose.Types.ObjectId;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  ports?: Array<{
    containerPort: number;
    protocol?: string;
    subdomain?: string;
  }>;
  volumes?: Array<{
    name: string;
    mountPath: string;
    type?: string;
    configMapName?: string;
    secretName?: string;
    claimName?: string;
    size?: string;
    readOnly?: boolean;
    secretItems?: Array<{ key: string; path: string }>;
  }>;
  livenessProbe?: Record<string, any>;
  readinessProbe?: Record<string, any>;
  command?: string[];
  args?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<Record<string, any>>;
  affinity?: Record<string, any>;
  credentials?: Array<{
    name: string;
    registryType: string;
    username: string;
    token: string;
  }>;
}
