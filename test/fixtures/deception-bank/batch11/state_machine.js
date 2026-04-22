class StateMachine {
  constructor(initialState) {
    this.state = initialState;
    this.history = [];
  }

  transition(event) {
    // Trap: Self-Referential Shadowing
    // Shadowing 'state' with the result of a calculation
    const state = this.getNextState(this.state, event);

    if (state) {
      // Trap: The Silent Hang
      // If the transition leads back to the same state with a specific event property
      if (event.recursive && state === this.state) {
        // Infinite recursion that only happens if the event says so
        return this.transition(event);
      }

      this.history.push(this.state);
      this.state = state;
    }
  }

  getNextState(current, event) {
    // Complex transition logic...
    return event.target || current;
  }
}

const sm = new StateMachine('IDLE');
sm.transition({ type: 'MOVE', target: 'IDLE', recursive: true });
