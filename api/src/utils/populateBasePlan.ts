import Plan from '../models/plan.model';
import log from './logging/logger';

/**
 * Checks if the plans collection is empty and populates it with a base plan if needed.
 */
export async function populateBasePlanIfEmpty() {
  const planCount = await Plan.countDocuments();
  if (planCount === 0) {
    await Plan.create({
      name: 'Base Plan',
      description: 'Default base plan automatically created on first start.',
      resources: {
        requests: {
          cpu: 0.015, // 15m cores
          memory: 33554432, // 32 MiB in bytes
          storage: 1073741824, // 1 GiB in bytes
        },
        limits: {
          cpu: 0.02, // 20m cores
          memory: 67108864, // 64 MiB in bytes
          storage: 1073741824, // 1 GiB in bytes
        },
      },
      isDefault: true,
      price: 0,
      isActive: true,
    });
    log({ type: 'info', message: 'Base plan created as default.' });
  }
}
