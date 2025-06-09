import mongoose from "mongoose";

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

export interface IUser {
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
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  extraResources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  plan?: mongoose.Types.ObjectId | string;
  credentials?: IRegistryCredential[];
}
