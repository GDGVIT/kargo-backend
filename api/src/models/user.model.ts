import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  googleId?: string;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Only for email/password
    googleId: { type: String }, // Only for Google OAuth
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
