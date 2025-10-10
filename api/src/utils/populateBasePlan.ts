import Plan from "../models/plan.model";
import log from "./logging/logger";

/**
 * Checks if the plans collection is empty and populates it with a base plan if needed.
 */
export async function populateBasePlanIfEmpty() {
	const planCount = await Plan.countDocuments();
	if (planCount === 0) {
		await Plan.create({
			name: "Base Plan",
			description: "Default base plan automatically created on first start.",
			resources: {
				requests: {
					cpuMilli: 15, // 15 m
					memoryMB: 32, // 32 MB
					storageGB: 1, // 1 GB
				},
				limits: {
					cpuMilli: 20, // 20 m
					memoryMB: 64, // 64 MB
					storageGB: 1, // 1 GB
				},
			},
			isDefault: true,
			price: 0,
			isActive: true,
		});
		log({ type: "info", message: "Base plan created as default." });
	}
}
