import { useState, useEffect } from 'react';
import { subscribeToDebugTimingState, DebugTimingState } from '../lib/debugTimingState';

interface DebugTimingPanelProps {
  className?: string;
}

export function DebugTimingPanel({ className }: DebugTimingPanelProps) {
  const [state, setState] = useState<DebugTimingState | null>(null);
  
  useEffect(() => {
    const unsubscribe = subscribeToDebugTimingState((newState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, []);
  
  if (!state) {
    return null;
  }
  
  const { 
    isLoopRunning, 
    currentCtxTime, 
    activeSentenceIndex, 
    sentenceSchedule, 
    lastOnSentenceStartFired,
    lastOnSentenceEndFired,
    loopTickCount,
    isPlaying,
    lastUpdateTime
  } = state;
  
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  const isStale = timeSinceUpdate > 1000;
  
  return (
    <div 
      className={`fixed bottom-4 left-4 z-50 bg-black/90 text-green-400 font-mono text-xs p-3 rounded-lg border border-green-500/50 max-w-md shadow-lg ${className || ''}`}
      data-testid="debug-timing-panel"
    >
      <div className="font-bold text-green-300 mb-2 flex items-center gap-2">
        TIMING DEBUG
        {isStale && <span className="text-red-400">(STALE)</span>}
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Loop Running:</span>
          <span className={isLoopRunning ? 'text-green-400' : 'text-red-400'}>
            {isLoopRunning ? 'YES' : 'NO'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>isPlaying:</span>
          <span className={isPlaying ? 'text-green-400' : 'text-red-400'}>
            {isPlaying ? 'YES' : 'NO'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Loop Ticks:</span>
          <span>{loopTickCount}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Ctx Time:</span>
          <span>{currentCtxTime.toFixed(3)}s</span>
        </div>
        
        <div className="flex justify-between">
          <span>Active Sentence:</span>
          <span className={activeSentenceIndex >= 0 ? 'text-yellow-400' : 'text-gray-500'}>
            {activeSentenceIndex >= 0 ? activeSentenceIndex : 'none'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Last Start Fired:</span>
          <span className="text-cyan-400">
            {lastOnSentenceStartFired >= 0 ? lastOnSentenceStartFired : 'none'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Last End Fired:</span>
          <span className="text-orange-400">
            {lastOnSentenceEndFired >= 0 ? lastOnSentenceEndFired : 'none'}
          </span>
        </div>
        
        <div className="mt-2 pt-2 border-t border-green-500/30">
          <div className="font-bold mb-1">Schedule ({sentenceSchedule.length} entries):</div>
          {sentenceSchedule.length === 0 ? (
            <div className="text-gray-500 italic">empty</div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {sentenceSchedule.map((entry) => (
                <div 
                  key={entry.sentenceIndex}
                  className={`text-xs ${entry.sentenceIndex === activeSentenceIndex ? 'bg-green-900/50 px-1' : ''}`}
                >
                  <span className="text-yellow-300">S{entry.sentenceIndex}:</span>{' '}
                  <span>{entry.startCtxTime.toFixed(2)}</span>-
                  <span>{(entry.endCtxTime ?? (entry.startCtxTime + entry.totalDuration)).toFixed(2)}</span>{' '}
                  {entry.started && <span className="text-green-400">[STR]</span>}
                  {entry.ended && <span className="text-red-400">[END]</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-2 text-gray-500 text-[10px]">
          Updated: {timeSinceUpdate}ms ago
        </div>
      </div>
    </div>
  );
}
