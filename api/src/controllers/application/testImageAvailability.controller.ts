import { Request, Response } from "express";
import testImageAvailability from "../../utils/docker/testImageAvailability";
import log, { formatNotification } from "../../utils/logging/logger";
import User from "../../models/user.model";
import type IUser from "../../types/user.types";
import type { Document } from "mongoose";
import asyncHandler from "../../utils/handlers/asyncHandler";

const testImageAvailabilityController = asyncHandler(async (req: Request, res: Response) => {
  const { imageUrl, imageTag, credentialIds } = req.body;

  if (!imageUrl || typeof imageUrl !== "string") {
    log({ type: "error", message: "Missing or invalid 'imageUrl' in body." });
    return res
      .status(400)
      .json(formatNotification("Missing or invalid 'imageUrl' in body.", "error"));
  }

  const tag = imageTag || "latest";

  try {
    // Get user's registry credentials
    const userId = (req.user as any)?._id;
    let credentials: any[] = [];

    if (userId) {
      const user = (await User.findById(userId)) as (IUser & Document) | null;
      if (user && user.credentials) {
        // If specific credential IDs are provided, filter to only those
        if (credentialIds && Array.isArray(credentialIds) && credentialIds.length > 0) {
          credentials = user.credentials.filter(cred => 
            credentialIds.includes(cred.name + ":" + cred.registryType)
          );
        } else {
          credentials = user.credentials;
        }
      }
    }

    log({
      type: "info",
      message: `Testing image availability: ${imageUrl}:${tag} (${credentials.length} credentials available${credentialIds ? `, filtered: ${credentialIds.join(', ')}` : ''})`,
    });

    const result = await testImageAvailability(imageUrl, tag, credentials);

    if (result.available) {
      log({
        type: "success",
        message: `Image ${imageUrl}:${tag} is available`,
      });
      
      res.json({
        ...formatNotification("Image is available", "success"),
        available: true,
        authTested: result.authTested,
        testedWith: result.testedWith,
      });
    } else {
      log({
        type: "warning",
        message: `Image ${imageUrl}:${tag} is not available: ${result.error}`,
      });
      
      res.status(404).json({
        ...formatNotification(
          result.needsAuth 
            ? "Image not accessible. Check if the image exists and you have proper credentials configured."
            : "Image not found or not accessible.",
          "error"
        ),
        available: false,
        needsAuth: result.needsAuth,
        authTested: result.authTested,
        error: result.error,
        suggestions: result.suggestions,
      });
    }
  } catch (error: any) {
    log({
      type: "error",
      message: "Error testing image availability",
      meta: error,
    });
    
    res.status(500).json({
      ...formatNotification("Failed to test image availability", "error"),
      available: false,
      error: error.message || "Unknown error occurred",
    });
  }
});

export default testImageAvailabilityController;
