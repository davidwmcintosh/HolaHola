import { EventEmitter } from 'events';

export interface AldenActivityEvent {
  type: 'tool_start' | 'tool_result' | 'response_complete' | 'heartbeat';
  name?: string;
  success?: boolean;
  summary?: string;
  reasoning?: string;
  error?: string;
  timestamp: string;
}

class AldenActivityEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(30);
  }

  push(event: AldenActivityEvent) {
    this.emit('activity', event);
  }
}

export const aldenActivity = new AldenActivityEmitter();
