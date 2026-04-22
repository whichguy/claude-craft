import React, { useState, useEffect } from 'react';

/**
 * TRAP: Classic React Stale Closure (Real-world bug pattern)
 * 
 * The setInterval callback captures the initial state of 'count' (0).
 * Because it's not in the dependency array or using a functional update,
 * the interval will repeatedly set the state to 0 + 1 = 1, appearing broken.
 */
export function DashboardTimer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // The trap: this closure only "sees" the count variable as it was
      // when the effect was first established.
      setCount(count + 1);
    }, 1000);
    
    return () => clearInterval(id);
  }, []); // Missing 'count' in dependency array

  return (
    <div className="timer-widget">
      <h2>Session Duration: {count}s</h2>
    </div>
  );
}
