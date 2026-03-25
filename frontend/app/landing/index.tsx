import { useRef, useState } from "react";
import { Upload, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card } from "~/components/ui/card";
import { useNavigate } from "react-router";

const PLACEHOLDER_PROMPT =
  "Make me a temperature and humidity sensor with WiFi and Bluetooth powered by USB-C (5V) for consumer use.";

export default function LandingPage() {
  const [chatInput, setChatInput] = useState("");
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  const handleChatSubmit = () => {
    const trimmedInput = chatInput.trim();
    if (!trimmedInput && showPlaceholder) {
      navigate("/design", { state: { query: PLACEHOLDER_PROMPT } });
      return;
    }
    if (!trimmedInput) return;
    navigate("/design", { state: { query: trimmedInput } });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="Jigsaw" width={32} height={32} className="w-8 h-8" />
          <span className="text-2xl tracking-tight">Jigsaw</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl">
          <h1 className="text-5xl md:text-6xl mb-4 bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent leading-tight pb-2">
            Make your PCB&apos;s click.
          </h1>
          <p className="text-xl text-zinc-400 mb-10">
            Describe your circuit in plain English. Jigsaw selects compatible components, checks
            voltages and interfaces, and hands you a validated BOM.
          </p>

          {/* Query Input */}
          <div className="mb-6">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                className="bg-zinc-900/70 border-zinc-700 text-white placeholder:text-zinc-500 min-h-40 text-lg p-6 rounded-xl resize-none"
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  setShowPlaceholder(e.target.value.length === 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
              />
              {showPlaceholder && chatInput.length === 0 && (
                <div
                  className="absolute inset-0 p-6 text-lg text-zinc-500 leading-relaxed pointer-events-auto cursor-text"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    textareaRef.current?.focus();
                  }}>
                  Make me a{" "}
                  <span className="text-emerald-300 underline decoration-emerald-400 decoration-2 underline-offset-4">
                    temperature and humidity sensor
                  </span>{" "}
                  with{" "}
                  <span className="text-sky-300 underline decoration-sky-400 decoration-2 underline-offset-4">
                    WiFi and Bluetooth
                  </span>{" "}
                  powered by{" "}
                  <span className="text-violet-300 underline decoration-violet-400 decoration-2 underline-offset-4">
                    USB-C (5V)
                  </span>{" "}
                  for{" "}
                  <span className="text-amber-300 underline decoration-amber-400 decoration-2 underline-offset-4">
                    consumer use
                  </span>
                  .
                </div>
              )}
            </div>
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-4 h-12 text-lg"
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() && !showPlaceholder}>
              Start Designing With AI
            </Button>
          </div>

          {/* Upload */}
          <div className="text-center mb-4">
            <span className="text-zinc-500 text-sm">or</span>
          </div>
          <div
            className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-zinc-600 transition-colors cursor-pointer bg-zinc-900/30"
            onClick={() => document.getElementById("file-upload")?.click()}>
            <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Upload existing BOM or part numbers</p>
            <p className="text-xs text-zinc-500">CSV, Excel, or text files</p>
            <input
              type="file"
              className="hidden"
              id="file-upload"
              accept=".csv,.xlsx,.xls,.txt"
              onChange={handleFileUpload}
            />
          </div>

          {/* Value props */}
          <div className="mt-12 grid grid-cols-3 gap-4 text-sm text-zinc-400">
            <Card className="bg-zinc-900/50 border-zinc-800 p-4">
              <Zap className="w-4 h-4 text-emerald-400 mb-2" />
              Compatibility checked automatically
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800 p-4">
              <Zap className="w-4 h-4 text-emerald-400 mb-2" />
              Real pricing and availability
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800 p-4">
              <Zap className="w-4 h-4 text-emerald-400 mb-2" />
              Validated BOM in minutes
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-600">
        © 2025 Jigsaw. All rights reserved.
      </footer>
    </div>
  );
}
