import React, { useState } from "react";
import { Terminal as TerminalIcon, Play, RefreshCw, Sparkles, Check, ChevronRight } from "lucide-react";
import { cliCommands } from "../data/cliCommands";
import { CliCommand } from "../types";

export const CLITerminal: React.FC = () => {
  const [selectedCmd, setSelectedCmd] = useState<CliCommand>(cliCommands[0]);
  const [commandHistory, setCommandHistory] = useState<Array<{ cmd: string; output: string | object; desc: string }>>([
    {
      cmd: "aws vpc-lattice list-service-networks --region us-east-1",
      output: cliCommands[0].output,
      desc: cliCommands[0].description
    }
  ]);
  const [typedInput, setTypedInput] = useState<string>("aws vpc-lattice list-service-networks --region us-east-1");
  const [showIndicator, setShowIndicator] = useState<boolean>(false);

  const handleCommandSelect = (cmd: CliCommand) => {
    setSelectedCmd(cmd);
    setTypedInput(cmd.command);
  };

  const handleRunCommand = () => {
    // Find matching command object or create default output
    const match = cliCommands.find(c => c.command === typedInput) || selectedCmd;
    
    // Add to history list
    setCommandHistory(prev => [
      ...prev,
      {
        cmd: typedInput,
        output: match.output,
        desc: match.description
      }
    ]);

    setShowIndicator(true);
    setTimeout(() => {
      setShowIndicator(false);
    }, 1000);
  };

  const handleClearTerminal = () => {
    setCommandHistory([]);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-neutral-800 rounded-none overflow-hidden shadow-lg">
      {/* Terminal Title */}
      <div className="px-6 py-4.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <TerminalIcon className="w-4 h-4 text-neutral-400" />
          <h2 className="font-serif font-light text-base text-neutral-200">AWS AWSCLI Terminal Emulator</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleClearTerminal}
            className="text-[10px] uppercase tracking-wider text-neutral-500 hover:text-white px-3 py-1.5 border border-neutral-800 bg-neutral-950 rounded-none transition font-mono"
          >
            Clear Screen
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden font-sans">
        {/* Playbook Sidebar (Left) */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-neutral-800 p-5 flex flex-col overflow-y-auto max-h-[350px] lg:max-h-none bg-neutral-900/10">
          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] block mb-4 font-mono">
            Lattice CLI Playbook
          </span>
          <div className="space-y-2 flex-1">
            {cliCommands.map((item, index) => {
              const worksAsSelected = typedInput === item.command;
              return (
                <button
                  key={index}
                  onClick={() => handleCommandSelect(item)}
                  className={`w-full text-left p-3.5 rounded-none border text-xs transition flex items-start space-x-2.5 ${
                    worksAsSelected
                      ? "bg-neutral-900 border-neutral-500 text-white"
                      : "bg-[#070707] border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  <ChevronRight className="w-4 h-4 text-neutral-550 mt-0.5 flex-shrink-0" />
                  <div>
                    <code className="font-mono text-neutral-100 font-medium block whitespace-pre-wrap break-all mb-1 leading-relaxed">
                      {item.command.replace(" --region us-east-1", "")}
                    </code>
                    <p className="text-[11px] text-neutral-400 leading-normal">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Terminal Window (Right) */}
        <div className="lg:col-span-7 flex flex-col bg-[#050505] p-5 overflow-hidden min-h-[300px]">
          {/* Interactive Shell Input */}
          <div className="flex items-center space-x-3.5 bg-neutral-950 border border-neutral-800 px-4 py-3 rounded-none mb-4.5">
            <span className="text-neutral-500 font-mono text-xs select-none lowercase italic">sh-4.2$</span>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              className="flex-1 bg-transparent font-mono text-xs text-neutral-200 focus:outline-none placeholder-neutral-750"
              placeholder="Type custom aws vpc-lattice command..."
              onKeyDown={(e) => e.key === "Enter" && handleRunCommand()}
            />
            <button
              onClick={handleRunCommand}
              className="p-1 px-3 bg-white text-black text-xs font-semibold rounded-none hover:bg-neutral-200 transition flex items-center space-x-1.5 font-mono"
            >
              <span>RUN</span>
              {showIndicator ? <Check className="w-3 h-3" /> : <Play className="w-2.5 h-2.5 fill-black text-black" />}
            </button>
          </div>

          {/* Terminal output screens */}
          <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed select-text space-y-4 max-h-[290px] pr-2 scrollbar-thin">
            {commandHistory.length === 0 ? (
              <div className="text-neutral-500 italic p-4 text-center">
                Terminal buffer empty. Run any CLI command from the sidebar playlist to view output.
              </div>
            ) : (
              commandHistory.map((hist, idx) => (
                <div key={idx} className="border-b border-neutral-900 pb-3.5 last:border-0 last:pb-0">
                  <div className="flex items-center text-neutral-450 mb-1.5">
                    <span className="text-neutral-500 italic mr-2.5 font-sans lowercase text-[10px]">sh-4.2$</span>
                    <span className="font-bold text-neutral-200">{hist.cmd}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 italic block mb-2 font-sans">
                    # {hist.desc}
                  </span>
                  <pre className="bg-[#0b0b0b] border border-neutral-900 p-3.5 rounded-none text-neutral-300 overflow-x-auto text-[10.5px]">
                    {typeof hist.output === "string" 
                      ? hist.output 
                      : JSON.stringify(hist.output, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
