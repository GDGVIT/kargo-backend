import { Request, Response } from "express";
import User from "../../models/user.model";
import log, { formatNotification } from "../../utils/logging/logger";
import type IUser from "../../types/user.types";
import type { Document } from "mongoose";

// Add or update a registry credential for the authenticated user
const upsertRegistryCredential = async (req: Request, res: Response) => {
	const userId = (req.user as any)?._id;
	const { name, registryType, username, token } = req.body;
	if (!name || !registryType || !username || !token) {
		log({ type: "error", message: "All fields are required" });
		return res
			.status(400)
			.json(formatNotification("All fields are required", "error"));
	}
	const user = (await User.findById(userId)) as (IUser & Document) | null;
	if (!user) {
		log({ type: "error", message: "User not found" });
		return res.status(404).json(formatNotification("User not found", "error"));
	}
	const existing = user.credentials?.find(
		(c) => c.name === name && c.registryType === registryType
	);
	if (existing) {
		existing.username = username;
		existing.token = token;
	} else {
		user.credentials?.push({ name, registryType, username, token });
	}
	await user.save();
	log({ type: "success", message: `Credential saved for user: ${user.email}` });
	res.json({
		...formatNotification("Credential saved", "success"),
		credentials: user.credentials,
	});
};

export default upsertRegistryCredential;
