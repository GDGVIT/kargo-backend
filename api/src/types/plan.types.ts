import mongoose from "mongoose";
import { Resource } from "./application.types";

export default interface IPlan {
  _id?: mongoose.Types.ObjectId | string;
  name: string;
  description?: string;
  resources: {
    requests?: Resource;
    limits?: Resource;
  };
  isDefault?: boolean;
  /** Price in paise (integer) */
  price?: number;
  isActive?: boolean;
}
