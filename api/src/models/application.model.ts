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
  },
  { timestamps: true }
);

export default mongoose.model<IApplication>("Application", applicationSchema);
