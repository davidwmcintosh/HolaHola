import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GreetingDeliveryState,
  acknowledgeFirstGreetingAudio,
  beginQueuedGreetingDispatch,
  markGreetingNoAudio,
} from '../services/greeting-delivery-state';

describe('GreetingDeliveryState', () => {
  it('queues before setup and dispatches when setup is ready', () => {
    const state = new GreetingDeliveryState();
    assert.equal(state.queue(), true);
    assert.equal(state.phase, 'queued');
    assert.equal(state.beginDispatch(), true);
    assert.equal(state.phase, 'dispatched');
  });

  it('retains retry intent after thrown send and permits bounded retry', () => {
    const state = new GreetingDeliveryState(2);
    state.queue();
    state.beginDispatch();
    assert.equal(state.sendFailed(), true);
    assert.equal(state.phase, 'queued');
    assert.equal(state.beginDispatch(true), true);
    assert.equal(state.sendFailed(), false);
    assert.equal(state.phase, 'failed');
  });

  it('marks first audio delivered and stops retries', () => {
    const state = new GreetingDeliveryState();
    state.queue();
    state.beginDispatch();
    state.firstAudio();
    assert.equal(state.phase, 'delivered');
    assert.equal(state.noAudio(), false);
    assert.equal(state.beginDispatch(true), false);
  });

  it('routes no-audio completion back to queued retry', () => {
    const state = new GreetingDeliveryState();
    state.queue();
    state.beginDispatch();
    assert.equal(state.noAudio(), true);
    assert.equal(state.phase, 'queued');
  });

  it('blocks a late duplicate after dispatch', () => {
    const state = new GreetingDeliveryState();
    state.queue();
    state.beginDispatch();
    assert.equal(state.queue(), false);
    assert.equal(state.beginDispatch(), false);
  });

  it('first greeting audio acknowledges delivery and cancels retry plus watchdog', () => {
    const state = new GreetingDeliveryState();
    state.queue();
    state.beginDispatch();
    let retryCancelled = false;
    let watchdogCancelled = false;
    acknowledgeFirstGreetingAudio(
      state,
      () => { retryCancelled = true; },
      () => { watchdogCancelled = true; },
    );
    assert.equal(state.phase, 'delivered');
    assert.equal(retryCancelled, true);
    assert.equal(watchdogCancelled, true);
  });

  it('distinguishes queued initial setup dispatch from internal retry dispatch', () => {
    const state = new GreetingDeliveryState();
    state.queue();
    assert.equal(beginQueuedGreetingDispatch(state, false), true);
    assert.equal(beginQueuedGreetingDispatch(state, false), false);
    markGreetingNoAudio(state);
    assert.equal(beginQueuedGreetingDispatch(state, true), true);
  });

  it('watchdog no-audio transition exits dispatched before retry scheduling', () => {
    const state = new GreetingDeliveryState();
    state.queue();
    state.beginDispatch();
    assert.equal(markGreetingNoAudio(state), true);
    assert.equal(state.phase, 'queued');
  });
});