import { Request, Response, NextFunction } from "express";
import Plan from "../../models/plan.model";

// Delete a plan (admin only)
const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;
		const plan = await Plan.findByIdAndDelete(id);
		if (!plan) return res.status(404).json({ message: "Plan not found" });
		res.json({ message: "Plan deleted" });
	} catch (err) {
		next(err);
	}
};

export default deletePlan;
