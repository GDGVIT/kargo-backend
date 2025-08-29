function isValidUsername(username: string): boolean {
  // Kubernetes-compatible username validation
  // Must be lowercase alphanumeric with hyphens only
  // Must start and end with alphanumeric character
  // Maximum 63 characters (DNS label limit)
  const usernameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  return (
    typeof username === "string" &&
    username.trim().length > 0 &&
    username.trim().length <= 63 &&
    usernameRegex.test(username.trim())
  );
}

export default isValidUsername;
