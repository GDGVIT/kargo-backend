import { Request, Response } from "express";
import User from "../../models/user.model";

const getAllUsers = async (_req: Request, res: Response) => {
	const users = await User.find(
		{},
		"_id name email role username plan extraResources"
	).populate({
		path: "plan",
		select: "_id name isDefault resources",
	});
	res.json({ users });
};

export default getAllUsers;
