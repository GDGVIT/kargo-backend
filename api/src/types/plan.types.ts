import mongoose from "mongoose";

export interface IPlan {
  _id?: mongoose.Types.ObjectId | string;
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
