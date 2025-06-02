import mongoose, { Document, Schema } from "mongoose";

export interface IOAuth {
  googleId?: string;
  githubId?: string;
}

export interface IUser extends Document {
  email: string;
  password?: string;
  oauth?: IOAuth;
  username?: string;
  profilePicture?: string;
  name?: string;
  githubInstallationId?: string[];
}

const oauthSchema = new Schema<IOAuth>(
  {
    googleId: { type: String },
    githubId: { type: String },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Only for email/password
    oauth: { type: oauthSchema, default: {} },
    username: { type: String },
    profilePicture: { type: String },
    name: { type: String },
    githubInstallationId: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
