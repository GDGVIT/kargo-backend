function isValidUsername(username: string): boolean {
  const usernameRegex = /^[A-Za-z0-9_-]+$/;
  return (
    typeof username === "string" &&
    username.trim().length > 0 &&
    usernameRegex.test(username)
  );
}

export default isValidUsername;
