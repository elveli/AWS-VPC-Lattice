import React, { useState } from "react";
import { FileCode, File, Copy, Check, ChevronRight, HelpCircle } from "lucide-react";
import { terraformBlueprints } from "../data/terraformBlueprints";
import { TerraformFile } from "../types";

export const TerraformViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<TerraformFile>(terraformBlueprints[3]); // Default to lattice_network.tf
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-neutral-800 rounded-none overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-6 py-4.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <FileCode className="w-4 h-4 text-neutral-400" />
          <h2 className="font-serif font-light text-base text-neutral-200">Terraform Code Repository</h2>
        </div>
        <button
          onClick={handleCopyCode}
          className="text-[10px] uppercase tracking-wider font-mono flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800 rounded-none transition"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-mono">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-neutral-500" />
              <span>Copy File</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden font-sans">
        {/* File Navigator List (Left) */}
        <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-neutral-800 p-5 bg-neutral-900/10 overflow-y-auto max-h-[140px] md:max-h-none">
          <span className="text-[9px] font-bold text-neutral-550 uppercase tracking-[0.2em] block mb-3.5 font-mono">
            TF Config Workspace
          </span>
          <div className="space-y-1.5">
            {terraformBlueprints.map((blueprint, index) => {
              const active = selectedFile.name === blueprint.name;
              return (
                <button
                  key={index}
                  onClick={() => setSelectedFile(blueprint)}
                  className={`w-full text-left p-2.5 rounded-none text-xs font-mono transition flex items-center space-x-2 border ${
                    active
                      ? "bg-neutral-900 border-neutral-500 text-white font-semibold"
                      : "bg-transparent border-transparent text-neutral-500 hover:text-neutral-205 hover:bg-neutral-900/40"
                  }`}
                >
                  <File className={`w-3.5 h-3.5 ${active ? "text-neutral-300" : "text-neutral-600"}`} />
                  <span className="truncate">{blueprint.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code Editor Content & Highlight Analysis (Right) */}
        <div className="md:col-span-9 flex flex-col bg-[#050505] overflow-hidden h-full">
          {/* File description info banner */}
          <div className="px-5 py-3 bg-[#0d0d0d] border-b border-neutral-900 text-[11px] text-neutral-400 flex items-center space-x-2.5">
            <HelpCircle className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
            <span>{selectedFile.description}</span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto max-h-[280px] md:max-h-none font-mono text-xs text-neutral-350 leading-relaxed select-text space-y-4">
            <pre className="whitespace-pre-wrap break-all select-all font-mono leading-relaxed tracking-normal">
              {selectedFile.code}
            </pre>
          </div>

          {/* Highlights annotation drawer */}
          <div className="mt-auto border-t border-neutral-900 bg-[#080808] p-5">
            <h4 className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3">
              Key Resource Highlights
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {selectedFile.highlights.map((h, i) => (
                <div key={i} className="p-3 bg-[#050505] border border-neutral-900 rounded-none flex items-start space-x-3">
                  <div className="bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-none text-[9px] font-mono font-bold mt-0.5">
                    Line {h.line}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-200 block font-serif italic">
                      {h.concept}
                    </span>
                    <p className="text-[10px] text-neutral-400 leading-normal mt-1 brand-font">
                      {h.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
