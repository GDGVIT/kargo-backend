import { Request, Response } from "express";
import Application from "../../models/application.model";
import asyncHandler from "../../utils/handlers/asyncHandler";
import {
	getNamespace,
	getResourceName,
} from "../../utils/k8s/helpers/k8sHelpers";
import { mapPorts } from "../../utils/k8s/helpers/portHelpers";
import { checkResourceQuota } from "../../utils/k8s/helpers/resourceQuota";
import log, { formatNotification } from "../../utils/logging/logger";

const updateApplication = asyncHandler(async (req: Request, res: Response) => {
	const {
		name,
		env: envVars,
		resources,
		ports = [],
		volumes,
		livenessProbe,
		readinessProbe,
		command,
		args,
		labels,
		annotations,
		tolerations,
		affinity,
	} = req.body;
	let credentials = req.body.credentials;
	if (credentials === undefined) {
		const existingApp = await Application.findById(req.params.id);
		credentials = existingApp?.credentials || [];
	}
	const owner = (req.user as any)?._id || req.body.owner;
	const namespace = getNamespace(owner.toString(), name);
	const deploymentName = getResourceName("deploy", name);
	const serviceName = getResourceName("svc", name);

	const username = (req.user as any)?.username || req.body.username || "user";
	const updatedPorts = mapPorts(ports, username);

	try {
		if (resources) {
			const quota = await checkResourceQuota({ resources, owner, req });
			if (quota.exceeded) {
				log({
					type: "warning",
					message: "Resource allocation exceeds allowed quota.",
				});
				return res.status(400).json({
					...formatNotification(
						"Resource allocation exceeds your allowed quota.",
						"warning"
					),
					allowed: quota.allowed,
					usage: quota.usage,
				});
			}
		}
		const app = await Application.findByIdAndUpdate(
			req.params.id,
			{
				name,
				imageUrl: req.body.imageUrl,
				imageTag: req.body.imageTag,
				namespace,
				deploymentName,
				serviceName,
				env: envVars,
				resources,
				ports: updatedPorts,
				volumes,
				livenessProbe,
				readinessProbe,
				command,
				args,
				labels,
				annotations,
				nodeSelector: req.body.nodeSelector,
				tolerations,
				affinity,
				owner,
				credentials, // always update credentials
			},
			{ new: true }
		);
		if (!app) {
			log({ type: "error", message: "Application not found" });
			return res
				.status(404)
				.json(formatNotification("Application not found", "error"));
		}
		log({ type: "success", message: `Application updated: ${app.name}` });
		res.json({
			...formatNotification("Application updated", "success"),
			application: app,
		});
	} catch (err) {
		log({
			type: "error",
			message: "Failed to update application",
			meta: err,
		});
		res
			.status(500)
			.json(formatNotification("Failed to update application", "error"));
	}
});

export default updateApplication;
