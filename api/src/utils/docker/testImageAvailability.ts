import { spawn } from "child_process";
import type { IRegistryCredential } from "../../types/user.types";
import log from "../logging/logger";

interface ImageTestResult {
  available: boolean;
  error?: string;
  needsAuth?: boolean;
  authTested?: boolean;
  testedWith?: string;
  suggestions?: string[];
}

/**
 * Test if a Docker image is available for pulling
 * @param imageUrl The Docker image URL (e.g., nginx, ghcr.io/owner/repo)
 * @param imageTag The image tag (e.g., latest, v1.0.0)
 * @param credentials Array of registry credentials to try if public pull fails
 * @returns Promise with test result
 */
export default async function testImageAvailability(
  imageUrl: string,
  imageTag: string = "latest",
  credentials?: IRegistryCredential[]
): Promise<ImageTestResult> {
  const fullImageName = `${imageUrl}:${imageTag}`;
  
  log({
    type: "info",
    message: `Testing availability of Docker image: ${fullImageName}`,
  });

  // First try without authentication (public image)
  const publicResult = await testImagePull(fullImageName);
  
  if (publicResult.available) {
    log({
      type: "success",
      message: `Image ${fullImageName} is publicly available`,
    });
    return { available: true };
  }

  // If public pull failed and we have credentials, try with authentication
  if (credentials && credentials.length > 0) {
    log({
      type: "info",
      message: `Public pull failed, testing with ${credentials.length} credential(s)`,
    });

    const suggestions: string[] = [];
    let testedCredentials = 0;

    for (const credential of credentials) {
      // Check if this credential is relevant for the image registry
      if (isCredentialRelevant(imageUrl, credential)) {
        testedCredentials++;
        log({
          type: "info",
          message: `Testing with credential: ${credential.name} (${credential.registryType})`,
        });

        const authResult = await testImagePullWithAuth(fullImageName, credential);
        
        if (authResult.available) {
          log({
            type: "success",
            message: `Image ${fullImageName} is available with authentication`,
          });
          return { 
            available: true, 
            authTested: true, 
            testedWith: `${credential.name} (${credential.registryType})`
          };
        } else {
          suggestions.push(`Failed with ${credential.name} (${credential.registryType}): ${authResult.error}`);
        }
      }
    }

    if (testedCredentials === 0) {
      suggestions.push("No credentials found that match this registry. Consider adding credentials for the appropriate registry type.");
    }

    return { 
      available: false, 
      needsAuth: true,
      authTested: true,
      error: `Image not accessible with ${testedCredentials} tested credential(s)`,
      suggestions
    };
  }

  // No credentials provided or available, return the public test result
  const suggestions: string[] = [];
  
  // Determine registry type and suggest appropriate credentials
  if (fullImageName.includes("ghcr.io")) {
    suggestions.push("This appears to be a GitHub Container Registry image. Consider adding GitHub registry credentials.");
  } else if (fullImageName.includes("registry.gitlab.com")) {
    suggestions.push("This appears to be a GitLab Container Registry image. Consider adding GitLab registry credentials.");
  } else if (!fullImageName.includes("/") || fullImageName.includes("docker.io")) {
    suggestions.push("This appears to be a Docker Hub image. Consider adding Docker Hub registry credentials if it's private.");
  } else {
    suggestions.push("This appears to be a private registry image. Consider adding appropriate registry credentials.");
  }

  return { 
    available: false, 
    needsAuth: true,
    error: publicResult.error || "Image not publicly accessible and no credentials provided",
    suggestions
  };
}

/**
 * Test image pull without authentication
 */
async function testImagePull(fullImageName: string): Promise<ImageTestResult> {
  return new Promise((resolve) => {
    // Use docker manifest inspect to test without actually pulling
    const docker = spawn("docker", ["manifest", "inspect", fullImageName], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";

    docker.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    docker.on("close", (code) => {
      if (code === 0) {
        resolve({ available: true });
      } else {
        resolve({ 
          available: false, 
          error: stderr.trim() || `Docker manifest inspect failed with code ${code}`
        });
      }
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      docker.kill();
      resolve({ 
        available: false, 
        error: "Docker manifest inspect timed out"
      });
    }, 30000);
  });
}

/**
 * Test image pull with authentication
 */
async function testImagePullWithAuth(
  fullImageName: string, 
  credential: IRegistryCredential
): Promise<ImageTestResult> {
  return new Promise((resolve) => {
    // Get registry server for login
    const registryServer = getRegistryServer(credential);
    
    // First login to the registry
    const loginDocker = spawn("docker", [
      "login",
      registryServer,
      "-u", credential.username,
      "--password-stdin"
    ], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    loginDocker.stdin.write(credential.token);
    loginDocker.stdin.end();

    let loginStderr = "";

    loginDocker.stderr.on("data", (data) => {
      loginStderr += data.toString();
    });

    loginDocker.on("close", (loginCode) => {
      if (loginCode !== 0) {
        resolve({ 
          available: false, 
          error: `Docker login failed: ${loginStderr.trim()}`
        });
        return;
      }

      // Now test the manifest with auth
      const manifestDocker = spawn("docker", ["manifest", "inspect", fullImageName], {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let manifestStderr = "";

      manifestDocker.stderr.on("data", (data) => {
        manifestStderr += data.toString();
      });

      manifestDocker.on("close", (manifestCode) => {
        // Logout regardless of result
        spawn("docker", ["logout", registryServer], {
          stdio: ["ignore", "ignore", "ignore"]
        });

        if (manifestCode === 0) {
          resolve({ available: true });
        } else {
          resolve({ 
            available: false, 
            error: manifestStderr.trim() || `Docker manifest inspect failed with code ${manifestCode}`
          });
        }
      });

      // Set timeout for manifest check
      setTimeout(() => {
        manifestDocker.kill();
        spawn("docker", ["logout", registryServer], {
          stdio: ["ignore", "ignore", "ignore"]
        });
        resolve({ 
          available: false, 
          error: "Docker manifest inspect with auth timed out"
        });
      }, 30000);
    });

    // Set timeout for login
    setTimeout(() => {
      loginDocker.kill();
      resolve({ 
        available: false, 
        error: "Docker login timed out"
      });
    }, 30000);
  });
}

/**
 * Check if a credential is relevant for the given image URL
 */
function isCredentialRelevant(imageUrl: string, credential: IRegistryCredential): boolean {
  const lowerImageUrl = imageUrl.toLowerCase();
  
  switch (credential.registryType) {
    case "dockerhub":
      // Docker Hub images don't have a hostname or use docker.io
      return !lowerImageUrl.includes("/") || 
             lowerImageUrl.includes("docker.io") || 
             lowerImageUrl.includes("index.docker.io");
    
    case "github":
      return lowerImageUrl.includes("ghcr.io");
    
    case "gitlab":
      return lowerImageUrl.includes("registry.gitlab.com");
    
    case "other":
      // For custom registries, check if the credential name matches part of the URL
      return credential.name ? lowerImageUrl.includes(credential.name.toLowerCase()) : false;
    
    default:
      return false;
  }
}

/**
 * Get the registry server URL for docker login
 */
function getRegistryServer(credential: IRegistryCredential): string {
  switch (credential.registryType) {
    case "dockerhub":
      return "https://index.docker.io/v1/";
    
    case "github":
      return "ghcr.io";
    
    case "gitlab":
      return "registry.gitlab.com";
    
    case "other":
      return credential.name || "";
    
    default:
      return "";
  }
}
