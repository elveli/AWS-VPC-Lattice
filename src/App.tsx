import { useState } from "react";
import { 
  Network, 
  Terminal, 
  FileCode, 
  BookOpen, 
  Activity, 
  Send, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight,
  Database,
  ArrowRight,
  Shield,
  ExternalLink
} from "lucide-react";
import { SimulationConfig, LogEntry } from "./types";
import { NetworkTopology } from "./components/NetworkTopology";
import { IAMPolicyTester } from "./components/IAMPolicyTester";
import { CLITerminal } from "./components/CLITerminal";
import { TerraformViewer } from "./components/TerraformViewer";

export default function App() {
  const [activeTab, setActiveTab] = useState<"visualizer" | "policy" | "terraform" | "cli">("visualizer");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAutoTrafficActive, setIsAutoTrafficActive] = useState<boolean>(false);

  // Configuration State for Simulation
  const [config, setConfig] = useState<SimulationConfig>({
    sourceVpc: "consumer",
    sourceCaller: "FinanceServiceRole",
    targetService: "orders",
    targetPath: "/orders",
    authType: "SigV4",
    weightSplit: 90 // 90% orders-v1, 10% lambda-v2
  });

  // Log Trace state from triggered traffic
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      timestamp: new Date(Date.now() - 300000).toISOString(),
      id: "REQ-D8X92M1A",
      clientIp: "10.100.1.45",
      method: "GET",
      path: "/orders",
      sourceAccount: "111111111111",
      sourceVpc: "vpc-07a9b3662d",
      targetService: "orders-service",
      targetGroup: "Orders TG v1 (Containers)",
      authType: "SigV4",
      authDecision: "Allow",
      statusCode: 200,
      latencyMs: 34
    }
  ]);

  const handleSimulationComplete = (newLog: LogEntry | LogEntry[]) => {
    if (Array.isArray(newLog)) {
      setLogs(prev => [...newLog, ...prev]);
    } else {
      setLogs(prev => [newLog, ...prev]);
    }
  };

  // Helper presets for easy training
  const applyPreset = (presetName: string) => {
    setIsRunning(false);
    switch (presetName) {
      case "orders-v1":
        setConfig({
          sourceVpc: "consumer",
          sourceCaller: "AdminRole",
          targetService: "orders",
          targetPath: "/orders",
          authType: "SigV4",
          weightSplit: 90
        });
        break;
      case "orders-v2-lambda":
        setConfig({
          sourceVpc: "consumer",
          sourceCaller: "AdminRole",
          targetService: "orders",
          targetPath: "/v2/orders",
          authType: "SigV4",
          weightSplit: 90
        });
        break;
      case "payments-authorized":
        setConfig({
          sourceVpc: "consumer",
          sourceCaller: "FinanceServiceRole",
          targetService: "payments",
          targetPath: "/payments/charge",
          authType: "SigV4",
          weightSplit: 0
        });
        break;
      case "payments-unauthorized":
        setConfig({
          sourceVpc: "consumer",
          sourceCaller: "AdminRole",
          targetService: "payments",
          targetPath: "/payments/charge",
          authType: "SigV4",
          weightSplit: 0
        });
        break;
      case "no-auth-block":
        setConfig({
          sourceVpc: "consumer",
          sourceCaller: "AnonymousClient",
          targetService: "orders",
          targetPath: "/orders",
          authType: "None",
          weightSplit: 90
        });
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#e0e0e0] font-sans flex flex-col selection:bg-neutral-800 selection:text-white">
      {/* Editorial Header */}
      <header className="border-b border-neutral-800 bg-[#0a0a0a] px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <span className="p-1 px-2.5 bg-neutral-900 text-neutral-400 font-mono text-[9px] uppercase tracking-[0.25em] border border-neutral-800 rounded-none">
              v1.4.0 • system mesh
            </span>
            <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-neutral-500 font-mono">
              Inter-Account Microservice Mesh
            </span>
          </div>
          <h1 className="text-2xl md:text-[2.2rem] font-serif font-light tracking-tight text-white mt-1 leading-none">
            AWS VPC Lattice <span className="italic font-normal font-serif text-neutral-400">Showcase Portal</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-2 max-w-3xl leading-relaxed font-sans">
            Learn and test AWS VPC Lattice configurations: multi-VPC sharing (Resource Access Manager), zero-trust IAM policies (SigV4 validation), and path-routing priorities mapped entirely with production-ready Terraform.
          </p>
        </div>

        {/* Global Metadata Tracker */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-[#0c0c0c] p-4 rounded-none border border-neutral-800">
          <div className="flex items-center space-x-2 border-r border-neutral-800 pr-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Mesh:</span>
            <span className="text-emerald-400 font-bold tracking-wider">ONLINE</span>
          </div>
          <div className="flex items-center space-x-2 border-r border-neutral-800 pr-4">
            <Clock className="w-3.5 h-3.5 text-neutral-600" />
            <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Lattice:</span>
            <span className="text-neutral-300">169.254.171.0/24</span>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-neutral-300 text-[11px]">SigV4 Enforce</span>
          </div>
        </div>
      </header>

      {/* Primary Tab Navigation Row */}
      <div className="bg-[#0c0c0c] border-b border-neutral-800 px-8 py-0 flex flex-wrap items-center">
        <button
          onClick={() => setActiveTab("visualizer")}
          className={`flex items-center space-x-2.5 px-6 py-4.5 text-xs uppercase tracking-[0.2em] font-medium transition-all relative ${
            activeTab === "visualizer"
              ? "text-white border-b-2 border-white font-semibold bg-neutral-900/40"
              : "text-neutral-500 hover:text-neutral-200"
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Topology Simulation</span>
        </button>

        <button
          onClick={() => setActiveTab("policy")}
          className={`flex items-center space-x-2.5 px-6 py-4.5 text-xs uppercase tracking-[0.2em] font-medium transition-all relative ${
            activeTab === "policy"
              ? "text-white border-b-2 border-white font-semibold bg-neutral-900/40"
              : "text-neutral-500 hover:text-neutral-200"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>IAM Policy Lab</span>
        </button>

        <button
          onClick={() => setActiveTab("terraform")}
          className={`flex items-center space-x-2.5 px-6 py-4.5 text-xs uppercase tracking-[0.2em] font-medium transition-all relative ${
            activeTab === "terraform"
              ? "text-white border-b-2 border-white font-semibold bg-neutral-900/40"
              : "text-neutral-500 hover:text-neutral-200"
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Terraform Blueprints</span>
        </button>

        <button
          onClick={() => setActiveTab("cli")}
          className={`flex items-center space-x-2.5 px-6 py-4.5 text-xs uppercase tracking-[0.2em] font-medium transition-all relative ${
            activeTab === "cli"
              ? "text-white border-b-2 border-white font-semibold bg-neutral-900/40"
              : "text-neutral-500 hover:text-neutral-200"
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>AWSCLI Playbook</span>
        </button>
      </div>

      {/* Main Workspace Frame */}
      <main className="flex-1 p-8 grid grid-cols-1 gap-8 max-w-7xl w-full mx-auto overflow-hidden">
        {/* TAB 1: VISUALIZER / TOPOLOGY SIMULATOR */}
        {activeTab === "visualizer" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Left Column: Parameter controls */}
            <div className="xl:col-span-4 space-y-8">
              {/* Presets List */}
              <div className="bg-[#0a0a0a] border border-neutral-800 p-6 rounded-none space-y-4">
                <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-[0.2em] font-mono flex items-center space-x-2">
                    <span className="h-1.5 w-1.5 bg-neutral-400 animate-pulse rounded-full"></span>
                    <span>Quick Presets</span>
                  </span>
                  <span className="text-[9px] font-mono text-neutral-600 uppercase">Interactive</span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => applyPreset("orders-v1")}
                    className="w-full text-left p-3 bg-neutral-950 border border-neutral-800 rounded-none hover:border-neutral-500 hover:bg-neutral-900 transition flex items-center justify-between text-xs font-mono group"
                  >
                    <span>1. Basic Orders (ALB Target Group)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-200 transition" />
                  </button>

                  <button
                    onClick={() => applyPreset("orders-v2-lambda")}
                    className="w-full text-left p-3 bg-neutral-950 border border-neutral-800 rounded-none hover:border-neutral-500 hover:bg-neutral-900 transition flex items-center justify-between text-xs font-mono group"
                  >
                    <span>2. /v2 Path Routing Rule (Lambda)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-200 transition" />
                  </button>

                  <button
                    onClick={() => applyPreset("payments-authorized")}
                    className="w-full text-left p-3 bg-neutral-950 border border-neutral-800 rounded-none hover:border-neutral-500 hover:bg-neutral-900 transition flex items-center justify-between text-xs font-mono group"
                  >
                    <span>3. Secured Payments (Authorized Role)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-200 transition" />
                  </button>

                  <button
                    onClick={() => applyPreset("payments-unauthorized")}
                    className="w-full text-left p-3 bg-[#0f0b08] border border-amber-950/40 rounded-none hover:border-amber-700/80 transition flex items-center justify-between text-xs font-mono group"
                  >
                    <span className="text-amber-300">4. Payments Block (Admin Role Error)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500/60 group-hover:text-amber-400 transition" />
                  </button>

                  <button
                    onClick={() => applyPreset("no-auth-block")}
                    className="w-full text-left p-3 bg-[#110808] border border-red-950/40 rounded-none hover:border-red-700/80 transition flex items-center justify-between text-xs font-mono group"
                  >
                    <span className="text-red-400">5. Anonymous Drop (No Auth Header)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-red-500/60 group-hover:text-red-400 transition" />
                  </button>
                </div>
              </div>

              {/* Advanced Parameter sliders */}
              <div className="bg-[#0a0a0a] border border-neutral-800 p-6 rounded-none space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-[0.2em] font-mono flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Transaction Parameters</span>
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-mono">Target Service</label>
                    <select
                      value={config.targetService}
                      onChange={(e) => {
                        const val = e.target.value as "orders" | "payments";
                        setConfig({
                          ...config,
                          targetService: val,
                          targetPath: val === "orders" ? "/orders" : "/payments/charge"
                        });
                      }}
                      className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-none p-2.5 text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                    >
                      <option value="orders">Orders Service (dns: orders.corp.internal)</option>
                      <option value="payments">Payments Service (dns: payments.corp.internal)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-mono">URI / Relative Path</label>
                    <select
                      value={config.targetPath}
                      onChange={(e) => setConfig({ ...config, targetPath: e.target.value as any })}
                      className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-none p-2.5 text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                    >
                      {config.targetService === "orders" ? (
                        <>
                          <option value="/orders">/orders (Canary Default Action)</option>
                          <option value="/v2/orders">/v2/orders (Path Specific Priority Rules)</option>
                        </>
                      ) : (
                        <>
                          <option value="/payments/charge">/payments/charge (POST Action Required)</option>
                          <option value="/payments/refund">/payments/refund (High Privileged path)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-mono">AWS SigV4 Authentication</label>
                    <select
                      value={config.authType}
                      onChange={(e) => setConfig({ ...config, authType: e.target.value as any })}
                      className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-none p-2.5 text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                    >
                      <option value="SigV4">Generate Valid SigV4 Signature</option>
                      <option value="ExpiredSigV4">Generate Corrupted signature</option>
                      <option value="None">No IAM Header (Anonymous)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-mono">Simulated IAM Principal</label>
                    <select
                      value={config.sourceCaller}
                      onChange={(e) => setConfig({ ...config, sourceCaller: e.target.value as any })}
                      className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-none p-2.5 text-neutral-200 focus:outline-none focus:border-neutral-500 font-mono"
                    >
                      <option value="FinanceServiceRole">FinanceServiceRole (Allowed for Payments)</option>
                      <option value="AdminRole">AdminServiceRole (Allowed for Orders)</option>
                      <option value="AnonymousClient">Anonymous API Caller (Generic Account)</option>
                    </select>
                  </div>

                  {config.targetService === "orders" && config.targetPath === "/orders" && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">Canary Weight Split</label>
                        <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded-none border border-neutral-800">
                          {config.weightSplit}% v1 / {100 - config.weightSplit}% v2
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.weightSplit}
                        onChange={(e) => setConfig({ ...config, weightSplit: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-neutral-950 rounded-none appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3.5 mt-2">
                    <button
                      disabled={isRunning || isAutoTrafficActive}
                      onClick={() => setIsRunning(true)}
                      className="py-3.5 bg-white text-black font-semibold text-xs uppercase tracking-[0.15em] rounded-none hover:bg-neutral-200 shadow-md disabled:bg-neutral-800 disabled:text-neutral-500 transition flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Unit</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsRunning(false);
                        setIsAutoTrafficActive(!isAutoTrafficActive);
                      }}
                      className={`py-3.5 font-semibold text-xs uppercase tracking-[0.15em] rounded-none shadow-md transition flex items-center justify-center space-x-2 border ${
                        isAutoTrafficActive
                          ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-400 font-bold"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white"
                      }`}
                    >
                      <Activity className={`w-3.5 h-3.5 ${isAutoTrafficActive ? "animate-[pulse_1s_infinite]" : ""}`} />
                      <span>{isAutoTrafficActive ? "Stop Traffic" : "Automate"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Visualizer Box and Logs Outputs */}
            <div className="xl:col-span-8 space-y-8">
              {/* Animated Topology SVG box */}
              <div className="h-full">
                <NetworkTopology
                  config={config}
                  onSimulationComplete={handleSimulationComplete}
                  isRunning={isRunning}
                  setIsRunning={setIsRunning}
                  isAutoTrafficActive={isAutoTrafficActive}
                  setIsAutoTrafficActive={setIsAutoTrafficActive}
                />
              </div>

              {/* Dynamic Real-Time Service Access Log Grid */}
              <div className="bg-[#0a0a0a] border border-neutral-800 rounded-none overflow-hidden shadow-xl">
                <div className="px-6 py-4 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Activity className="w-4 h-4 text-neutral-400" />
                    <h3 className="font-serif font-light text-base text-neutral-100 italic">Live Lattice Access Traces</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-neutral-950 rounded-none text-neutral-500 border border-neutral-800 uppercase tracking-widest">
                    Streaming
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead className="bg-[#0e0e0e] text-neutral-500 uppercase text-[9px] font-bold tracking-[0.15em] border-b border-neutral-800">
                      <tr>
                        <th className="p-4 pl-6">Timestamp</th>
                        <th className="p-4">Uri</th>
                        <th className="p-4">Source VPC</th>
                        <th className="p-4">Authorization</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/80">
                      {logs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-neutral-900/35 transition">
                          <td className="p-4 pl-6 text-neutral-500 whitespace-nowrap text-[11px]">
                            {log.timestamp.substr(11, 8)} Z
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-white uppercase text-[11px] bg-neutral-900 px-1.5 py-0.5 border border-neutral-800">{log.method}</span>{" "}
                            <span className="text-neutral-300 ml-1.5">{log.path}</span>
                          </td>
                          <td className="p-4 text-neutral-400 text-[11px]">{log.sourceVpc}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              {log.authDecision === "Allow" ? (
                                <span className="bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded-none text-[10px] border border-emerald-800/50 uppercase tracking-wider font-bold">
                                  Allowed
                                </span>
                              ) : (
                                <span className="bg-rose-950/40 text-rose-400 px-2 py-0.5 rounded-none text-[10px] border border-rose-800/50 uppercase tracking-wider font-bold">
                                  Denied
                                </span>
                              )}
                              <span className="text-[10px] text-neutral-500 lowercase font-mono italic">{log.authType}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-none font-mono font-bold text-[10px] ${
                              log.statusCode === 200 
                                ? "bg-[#0c1812] text-emerald-400 border border-emerald-800/60"
                                : "bg-[#180d0d] text-rose-400 border border-rose-800/60"
                            }`}>
                              {log.statusCode}
                            </span>
                          </td>
                          <td className="p-4 pr-6 text-neutral-400 text-[11px]">{log.latencyMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: POLICY LAB */}
        {activeTab === "policy" && (
          <div className="w-full">
            <IAMPolicyTester config={config} onConfigChange={setConfig} />
          </div>
        )}

        {/* TAB 3: TERRAFORM BLUEPRINTS */}
        {activeTab === "terraform" && (
          <div className="w-full h-full min-h-[500px]">
            <TerraformViewer />
          </div>
        )}

        {/* TAB 4: CLI PLAYBOOK */}
        {activeTab === "cli" && (
          <div className="w-full h-full min-h-[500px]">
            <CLITerminal />
          </div>
        )}
      </main>

      {/* Structured Footer */}
      <footer className="mt-auto border-t border-neutral-800 bg-[#0a0a0a] text-neutral-500 text-xs py-6 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-[10px] uppercase tracking-wider">
            AWS VPC Lattice Multi-Account Blueprint &copy; 2026. Custom Editorial Interface.
          </div>
          <div className="flex items-center space-x-6">
            <a href="https://docs.aws.amazon.com/vpc-lattice/latest/ug/what-is-lattice.html" target="_blank" referrerPolicy="no-referrer" className="hover:text-neutral-300 transition flex items-center space-x-1 font-mono text-[10px] uppercase tracking-wider">
              <span>Official Lattice UserGuide</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
