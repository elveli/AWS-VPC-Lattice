import React, { useEffect, useState } from "react";
import { Play, Settings2, RefreshCw, CheckCircle2, AlertOctagon } from "lucide-react";
import { SimulationConfig, LogEntry } from "../types";

interface NetworkTopologyProps {
  config: SimulationConfig;
  onSimulationComplete: (log: LogEntry | LogEntry[]) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  isAutoTrafficActive: boolean;
  setIsAutoTrafficActive: (active: boolean) => void;
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  config,
  onSimulationComplete,
  isRunning,
  setIsRunning,
  isAutoTrafficActive,
  setIsAutoTrafficActive
}) => {
  const [step, setStep] = useState<number>(0); // 0: Idle, 1: Outbound intercept, 2: Auth Check SN, 3: Auth Check Service, 4: Routing, 5: Delivered, -1: Failed
  const [packetPos, setPacketPos] = useState({ x: 100, y: 140 });
  const [outcomeMessage, setOutcomeMessage] = useState<string>("");
  const [routedTarget, setRoutedTarget] = useState<string>("");

  // Define node coordinates
  const nodes = {
    client: { x: 100, y: 140, label: "Client Instance" },
    latticeEndpoint: { x: 220, y: 140, label: "Lattice Endpoint" },
    serviceNetwork: { x: 380, y: 220, label: "Prod Service Network" },
    ordersService: { x: 560, y: 110, label: "Orders Service" },
    paymentsService: { x: 560, y: 310, label: "Payments Service" },
    ordersV1: { x: 740, y: 60, label: "Orders TG v1 (90%)" },
    ordersV2: { x: 740, y: 160, label: "Orders TG v2 (10%)" },
    paymentsV1: { x: 740, y: 310, label: "Payments TG (Fargate)" }
  };

  useEffect(() => {
    if (!isRunning) {
      setStep(0);
      setPacketPos({ x: nodes.client.x, y: nodes.client.y });
      setOutcomeMessage("");
      setRoutedTarget("");
      return;
    }

    // Step 0 -> Step 1: Outbound intercept by link-local range
    setStep(1);
    setOutcomeMessage("Request initiated... intercepting traffic via local range 169.254.171.1");
    
    // Animate to Lattice Endpoint
    const t1 = setTimeout(() => {
      setStep(2);
      setPacketPos({ x: nodes.latticeEndpoint.x, y: nodes.latticeEndpoint.y });
      setOutcomeMessage("Forwarding to central Service Network (222222222222) via AWS RAM link...");

      // Step 2 -> Step 3: Service Network Auth policy checks
      const t2 = setTimeout(() => {
        setPacketPos({ x: nodes.serviceNetwork.x, y: nodes.serviceNetwork.y });
        
        // Evaluate Service Network general policy
        const isSigV4 = config.authType === "SigV4";
        const isExpired = config.authType === "ExpiredSigV4";
        
        if (isExpired) {
          setStep(-1);
          setOutcomeMessage("Blocked: AWS Signature V4 signature expired or corrupted!");
          triggerComplete(true, "Deny (Signature Expired)", 403);
          return;
        }

        if (!isSigV4) {
          setStep(-1);
          setOutcomeMessage("Blocked by Service Network: AWS_SIGV4 Auth required!");
          triggerComplete(true, "Deny (No Auth)", 403);
          return;
        }

        setStep(3);
        setOutcomeMessage("Service Network Auth: PASSED (Signed by Account 111111111111)");

        // Step 3 -> Step 4: Evaluate Specific Service Auth policy
        const t3 = setTimeout(() => {
          if (config.targetService === "payments") {
            setPacketPos({ x: nodes.paymentsService.x, y: nodes.paymentsService.y });
            
            // Payments service is locked to FinanceServiceRole
            if (config.sourceCaller !== "FinanceServiceRole") {
              setStep(-1);
              setOutcomeMessage("Blocked by Payment Service Policy: Requires 'FinanceServiceRole'!");
              triggerComplete(true, "Deny (Policy Match Fail)", 403);
              return;
            }
          } else {
            setPacketPos({ x: nodes.ordersService.x, y: nodes.ordersService.y });
          }

          setStep(4);
          setOutcomeMessage("Service Boundary Auth: PASSED! Evaluating Listener matching rules...");

          // Step 4 -> Step 5: Deliver to Target
          const t4 = setTimeout(() => {
            let nextX = 0;
            let nextY = 0;
            let finalTargetLabel = "";

            if (config.targetService === "payments") {
              nextX = nodes.paymentsV1.x;
              nextY = nodes.paymentsV1.y;
              finalTargetLabel = "Payments TG v1 (Container Cluster)";
            } else {
              // Orders routes based on path rule or weights
              if (config.targetPath === "/v2/orders") {
                nextX = nodes.ordersV2.x;
                nextY = nodes.ordersV2.y;
                finalTargetLabel = "Orders Serverless TG v2 (Lambda)";
              } else {
                // Default weighted route: 90% chance v1, 10% v2
                const roll = Math.random() * 100;
                if (roll <= config.weightSplit) {
                  nextX = nodes.ordersV1.x;
                  nextY = nodes.ordersV1.y;
                  finalTargetLabel = "Orders Container TG v1 (ECS/ALB)";
                } else {
                  nextX = nodes.ordersV2.x;
                  nextY = nodes.ordersV2.y;
                  finalTargetLabel = "Orders Serverless TG v2 (Lambda)";
                }
              }
            }

            setStep(5);
            setPacketPos({ x: nextX, y: nextY });
            setRoutedTarget(finalTargetLabel);
            setOutcomeMessage(`Request Successfully Completed (200 OK)! Routed to: ${finalTargetLabel}`);
            triggerComplete(false, "Allow", 200, finalTargetLabel);

          }, 1200);
        }, 1200);
      }, 1200);
    }, 1000);

    return () => {
      clearTimeout(t1);
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isAutoTrafficActive) return;

    const interval = setInterval(() => {
      const concurrentBatchSize = 4;
      const batchLogs: LogEntry[] = [];

      for (let i = 0; i < concurrentBatchSize; i++) {
        const reqId = "REQ-AUTO-" + Math.random().toString(36).substr(2, 6).toUpperCase();
        const mockLatency = Math.floor(Math.random() * 50) + 12;
        
        const isSigV4 = config.authType === "SigV4";
        const isExpired = config.authType === "ExpiredSigV4";
        
        let decision: LogEntry["authDecision"] = "Allow";
        let status = 200;
        let finalTargetLabel = "N/A";

        if (isExpired) {
          decision = "Deny (Signature Expired)";
          status = 403;
        } else if (!isSigV4) {
          decision = "Deny (No Auth)";
          status = 403;
        } else {
          if (config.targetService === "payments") {
            if (config.sourceCaller !== "FinanceServiceRole") {
              decision = "Deny (Policy Match Fail)";
              status = 403;
            } else {
              decision = "Allow";
              status = 200;
              finalTargetLabel = "Payments TG v1 (Container Cluster)";
            }
          } else {
            decision = "Allow";
            status = 200;
            if (config.targetPath === "/v2/orders") {
              finalTargetLabel = "Orders Serverless TG v2 (Lambda)";
            } else {
              const roll = Math.random() * 100;
              if (roll <= config.weightSplit) {
                finalTargetLabel = "Orders Container TG v1 (ECS/ALB)";
              } else {
                finalTargetLabel = "Orders Serverless TG v2 (Lambda)";
              }
            }
          }
        }

        const log: LogEntry = {
          timestamp: new Date().toISOString(),
          id: reqId,
          clientIp: `10.100.1.${Math.floor(Math.random() * 200) + 15}`,
          method: config.targetPath.startsWith("/payments") || config.targetPath === "/v2/orders" ? "POST" : "GET",
          path: config.targetPath,
          sourceAccount: "111111111111",
          sourceVpc: "vpc-07a9b3662d",
          targetService: config.targetService === "orders" ? "orders-service" : "payments-service",
          targetGroup: finalTargetLabel,
          authType: config.authType,
          authDecision: decision,
          statusCode: status,
          latencyMs: mockLatency
        };
        batchLogs.push(log);
      }

      onSimulationComplete(batchLogs);
    }, 1500);

    return () => {
      clearInterval(interval);
    };
  }, [isAutoTrafficActive, config, onSimulationComplete]);

  const triggerComplete = (failed: boolean, decision: LogEntry["authDecision"], status: number, targetGroupLabel = "N/A") => {
    setIsRunning(false);
    const mockLatency = failed ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 80) + 12;
    const log: LogEntry = {
      timestamp: new Date().toISOString(),
      id: "req-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      clientIp: "10.100.1.45",
      method: config.targetPath.startsWith("/payments") || config.targetPath === "/v2/orders" ? "POST" : "GET",
      path: config.targetPath,
      sourceAccount: "111111111111",
      sourceVpc: "vpc-07a9b3662d",
      targetService: config.targetService === "orders" ? "orders-service" : "payments-service",
      targetGroup: targetGroupLabel,
      authType: config.authType,
      authDecision: decision,
      statusCode: status,
      latencyMs: mockLatency
    };
    onSimulationComplete(log);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-neutral-805 rounded-none overflow-hidden shadow-2xl">
      {/* Simulation Banner */}
      <div className="flex items-center justify-between px-6 py-4.5 bg-neutral-900/60 border-b border-neutral-800">
        <div className="flex items-center space-x-2.5">
          <Settings2 className="w-4 h-4 text-neutral-400" />
          <h2 className="font-serif font-light text-base text-neutral-200">Lattice Multi-VPC Traffic Flow</h2>
        </div>
        <div className="flex items-center space-x-2">
          {isRunning || isAutoTrafficActive ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-700"></span>
          )}
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            {isAutoTrafficActive ? "Autoflow Active" : isRunning ? "Engine Active" : "Engine Idle"}
          </span>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative flex-1 bg-[#060606] p-6 overflow-x-auto min-h-[380px]">
        {/* Helper overlays */}
        <div className="absolute top-3 left-6 text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          AWS ACCOUNT A (Consumer: 111111111111)
        </div>
        <div className="absolute top-3 right-6 text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          AWS ACCOUNT B (Provider: 222222222222)
        </div>

        <svg width="860" height="380" viewBox="0 0 860 380" className="w-full h-full min-w-[800px] select-none font-sans">
          {/* Account Container Boundaries */}
          <rect x="10" y="25" width="280" height="340" fill="none" stroke="#222" strokeDasharray="3 3" />
          <rect x="310" y="25" width="540" height="340" fill="none" stroke="#222" strokeDasharray="3 3" />

          {/* VPC 1 inside Account A */}
          <rect x="25" y="45" width="250" height="150" fill="#0c0c0c" stroke="#2a2a2a" strokeWidth="1" />
          <text x="35" y="65" fill="#777" fontSize="9" fontWeight="bold" fontFamily="monospace" letterSpacing="1">CONSUMER VPC (10.100.0.0/16)</text>

          {/* Service Network Container (Shared across accounts) */}
          <rect x="325" y="155" width="110" height="130" fill="#080808" stroke="#efefef" strokeWidth="1.5" strokeDasharray="5 2" />
          <text x="331" y="150" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="monospace" letterSpacing="0.5">SHARED via RAM</text>

          {/* VPC 2 Orders inside Account B */}
          <rect x="460" y="35" width="380" height="150" fill="#0c0c0c" stroke="#2a2a2a" />
          <text x="470" y="52" fill="#777" fontSize="9" fontWeight="bold" fontFamily="monospace" letterSpacing="1">ORDER VPC (10.200.0.0/16)</text>

          {/* VPC 3 Payments inside Account B */}
          <rect x="460" y="220" width="380" height="130" fill="#0c0c0c" stroke="#2a2a2a" />
          <text x="470" y="238" fill="#777" fontSize="9" fontWeight="bold" fontFamily="monospace" letterSpacing="1">PAYMENT VPC (10.250.0.0/16)</text>

          {/* Connection Lines (Links between components) */}
          <line x1={nodes.client.x} y1={nodes.client.y} x2={nodes.latticeEndpoint.x} y2={nodes.latticeEndpoint.y} stroke="#444" strokeWidth="1.5" />
          {isAutoTrafficActive && (
            <line 
              x1={nodes.client.x} y1={nodes.client.y} 
              x2={nodes.latticeEndpoint.x} y2={nodes.latticeEndpoint.y} 
              stroke={config.authType === "SigV4" ? "#10b981" : "#f43f5e"} 
              strokeWidth="2.5" 
              strokeDasharray="6 6"
            >
              <animate attributeName="stroke-dashoffset" values="30;0" dur="1s" repeatCount="indefinite" />
            </line>
          )}
          
          <path d="M 220 140 Q 280 140 280 200 T 380 220" fill="none" stroke="#666" strokeWidth="1.5" strokeDasharray="2 2" />
          {isAutoTrafficActive && (
            <path 
              d="M 220 140 Q 280 140 280 200 T 380 220" 
              fill="none" 
              stroke={config.authType === "SigV4" ? "#10b981" : "#f43f5e"} 
              strokeWidth="2" 
              strokeDasharray="6 6"
            >
              <animate attributeName="stroke-dashoffset" values="30;0" dur="1.2s" repeatCount="indefinite" />
            </path>
          )}

          <path d="M 380 220 Q 450 220 450 140 T 560 110" fill="none" stroke="#999" strokeWidth="1.5" />
          {isAutoTrafficActive && config.authType === "SigV4" && config.targetService === "orders" && (
            <path 
              d="M 380 220 Q 450 220 450 140 T 560 110" 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="2" 
              strokeDasharray="6 6"
            >
              <animate attributeName="stroke-dashoffset" values="30;0" dur="1.5s" repeatCount="indefinite" />
            </path>
          )}

          <path d="M 380 220 Q 450 220 450 280 T 560 310" fill="none" stroke="#999" strokeWidth="1.5" />
          {isAutoTrafficActive && config.authType === "SigV4" && config.targetService === "payments" && (
            <path 
              d="M 380 220 Q 450 220 450 280 T 560 310" 
              fill="none" 
              stroke={config.sourceCaller === "FinanceServiceRole" ? "#10b981" : "#f43f5e"} 
              strokeWidth="2" 
              strokeDasharray="6 6"
            >
              <animate attributeName="stroke-dashoffset" values="30;0" dur="1.5s" repeatCount="indefinite" />
            </path>
          )}

          <line x1={nodes.ordersService.x} y1={nodes.ordersService.y} x2={nodes.ordersV1.x} y2={nodes.ordersV1.y} stroke="#333" strokeWidth="1.5" />
          {isAutoTrafficActive && config.authType === "SigV4" && config.targetService === "orders" && config.targetPath === "/orders" && config.weightSplit > 0 && (
            <line 
              x1={nodes.ordersService.x} y1={nodes.ordersService.y} 
              x2={nodes.ordersV1.x} y2={nodes.ordersV1.y} 
              stroke="#10b981" 
              strokeWidth="2" 
              strokeDasharray="4 4"
            >
              <animate attributeName="stroke-dashoffset" values="20;0" dur="1.8s" repeatCount="indefinite" />
            </line>
          )}

          <line x1={nodes.ordersService.x} y1={nodes.ordersService.y} x2={nodes.ordersV2.x} y2={nodes.ordersV2.y} stroke="#333" strokeWidth="1.5" />
          {isAutoTrafficActive && config.authType === "SigV4" && config.targetService === "orders" && (config.targetPath === "/v2/orders" || config.weightSplit < 100) && (
            <line 
              x1={nodes.ordersService.x} y1={nodes.ordersService.y} 
              x2={nodes.ordersV2.x} y2={nodes.ordersV2.y} 
              stroke="#eab308" 
              strokeWidth="2" 
              strokeDasharray="4 4"
            >
              <animate attributeName="stroke-dashoffset" values="20;0" dur="1.8s" repeatCount="indefinite" />
            </line>
          )}

          <line x1={nodes.paymentsService.x} y1={nodes.paymentsService.y} x2={nodes.paymentsV1.x} y2={nodes.paymentsV1.y} stroke="#333" strokeWidth="1.5" />
          {isAutoTrafficActive && config.authType === "SigV4" && config.targetService === "payments" && config.sourceCaller === "FinanceServiceRole" && (
            <line 
              x1={nodes.paymentsService.x} y1={nodes.paymentsService.y} 
              x2={nodes.paymentsV1.x} y2={nodes.paymentsV1.y} 
              stroke="#10b981" 
              strokeWidth="2" 
              strokeDasharray="4 4"
            >
              <animate attributeName="stroke-dashoffset" values="20;0" dur="1.8s" repeatCount="indefinite" />
            </line>
          )}

          {/* Draw Interactive Static Nodes */}
          {/* Client node */}
          <rect x={nodes.client.x - 22} y={nodes.client.y - 20} width="44" height="40" fill="#161616" stroke="#444" strokeWidth="1" />
          <text x={nodes.client.x} y={nodes.client.y + 4} fill="#e5e5e5" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">EC2</text>
          <text x={nodes.client.x} y={nodes.client.y + 36} fill="#a3a3a3" fontSize="9.5" textAnchor="middle">Client Instance</text>

          {/* Lattice Link-local endpoint intercepter */}
          <rect x={nodes.latticeEndpoint.x - 24} y={nodes.latticeEndpoint.y - 14} width="48" height="28" fill="#1c1c1c" stroke="#a3a3a3" strokeWidth="1.2" />
          <text x={nodes.latticeEndpoint.x} y={nodes.latticeEndpoint.y + 3} fill="#ffffff" fontSize="8" textAnchor="middle" fontFamily="monospace">169.254.</text>
          <text x={nodes.latticeEndpoint.x} y={nodes.latticeEndpoint.y + 26} fill="#737373" fontSize="9" textAnchor="middle">Link-Local</text>

          {/* Service Network node */}
          <rect x={nodes.serviceNetwork.x - 30} y={nodes.serviceNetwork.y - 30} width="60" height="60" fill="#0f0f0f" stroke="#e5e5e5" strokeWidth="2" />
          <text x={nodes.serviceNetwork.x} y={nodes.serviceNetwork.y + 4} fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">LATTICE</text>
          <text x={nodes.serviceNetwork.x} y={nodes.serviceNetwork.y + 42} fill="#ffffff" fontSize="9.5" fontWeight="bold" textAnchor="middle">Service Mesh</text>

          {/* Service A node (Orders) */}
          <rect x={nodes.ordersService.x - 22} y={nodes.ordersService.y - 22} width="44" height="44" fill="#0a0a0a" stroke="#d4d4d4" strokeWidth="1.5" />
          <text x={nodes.ordersService.x} y={nodes.ordersService.y + 4} fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">ORDERS</text>
          <text x={nodes.ordersService.x} y={nodes.ordersService.y + 34} fill="#a3a3a3" fontSize="9.5" textAnchor="middle">Orders Svc</text>

          {/* Service B node (Payments) */}
          <rect x={nodes.paymentsService.x - 22} y={nodes.paymentsService.y - 22} width="44" height="44" fill="#0a0a0a" stroke="#d4d4d4" strokeWidth="1.5" />
          <text x={nodes.paymentsService.x} y={nodes.paymentsService.y + 4} fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">PAYMENT</text>
          <text x={nodes.paymentsService.x} y={nodes.paymentsService.y + 34} fill="#a3a3a3" fontSize="9.5" textAnchor="middle">Payments Svc</text>

          {/* Targets: Orders Target Group v1 - Fargate pods */}
          <rect x={nodes.ordersV1.x - 12} y={nodes.ordersV1.y - 12} width="24" height="24" fill="#111" stroke="#555" strokeWidth="1.5" />
          <text x={nodes.ordersV1.x} y={nodes.ordersV1.y + 4} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">IP</text>
          <text x={nodes.ordersV1.x + 18} y={nodes.ordersV1.y + 4} fill="#a3a3a3" fontSize="9" textAnchor="start">ECS Container (v1)</text>

          {/* Targets: Orders Target Group v2 - Lambdas */}
          <rect x={nodes.ordersV2.x - 12} y={nodes.ordersV2.y - 12} width="24" height="24" fill="#111" stroke="#eab308" strokeWidth="1.2" />
          <text x={nodes.ordersV2.x} y={nodes.ordersV2.y + 4} fill="#eab308" fontSize="9.5" textAnchor="middle" fontFamily="monospace">λ</text>
          <text x={nodes.ordersV2.x + 18} y={nodes.ordersV2.y + 4} fill="#a3a3a3" fontSize="9" textAnchor="start">Lambda Fn (v2)</text>

          {/* Targets: Payments Target Group v1 - Fargate */}
          <rect x={nodes.paymentsV1.x - 12} y={nodes.paymentsV1.y - 12} width="24" height="24" fill="#111" stroke="#555" strokeWidth="1.5" />
          <text x={nodes.paymentsV1.x} y={nodes.paymentsV1.y + 4} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">IP</text>
          <text x={nodes.paymentsV1.x + 18} y={nodes.paymentsV1.y + 4} fill="#a3a3a3" fontSize="9" textAnchor="start">ECS Cluster (v1)</text>

          {/* Packet Flow Animation Circle overlay */}
          {isRunning && (
            <rect
              x={packetPos.x - 5}
              y={packetPos.y - 5}
              width="10"
              height="10"
              fill={step === -1 ? "#f43f5e" : "#ffffff"}
              className="transition-all duration-1000 ease-in-out shadow-lg"
            >
              <animate attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite" />
            </rect>
          )}

          {/* Static state markers based on steps */}
          <g transform={`translate(${nodes.serviceNetwork.x + 16}, ${nodes.serviceNetwork.y - 34})`}>
            {step === -1 ? (
              <rect x="-4" y="-4" width="8" height="8" fill="#f43f5e" />
            ) : step >= 3 ? (
              <rect x="-4" y="-4" width="8" height="8" fill="#10b981" />
            ) : (
              <rect x="-4" y="-4" width="8" height="8" fill="#444" />
            )}
          </g>
        </svg>
      </div>

      {/* Output / Diagnostics Box */}
      <div className="p-5 bg-neutral-950 border-t border-neutral-800">
        <div className="flex items-start space-x-3.5">
          {step === -1 ? (
            <div className="p-2.5 bg-rose-950/20 text-rose-400 border border-rose-900/45">
              <AlertOctagon className="w-4 h-4 animate-pulse" />
            </div>
          ) : step === 5 ? (
            <div className="p-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/45">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-2.5 bg-neutral-900 text-neutral-400 border border-neutral-800">
              <RefreshCw className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
            </div>
          )}

          <div className="flex-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold block mb-1 font-mono">
              Simulation Console Output
            </span>
            <p className={`text-xs font-mono leading-relaxed tracking-wide ${
              isAutoTrafficActive ? "text-emerald-400" : (step === -1 ? "text-rose-400" : step === 5 ? "text-emerald-400" : "text-neutral-300")
            }`}>
              {isAutoTrafficActive 
                ? `Autoflow active! Simulating real-time concurrent requests to ${config.targetService === "orders" ? "orders.corp.internal" : "payments.corp.internal"}${config.targetPath}. Adjust parameters to see load distribution or IAM policies apply instantly.`
                : (outcomeMessage || "Ready to execute transaction simulation. Adjust policy parameters in sidebar and click Send Traffic above.")}
            </p>
            {routedTarget && step === 5 && (
              <div className="mt-2.5 text-[10px] text-neutral-400 flex items-center space-x-2 font-mono">
                <span className="px-1.5 py-0.5 bg-neutral-900 text-neutral-300 border border-neutral-800 uppercase tracking-widest text-[9px]">
                  Resolved Destination
                </span>
                <span>{routedTarget}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
