import mongoose, { Document, Schema } from "mongoose";

export interface IApplication extends Document {
  name: string;
  imageUrl: string;
  imageTag: string;
  registryToken: string;
  namespace?: string;
  deploymentName?: string;
  serviceName?: string;
  ingressHost?: string;
  env?: Record<string, string>;
  owner: mongoose.Types.ObjectId;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  ports?: Array<{
    name?: string;
    containerPort: number;
    protocol?: string;
    ingressEnabled?: boolean; // Add this field
    subdomain?: string; // Add this field
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
  ingress?: {
    enabled: boolean;
    host?: string;
    paths?: Array<{
      path: string;
      pathType?: string;
      servicePort?: number;
    }>;
    annotations?: Record<string, string>;
    tls?: Array<{
      hosts: string[];
      secretName: string;
    }>;
    subdomains?: Record<string, number>;
  };
  livenessProbe?: Record<string, any>;
  readinessProbe?: Record<string, any>;
  command?: string[];
  args?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<Record<string, any>>;
  affinity?: Record<string, any>;
}

const ResourceSchema = new Schema(
  {
    cpu: String,
    memory: String,
  },
  { _id: false }
);

const PortSchema = new Schema(
  {
    name: String,
    containerPort: { type: Number, required: true },
    protocol: String,
    ingressEnabled: Boolean, // Add this field
    subdomain: String, // Add this field
  },
  { _id: false }
);

const SecretItemSchema = new Schema(
  {
    key: String,
    path: String,
  },
  { _id: false }
);

const VolumeSchema = new Schema(
  {
    name: { type: String, required: true },
    mountPath: { type: String, required: true },
    type: String,
    configMapName: String,
    secretName: String,
    claimName: String,
    size: String,
    readOnly: Boolean,
    secretItems: [SecretItemSchema],
  },
  { _id: false }
);

const IngressPathSchema = new Schema(
  {
    path: { type: String, required: true },
    pathType: String,
    servicePort: Number,
  },
  { _id: false }
);

const TLSConfigSchema = new Schema(
  {
    hosts: [String],
    secretName: String,
  },
  { _id: false }
);

const IngressSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    host: String,
    paths: [IngressPathSchema],
    annotations: { type: Map, of: String },
    tls: [TLSConfigSchema],
    subdomains: { type: Map, of: Number },
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplication>(
  {
    name: { type: String, required: true },
    imageUrl: { type: String, required: true },
    imageTag: { type: String, required: true },
    registryToken: { type: String, required: true },
    namespace: String,
    deploymentName: String,
    serviceName: String,
    ingressHost: String,
    env: { type: Map, of: String },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resources: {
      requests: ResourceSchema,
      limits: ResourceSchema,
    },
    ports: [PortSchema],
    volumes: [VolumeSchema],
    ingress: IngressSchema,
    livenessProbe: Schema.Types.Mixed,
    readinessProbe: Schema.Types.Mixed,
    command: [String],
    args: [String],
    labels: { type: Map, of: String },
    annotations: { type: Map, of: String },
    nodeSelector: { type: Map, of: String },
    tolerations: [Schema.Types.Mixed],
    affinity: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.model<IApplication>("Application", applicationSchema);
