import { Request, Response, NextFunction } from "express";
import Plan from "../../models/plan.model";

// Update a plan (admin only)
const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;
		const { name, description, resources, isDefault, price, isActive } =
			req.body;
		if (isDefault) {
			await Plan.updateMany({ isDefault: true }, { isDefault: false });
		}
		const plan = await Plan.findByIdAndUpdate(
			id,
			{ name, description, resources, isDefault, price, isActive },
			{ new: true }
		);
		if (!plan) return res.status(404).json({ message: "Plan not found" });
		res.json({ message: "Plan updated", plan });
	} catch (err) {
		next(err);
	}
};

export default updatePlan;
