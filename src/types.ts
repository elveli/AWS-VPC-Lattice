export interface TerraformFile {
  name: string;
  code: string;
  description: string;
  highlights: { line: number; concept: string; text: string }[];
}

export interface CliCommand {
  command: string;
  description: string;
  category: "discovery" | "lifecycle" | "routing" | "iam";
  args: { [key: string]: string };
  output: string | object;
}

export interface SimulationConfig {
  sourceVpc: "consumer";
  sourceCaller: "FinanceServiceRole" | "AdminRole" | "AnonymousClient";
  targetService: "orders" | "payments";
  targetPath: "/orders" | "/v2/orders" | "/payments/charge" | "/payments/refund";
  authType: "SigV4" | "None" | "ExpiredSigV4";
  weightSplit: number; // e.g. 90/10 for Orders
}

export interface LogEntry {
  timestamp: string;
  id: string;
  clientIp: string;
  method: "GET" | "POST";
  path: string;
  sourceAccount: string;
  sourceVpc: string;
  targetService: string;
  targetGroup: string;
  authType: string;
  authDecision: "Allow" | "Deny (No Auth)" | "Deny (Policy Match Fail)" | "Deny (Signature Expired)";
  statusCode: number;
  latencyMs: number;
}
