import mongoose, { Document, Schema } from "mongoose";
import IUser, { IOAuth, IRegistryCredential } from "../types/user.types";
import { ResourceSchema } from "./application.model";

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

const userSchema = new Schema<IUser & Document>(
	{
		_id: { type: Schema.Types.ObjectId, auto: true },
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
			requests: ResourceSchema,
			limits: ResourceSchema,
		},
		extraResources: {
			requests: ResourceSchema,
			limits: ResourceSchema,
		},
		plan: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
		credentials: { type: [registryCredentialSchema], default: [] },
	},
	{ timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
