import mongoose, { Document, Schema } from "mongoose";

export interface IPlan extends Document {
  name: string;
  description?: string;
  resources: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  isDefault?: boolean;
  price?: number;
  isActive?: boolean;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
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
    isDefault: { type: Boolean, default: false },
    price: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPlan>("Plan", planSchema);
