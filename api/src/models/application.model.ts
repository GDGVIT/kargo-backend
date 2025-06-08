import mongoose, { Document, Schema } from "mongoose";

export interface IApplication extends Document {
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
    name?: string;
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
    subdomain: String,
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

const applicationSchema = new Schema<IApplication>(
  {
    name: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(v);
        },
        message:
          "Application name must be lowercase, alphanumeric, and may contain hyphens. No underscores or uppercase letters allowed. (Kubernetes DNS-1123 subdomain format)",
      },
      minlength: 1,
      maxlength: 63,
    },
    imageUrl: { type: String, required: true },
    imageTag: { type: String, required: true },
    credentials: [
      {
        name: { type: String, required: true },
        registryType: { type: String, required: true },
        username: { type: String, required: true },
        token: { type: String, required: true },
      },
    ],
    namespace: String,
    deploymentName: String,
    serviceName: String,
    env: { type: Map, of: String },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resources: {
      requests: ResourceSchema,
      limits: ResourceSchema,
    },
    ports: [PortSchema],
    volumes: [VolumeSchema],
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
