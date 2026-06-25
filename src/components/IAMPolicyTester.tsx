import React, { useState, useEffect } from "react";
import { Key, ShieldAlert, ShieldCheck, HelpCircle, Lock, Info } from "lucide-react";
import { SimulationConfig } from "../types";

interface IAMPolicyTesterProps {
  config: SimulationConfig;
  onConfigChange: (newConfig: SimulationConfig) => void;
}

export const IAMPolicyTester: React.FC<IAMPolicyTesterProps> = ({ config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<"sn" | "service">("sn");

  // Represent policies as state strings so we can edit/show them
  const [snPolicy, setSnPolicy] = useState<string>(`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountAuthenticatedAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:root"
      },
      "Action": "vpc-lattice-svcs:Invoke",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "vpc-lattice-svcs:SourceVpc": "vpc-07a9b3662d"
        }
      }
    }
  ]
}`);

  const [paymentPolicy, setPaymentPolicy] = useState<string>(`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RestrictPaymentsToFinanceRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:role/FinanceServiceRole"
      },
      "Action": "vpc-lattice-svcs:Invoke",
      "Resource": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-payments",
      "Condition": {
        "StringEquals": {
          "vpc-lattice-svcs:RequestMethod": "POST"
        }
      }
    }
  ]
}`);

  // Evaluate the policies against the config
  const evaluateAccess = () => {
    // 1. Service Network level
    const isSigV4 = config.authType === "SigV4";
    const isExpired = config.authType === "ExpiredSigV4";
    
    if (isExpired) {
      return {
        decision: "DENY",
        reason: "Signature verification failed. The Signature V4 token has expired.",
        triggeredBy: "AWS Lattice Gateway Auth Layer"
      };
    }
    
    if (!isSigV4) {
      return {
        decision: "DENY",
        reason: "Request lacks authorization header. Service Network requires 'AWS_SIGV4' authentication globally.",
        triggeredBy: "Service Network policy"
      };
    }

    // 2. Service level - Orders allows general Root Account
    if (config.targetService === "orders") {
      return {
        decision: "ALLOW",
        reason: "Access permitted on standard path. Root root account of AWS 111111111111 mapped to allowed actions.",
        triggeredBy: "Orders Service Auth Policy"
      };
    }

    // 3. Service level - Payments restricts to FinanceServiceRole
    if (config.targetService === "payments") {
      if (config.sourceCaller !== "FinanceServiceRole") {
        return {
          decision: "DENY",
          reason: `Access Denied: The caller principal (${config.sourceCaller}) does not match the allowed FinanceServiceRole constraint.`,
          triggeredBy: "Payments Svc Policy (RestrictPaymentsToFinanceRole)"
        };
      }
      return {
        decision: "ALLOW",
        reason: "POST transaction successfully processed. Caller matches FinanceServiceRole criteria.",
        triggeredBy: "Payments Svc Policy"
      };
    }

    return { decision: "ALLOW", reason: "Cleared general policies.", triggeredBy: "Default Allow" };
  };

  const evaluationResult = evaluateAccess();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-neutral-800 rounded-none overflow-hidden shadow-lg">
      {/* Editor Header */}
      <div className="px-6 py-4.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Key className="w-4 h-4 text-neutral-400" />
          <h2 className="font-serif font-light text-base text-neutral-200">Zero-Trust IAM Policy Lab</h2>
        </div>
        <div className="flex bg-neutral-950 p-1 rounded-none border border-neutral-800">
          <button
            onClick={() => setActiveTab("sn")}
            className={`px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] rounded-none transition ${
              activeTab === "sn" ? "bg-white text-black font-semibold shadow" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Service Network Policy
          </button>
          <button
            onClick={() => setActiveTab("service")}
            className={`px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] rounded-none transition ${
              activeTab === "service" ? "bg-white text-black font-semibold shadow" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Payments Service Policy
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto font-sans">
        {/* Helper Note */}
        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-none flex items-start space-x-3">
          <Info className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-neutral-400 leading-relaxed font-sans">
            {activeTab === "sn" 
              ? "Serves as the global firewall. Blocks any request originating from outside specified Consumer VPCs or signed with generic non-account keys."
              : "Defines granular field-level roles. Restricted here so that payments can only be processed by FinanceServiceRole."}
          </p>
        </div>

        {/* JSON Display */}
        <div className="relative">
          <span className="absolute right-4 top-4 text-[9px] font-mono text-neutral-500 uppercase tracking-[0.2em] bg-neutral-900/90 px-2.5 py-0.5 border border-neutral-800">
            JSON Read-Only Active
          </span>
          <pre className="p-5 bg-[#050505] text-neutral-300 font-mono text-xs rounded-none overflow-x-auto border border-neutral-800 leading-relaxed max-h-[190px]">
            {activeTab === "sn" ? snPolicy : paymentPolicy}
          </pre>
        </div>

        {/* Configuration sliders/toggles */}
        <div className="bg-[#0c0c0c] p-5 border border-neutral-800 rounded-none space-y-4">
          <h3 className="text-[10px] uppercase font-bold text-neutral-400 tracking-[0.2em] font-mono">Simulate Caller Context</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-1.5">IAM Principle Role</label>
              <select
                value={config.sourceCaller}
                onChange={(e) => onConfigChange({ ...config, sourceCaller: e.target.value as any })}
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-none p-2.5 text-neutral-300 focus:outline-none focus:border-neutral-500 font-mono"
              >
                <option value="FinanceServiceRole">FinanceServiceRole (Acc-A)</option>
                <option value="AdminRole">AdminServiceRole (Acc-A)</option>
                <option value="AnonymousClient">Anonymous Caller (Acc-Y)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-1.5">AWS Signature V4 Auth</label>
              <select
                value={config.authType}
                onChange={(e) => onConfigChange({ ...config, authType: e.target.value as any })}
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-none p-2.5 text-neutral-300 focus:outline-none focus:border-neutral-500 font-mono"
              >
                <option value="SigV4">Generate Valid SigV4 Headers</option>
                <option value="ExpiredSigV4">Generate Expired Headers</option>
                <option value="None">Disable Authentication Header</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Checker Results banner */}
        <div className={`p-5 border rounded-none ${
          evaluationResult.decision === "ALLOW" 
            ? "bg-[#0b1410] border-emerald-950 text-emerald-300"
            : "bg-[#160c1c]/30 border-rose-950/40 text-rose-300"
        }`}>
          <div className="flex items-start space-x-3.5">
            {evaluationResult.decision === "ALLOW" ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <div className="flex items-center space-x-3">
                <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-none ${
                  evaluationResult.decision === "ALLOW" ? "bg-[#0b2416] border border-emerald-800/40 text-emerald-400" : "bg-[#291114] border border-rose-800/40 text-rose-400"
                }`}>
                  POLICY {evaluationResult.decision}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono lowercase italic">
                  Rule Origin: {evaluationResult.triggeredBy}
                </span>
              </div>
              <p className="text-xs mt-2.5 leading-relaxed text-neutral-300 font-sans">
                {evaluationResult.reason}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
