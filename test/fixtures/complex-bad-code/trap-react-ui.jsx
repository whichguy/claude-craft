import React, { useState, useCallback } from 'react';

/**
 * TRAP: React Hook Dependencies & CSS Mismatch.
 * 
 * Q6 Trap: The 'increment' callback is missing 'count' in its dependency array.
 * This will lead to stale closures where 'count' always appears as the initial value.
 * 
 * Q21 Trap: The 'invalid-class-name' and 'sidebar-theme-dark' classes are 
 * referenced but do not exist in the accompanying CSS (simulated context).
 */
const CounterComponent = () => {
    const [count, setCount] = useState(0);

    // MISSING DEPENDENCY: 'count' should be here.
    const increment = useCallback(() => {
        setCount(count + 1);
    }, []); 

    return (
        <div className="counter-container sidebar-theme-dark">
            <h1>Count: {count}</h1>
            
            {/* ORPHANED CSS CLASS: 'btn-primary-custom-active' is not defined */}
            <button 
                className="btn-primary-custom-active" 
                onClick={increment}
            >
                Increment
            </button>

            {/* ORPHANED CSS CLASS: 'invalid-class-name' is not defined */}
            <div className="invalid-class-name">
                Footer Info
            </div>
        </div>
    );
};

export default CounterComponent;
