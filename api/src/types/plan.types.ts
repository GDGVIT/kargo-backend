import mongoose from "mongoose";

export default interface IPlan {
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
  /** Price in paise (integer) */
  price?: number;
  isActive?: boolean;
}
