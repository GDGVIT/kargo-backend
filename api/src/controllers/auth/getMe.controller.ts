import { Request, Response } from "express";
import User from "../../models/user.model";
import log, { formatNotification } from "../../utils/logging/logger";
import sanitizeUser from "../../utils/auth/sanitizeUser";

const getMe = async (req: Request, res: Response) => {
	if (req.isAuthenticated && req.isAuthenticated()) {
		const user = await User.findById((req.user as any)._id).populate("plan");
		if (!user) {
			log({ type: "error", message: "User not found" });
			return res
				.status(404)
				.json(formatNotification("User not found", "error"));
		}
		res.json({ user: sanitizeUser(user) });
	} else {
		log({ type: "error", message: "Not authenticated" });
		res.status(401).json(formatNotification("Not authenticated", "error"));
	}
};

export default getMe;
