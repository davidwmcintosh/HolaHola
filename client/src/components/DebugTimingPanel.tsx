import { useState, useEffect } from 'react';
import { subscribeToDebugTimingState, DebugTimingState } from '../lib/debugTimingState';

interface DebugTimingPanelProps {
  className?: string;
}

export function DebugTimingPanel({ className }: DebugTimingPanelProps) {
  const [state, setState] = useState<DebugTimingState | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
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
    audioContextState,
    audioContextId,
    activeSentenceIndex, 
    sentenceSchedule, 
    lastOnSentenceStartFired,
    lastOnSentenceEndFired,
    loopTickCount,
    isPlaying,
    lastUpdateTime,
    playerInstanceId,
    playerInstanceSetCount,
    wordTimingCount,
    visibleWordCount,
    currentWordIndex,
    deltasReceived,
    finalWordCount,
    totalDeltasReceived,
    totalFinalsReceived,
    lastDeltaSentence,
    currentWordText,
    expectedWordText,
    currentSentenceText,
    currentTargetText,
    receivedWords,
    timingComparison,
    recentWordEvents,
    connectionStatus,
    wordMismatchCount,
    emptyChunksProcessed,
    lastEmptyChunkSentence,
    sentenceEndTimesSet,
    sentenceTransitions,
    audioChunksReceived,
    totalAudioChunksReceived,
    lastAudioChunkSentence,
    sentenceMatchInfo,
    scheduleEvents,
  } = state;
  
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  const isStale = timeSinceUpdate > 1000;
  
  // Check if current word matches expected
  const wordMatches = !currentWordText || !expectedWordText || 
    currentWordText.toLowerCase().replace(/[^\w]/g, '') === expectedWordText.toLowerCase().replace(/[^\w]/g, '');
  
  // Get connection status color
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'streaming': return 'text-cyan-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-500';
    }
  };
  
  return (
    <div 
      className={`fixed bottom-4 left-4 z-50 bg-black/95 text-green-400 font-mono text-xs rounded-lg border border-green-500/50 shadow-xl ${className || ''}`}
      style={{ maxHeight: 'calc(100vh - 32px)', width: '400px' }}
      data-testid="debug-timing-panel"
    >
      <div 
        className="flex items-center justify-between p-2 border-b border-green-500/30 cursor-pointer sticky top-0 bg-black/95 z-10"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="font-bold text-green-300 flex items-center gap-2">
          TIMING DEBUG
          {isStale && <span className="text-red-400 text-[10px]">(STALE)</span>}
          <span className={`text-[10px] ${getConnectionStatusColor()}`}>
            [{connectionStatus.toUpperCase()}]
          </span>
          {/* Player instance indicator - should show count=1 if singleton working */}
          <span className={`text-[10px] ${playerInstanceSetCount === 1 ? 'text-green-400' : playerInstanceSetCount > 1 ? 'text-red-400' : 'text-gray-500'}`}>
            P:{playerInstanceSetCount || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {wordMismatchCount > 0 && (
            <span className="text-red-400 text-[10px]">{wordMismatchCount} mismatches</span>
          )}
          <span className="text-gray-500">{isCollapsed ? '▼' : '▲'}</span>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          
          {/* SECTION 1: Current Word Comparison (Most Important) */}
          <div className="border border-purple-500/40 rounded p-2 bg-purple-900/20">
            <div className="font-bold text-purple-300 mb-2 flex items-center gap-2">
              CURRENT WORD
              {currentWordText && (
                <span className={wordMatches ? 'text-green-400' : 'text-red-400'}>
                  {wordMatches ? '✓ Match' : '✗ Mismatch'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-gray-400 text-[10px]">Highlighted:</div>
                <div className="text-lg font-bold text-yellow-300 truncate">
                  {currentWordText || '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-[10px]">Expected (from timing):</div>
                <div className="text-lg font-bold text-cyan-300 truncate">
                  {expectedWordText || '—'}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-400">
              Word Index: <span className="text-pink-400">{currentWordIndex >= 0 ? currentWordIndex : '—'}</span>
              {' | '}Visible: <span className="text-green-300">{visibleWordCount}</span>
              {' | '}Total Received: <span className="text-cyan-300">{wordTimingCount}</span>
            </div>
          </div>
          
          {/* SECTION 2: Timing Drift */}
          {timingComparison && (
            <div className={`border rounded p-2 ${timingComparison.isOnTime ? 'border-green-500/40 bg-green-900/20' : 'border-red-500/40 bg-red-900/20'}`}>
              <div className="font-bold text-yellow-300 mb-1">TIMING DRIFT</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-gray-400 text-[10px]">Audio Time</div>
                  <div className="text-white">{timingComparison.audioCurrentTime.toFixed(3)}s</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px]">Expected Start</div>
                  <div className="text-white">{timingComparison.expectedWordStartTime.toFixed(3)}s</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px]">Drift</div>
                  <div className={timingComparison.isOnTime ? 'text-green-400' : 'text-red-400'}>
                    {timingComparison.drift > 0 ? '+' : ''}{(timingComparison.drift * 1000).toFixed(0)}ms
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* SECTION 3: Current Sentence Text */}
          {currentSentenceText && (
            <div className="border border-blue-500/40 rounded p-2 bg-blue-900/20">
              <div className="font-bold text-blue-300 mb-1">CURRENT SENTENCE</div>
              <div className="text-white text-[11px] leading-relaxed break-words">
                {currentSentenceText.length > 200 
                  ? currentSentenceText.substring(0, 200) + '...' 
                  : currentSentenceText}
              </div>
              {currentTargetText && (
                <div className="mt-1 text-yellow-300 text-[11px] leading-relaxed break-words">
                  Target: {currentTargetText}
                </div>
              )}
            </div>
          )}
          
          {/* SECTION 4: Word Timing Counts */}
          <div className="border border-green-500/30 rounded p-2">
            <div className="font-bold text-green-300 mb-1">WORD TIMING COUNTS</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Deltas:</span>
                <span className={totalDeltasReceived > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}>
                  {totalDeltasReceived}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Finals:</span>
                <span className={totalFinalsReceived > 0 ? 'text-cyan-400 font-bold' : 'text-gray-500'}>
                  {totalFinalsReceived}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">This Sentence:</span>
                <span className="text-yellow-400">{deltasReceived} deltas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Final Count:</span>
                <span className="text-cyan-400">{finalWordCount}</span>
              </div>
            </div>
            {deltasReceived > 0 && finalWordCount > 0 && (
              <div className="mt-1 text-center">
                <span className={deltasReceived === finalWordCount ? 'text-green-400' : 'text-red-400'}>
                  {deltasReceived === finalWordCount ? '✓ All deltas received' : `Missing ${finalWordCount - deltasReceived} deltas`}
                </span>
              </div>
            )}
          </div>
          
          {/* SECTION 5: Received Words (Scrollable) */}
          {receivedWords.length > 0 && (
            <div className="border border-orange-500/30 rounded p-2">
              <div className="font-bold text-orange-300 mb-1">RECEIVED WORDS ({receivedWords.length})</div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {receivedWords.map((word, idx) => (
                  <span 
                    key={idx} 
                    className={`px-1 rounded text-[10px] ${
                      idx === currentWordIndex 
                        ? 'bg-yellow-500 text-black font-bold' 
                        : idx < currentWordIndex 
                          ? 'bg-green-800/50 text-green-300' 
                          : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {idx}: {word}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* SECTION 6: Recent Word Events Log */}
          {recentWordEvents.length > 0 && (
            <div className="border border-cyan-500/30 rounded p-2">
              <div className="font-bold text-cyan-300 mb-1">RECENT EVENTS ({recentWordEvents.length})</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {[...recentWordEvents].reverse().slice(0, 10).map((event, idx) => (
                  <div 
                    key={idx} 
                    className="text-[10px] flex items-center gap-1"
                  >
                    <span className={event.type === 'delta' ? 'text-green-400' : 'text-cyan-400'}>
                      {event.type === 'delta' ? 'Δ' : 'F'}
                    </span>
                    <span className="text-gray-500">S{event.sentenceIndex}:</span>
                    <span className="text-yellow-300">w{event.wordIndex}</span>
                    <span className="text-white truncate max-w-[100px]">"{event.word}"</span>
                    <span className="text-gray-500">
                      {event.startTime.toFixed(2)}-{event.endTime.toFixed(2)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* SECTION 7: Playback State */}
          <div className="border border-green-500/30 rounded p-2">
            <div className="font-bold text-green-300 mb-1">PLAYBACK STATE</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
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
                <span>Ctx State:</span>
                <span className={
                  audioContextState === 'running' ? 'text-green-400' :
                  audioContextState === 'suspended' ? 'text-red-400' :
                  audioContextState === 'closed' ? 'text-yellow-400' :
                  'text-gray-500'
                }>
                  {audioContextState || 'unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ctx ID:</span>
                <span className="text-cyan-400 truncate max-w-[150px]" title={audioContextId}>
                  {audioContextId?.slice(-12) || 'none'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Active Sentence:</span>
                <span className={activeSentenceIndex >= 0 ? 'text-yellow-400' : 'text-gray-500'}>
                  {activeSentenceIndex >= 0 ? activeSentenceIndex : 'none'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Delta Sent:</span>
                <span className={lastDeltaSentence >= 0 ? 'text-yellow-400' : 'text-gray-500'}>
                  S{lastDeltaSentence}
                </span>
              </div>
            </div>
          </div>
          
          {/* SECTION 8: Sentence Events */}
          <div className="border border-green-500/30 rounded p-2">
            <div className="font-bold text-green-300 mb-1">SENTENCE EVENTS</div>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="flex justify-between">
                <span>Last Start:</span>
                <span className="text-cyan-400">
                  {lastOnSentenceStartFired >= 0 ? lastOnSentenceStartFired : 'none'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last End:</span>
                <span className="text-orange-400">
                  {lastOnSentenceEndFired >= 0 ? lastOnSentenceEndFired : 'none'}
                </span>
              </div>
            </div>
          </div>
          
          {/* SECTION 8.5: Audio Chunks Received (Critical for debugging) */}
          <div className="border border-yellow-500/40 rounded p-2 bg-yellow-900/20">
            <div className="font-bold text-yellow-300 mb-1">AUDIO CHUNKS RECEIVED</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Chunks:</span>
                <span className={totalAudioChunksReceived > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}>
                  {totalAudioChunksReceived}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Chunk S:</span>
                <span className={lastAudioChunkSentence >= 0 ? 'text-yellow-400' : 'text-gray-500'}>
                  {lastAudioChunkSentence >= 0 ? lastAudioChunkSentence : 'none'}
                </span>
              </div>
            </div>
            {Object.keys(audioChunksReceived).length > 0 && (
              <div className="mt-1">
                <span className="text-gray-400 text-[10px]">Per Sentence: </span>
                <span className="text-green-400">
                  {Object.entries(audioChunksReceived)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([s, count]) => `S${s}:${count}`)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
          
          {/* SECTION 8.6: Empty Chunks & Transitions (Critical for debugging) */}
          <div className="border border-pink-500/40 rounded p-2 bg-pink-900/20">
            <div className="font-bold text-pink-300 mb-1">EMPTY CHUNKS & TRANSITIONS</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Empty Chunks:</span>
                <span className={emptyChunksProcessed > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}>
                  {emptyChunksProcessed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Empty S:</span>
                <span className={lastEmptyChunkSentence >= 0 ? 'text-yellow-400' : 'text-gray-500'}>
                  {lastEmptyChunkSentence >= 0 ? lastEmptyChunkSentence : 'none'}
                </span>
              </div>
            </div>
            <div className="mt-1">
              <span className="text-gray-400 text-[10px]">EndTimes Set: </span>
              <span className={sentenceEndTimesSet.length > 0 ? 'text-green-400' : 'text-gray-500'}>
                {sentenceEndTimesSet.length > 0 ? `[${sentenceEndTimesSet.join(', ')}]` : 'none'}
              </span>
            </div>
            {sentenceTransitions.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 text-[10px] mb-1">Transitions:</div>
                <div className="max-h-16 overflow-y-auto space-y-0.5">
                  {sentenceTransitions.slice(-5).map((t, i) => (
                    <div key={i} className="text-[10px] text-cyan-300">{t}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* SECTION 9: Schedule (Collapsible) */}
          <details className="border border-green-500/30 rounded p-2">
            <summary className="font-bold mb-1 cursor-pointer">
              SCHEDULE ({sentenceSchedule.length} entries)
            </summary>
            {sentenceSchedule.length === 0 ? (
              <div className="text-gray-500 italic">empty</div>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto mt-2">
                {sentenceSchedule.map((entry) => (
                  <div 
                    key={entry.sentenceIndex}
                    className={`text-[10px] ${entry.sentenceIndex === activeSentenceIndex ? 'bg-green-900/50 px-1 rounded' : ''}`}
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
          </details>
          
          {/* SECTION 10: Match Info (Collapsible) - Shows WHY sentences match or don't */}
          <details className="border border-orange-500/30 rounded p-2" open>
            <summary className="font-bold mb-1 cursor-pointer text-orange-400">
              MATCH INFO ({sentenceMatchInfo?.length || 0} sentences)
            </summary>
            {(!sentenceMatchInfo || sentenceMatchInfo.length === 0) ? (
              <div className="text-gray-500 italic">no match data</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                {sentenceMatchInfo.map((info) => (
                  <div 
                    key={info.sentenceIndex}
                    className={`text-[10px] p-1 rounded ${
                      info.matches 
                        ? 'bg-green-900/50 border border-green-500/50' 
                        : 'bg-gray-800/50 border border-gray-600/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={info.matches ? 'text-green-400 font-bold' : 'text-gray-400'}>
                        S{info.sentenceIndex} {info.matches ? '✓ MATCH' : '✗'}
                      </span>
                      <span className={info.isStreaming ? 'text-yellow-400' : 'text-cyan-400'}>
                        {info.isStreaming ? 'STREAMING' : `end=${info.endCtxTime?.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="text-gray-300 mt-0.5">
                      {info.reason}
                    </div>
                    <div className="text-gray-500 text-[9px]">
                      range: {info.startCtxTime.toFixed(2)} - {info.computedEndTime.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
          
          {/* SECTION 11: Schedule Events Log - Shows WHEN schedule was modified */}
          <details className="border border-pink-500/30 rounded p-2" open>
            <summary className="font-bold mb-1 cursor-pointer text-pink-400">
              SCHEDULE EVENTS ({scheduleEvents?.length || 0})
            </summary>
            {(!scheduleEvents || scheduleEvents.length === 0) ? (
              <div className="text-gray-500 italic">no events yet</div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto mt-2">
                {scheduleEvents.slice().reverse().map((event, idx) => (
                  <div 
                    key={idx}
                    className={`text-[10px] p-1 rounded ${
                      event.type === 'clear' 
                        ? 'bg-red-900/50 border border-red-500/50' 
                        : event.type === 'add'
                          ? 'bg-green-900/50 border border-green-500/50'
                          : 'bg-gray-800/50 border border-gray-600/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={
                        event.type === 'clear' ? 'text-red-400 font-bold' :
                        event.type === 'add' ? 'text-green-400 font-bold' : 'text-gray-400'
                      }>
                        {event.type === 'clear' && `⚠️ CLEAR (${event.entriesCleared} removed)`}
                        {event.type === 'add' && `✅ ADD S${event.sentenceIndex}`}
                        {event.type === 'remove' && `❌ REMOVE S${event.sentenceIndex}`}
                      </span>
                      <span className="text-gray-500 text-[9px]">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      After: [{event.sentencesInSchedule.join(', ')}] ({event.scheduleSizeAfter} entries)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
          
          {/* Footer */}
          <div className="text-gray-500 text-[10px] text-center border-t border-green-500/20 pt-2">
            Updated: {timeSinceUpdate}ms ago
          </div>
        </div>
      )}
    </div>
  );
}
