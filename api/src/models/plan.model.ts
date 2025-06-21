import mongoose, { Document, Schema } from "mongoose";
import IPlan from "../types/plan.types";
import { ResourceSchema } from "./application.model";

const planSchema = new Schema<IPlan & Document>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    resources: {
      requests: ResourceSchema,
      limits: ResourceSchema,
    },
    isDefault: { type: Boolean, default: false },
    price: { type: Number /* Price in paise (integer) */ },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPlan>("Plan", planSchema);
