import { AldenChat } from "@/components/AldenChat";
import { BrainCircuit } from "lucide-react";

export default function AldenPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
          <BrainCircuit className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">Alden</h1>
          <p className="text-xs text-muted-foreground leading-tight">Team Collaborator</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-4 py-4">
        <AldenChat />
      </div>
    </div>
  );
}
