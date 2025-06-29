import mongoose, { Document, Schema } from "mongoose";
import IApplication from "../types/application.types";

export const ResourceSchema = new Schema(
  {
    cpuMilli: { type: Number, min: 0 }, // e.g., 250 = 0.25 vCPU
    memoryMB: { type: Number, min: 0 }, // e.g., 512
    storageGB: { type: Number, min: 0 }, // e.g., 10
  },
  { _id: false }
);

const PortSchema = new Schema(
  {
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

const applicationSchema = new Schema<IApplication & Document>(
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

export default mongoose.model<IApplication & Document>(
  "Application",
  applicationSchema
);
