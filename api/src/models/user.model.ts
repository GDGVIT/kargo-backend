import mongoose, { Document, Schema } from "mongoose";

export interface IOAuth {
  googleId?: string;
  githubId?: string;
}

export interface IRegistryCredential {
  name: string; // e.g. "DockerHub Personal", "GitHub PAT"
  registryType: "dockerhub" | "github" | "gitlab" | "other";
  username: string;
  token: string;
}

export interface IUser extends Document {
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
  plan?: string;
  credentials?: IRegistryCredential[];
}

const oauthSchema = new Schema<IOAuth>(
  {
    googleId: { type: String },
    githubId: { type: String },
  },
  { _id: false }
);

const registryCredentialSchema = new Schema<IRegistryCredential>(
  {
    name: { type: String, required: true },
    registryType: {
      type: String,
      enum: ["dockerhub", "github", "gitlab", "other"],
      required: true,
    },
    username: { type: String, required: true },
    token: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String },
    oauth: { type: oauthSchema, default: {} },
    username: { type: String },
    profilePicture: { type: String },
    name: { type: String },
    githubInstallationId: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
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
    extraResources: {
      requests: {
        cpu: { type: String },
        memory: { type: String },
      },
      limits: {
        cpu: { type: String },
        memory: { type: String },
      },
    },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    credentials: { type: [registryCredentialSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
