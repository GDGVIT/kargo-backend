import fs from "fs";
import path from "path";

export type LogType = "success" | "error" | "info" | "warning";

interface LogOptions {
  type: LogType;
  message: string;
  meta?: any;
}

let logStream: fs.WriteStream | null = null;
const logsDir = path.resolve(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = path.join(logsDir, `server-${timestamp}.log`);
logStream = fs.createWriteStream(logFilePath, { flags: "a" });

export function log({ type, message, meta }: LogOptions) {
  const colorMap: Record<LogType, string> = {
    success: "\x1b[32m", // green
    error: "\x1b[31m", // red
    info: "\x1b[36m", // cyan
    warning: "\x1b[33m", // yellow
  };
  const reset = "\x1b[0m";
  const prefix = `[${type.toUpperCase()}]`;
  const time = new Date().toISOString();
  const logMsg = `${colorMap[type]}${prefix}${reset} ${message}`;
  const logLine = `${time} ${prefix} ${message}${
    meta ? ` | meta: ${JSON.stringify(meta, null, 2)}` : ""
  }`;
  if (type === "error") {
    console.error(logMsg, meta || "");
  } else if (type === "warning") {
    console.warn(logMsg, meta || "");
  } else {
    console.log(logMsg, meta || "");
  }
  if (logStream) {
    logStream.write(logLine + "\n");
  }
}

export function formatNotification(message: string, type: LogType = "info") {
  return { message, type };
}
