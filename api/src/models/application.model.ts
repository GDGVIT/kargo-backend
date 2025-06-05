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
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  ports?: Array<{
    name?: string;
    containerPort: number;
    protocol?: string;
  }>;
  volumes?: Array<{
    name: string;
    mountPath: string;
    type?: string; // e.g., 'configMap', 'secret', 'persistentVolumeClaim'
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

const applicationSchema = new Schema<IApplication>(
  {
    name: { type: String, required: true },
    imageUrl: { type: String, required: true },
    imageTag: { type: String, required: true },
    registryToken: { type: String, required: true },
    namespace: { type: String },
    deploymentName: { type: String },
    serviceName: { type: String },
    ingressHost: { type: String },
    env: { type: Map, of: String },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resources: {
      requests: {
        cpu: { type: String },
        memory: { type: String },
      },
      limits: {
        cpu: { type: String },
        memory: { type: String },
      },
    },
    ports: [
      {
        name: { type: String },
        containerPort: { type: Number, required: true },
        protocol: { type: String },
      },
    ],
    volumes: [
      {
        name: { type: String, required: true },
        mountPath: { type: String, required: true },
        type: { type: String },
        configMapName: { type: String },
        secretName: { type: String },
        claimName: { type: String },
        size: { type: String },
        readOnly: { type: Boolean },
        secretItems: [
          {
            key: { type: String },
            path: { type: String },
          },
        ],
      },
    ],
    ingress: {
      enabled: { type: Boolean, default: false },
      host: { type: String },
      paths: [
        {
          path: { type: String, required: true },
          pathType: { type: String },
          servicePort: { type: Number },
        },
      ],
      annotations: { type: Map, of: String },
      tls: [
        {
          hosts: [{ type: String }],
          secretName: { type: String },
        },
      ],
    },
    livenessProbe: { type: Schema.Types.Mixed },
    readinessProbe: { type: Schema.Types.Mixed },
    command: [{ type: String }],
    args: [{ type: String }],
    labels: { type: Map, of: String },
    annotations: { type: Map, of: String },
    nodeSelector: { type: Map, of: String },
    tolerations: [{ type: Schema.Types.Mixed }],
    affinity: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model<IApplication>("Application", applicationSchema);
