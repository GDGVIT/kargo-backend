import mongoose from "mongoose";
import { Resource } from "./application.types";

export interface IOAuth {
  googleId?: string;
  githubId?: string;
}

export interface IRegistryCredential {
  name: string;
  registryType: "dockerhub" | "github" | "gitlab" | "other";
  username: string;
  token: string;
}

export default interface IUser {
  _id?: mongoose.Types.ObjectId | string;
  email: string;
  password?: string;
  oauth?: IOAuth;
  username?: string;
  profilePicture?: string;
  name?: string;
  githubInstallationId?: string[];
  isVerified?: boolean;
  verificationToken?: string;
  role?: "user" | "admin" | "superadmin";
  resources?: {
    requests?: Resource;
    limits?: Resource;
  };
  extraResources?: {
    requests?: Resource;
    limits?: Resource;
  };
  plan?: mongoose.Types.ObjectId | string;
  credentials?: IRegistryCredential[];
}
