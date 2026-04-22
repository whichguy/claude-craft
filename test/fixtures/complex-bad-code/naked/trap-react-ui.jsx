import React, { useState, useCallback } from 'react';

const CounterComponent = () => {
    const [count, setCount] = useState(0);

    const increment = useCallback(() => {
        setCount(count + 1);
    }, []); 

    return (
        <div className="counter-container sidebar-theme-dark">
            <h1>Count: {count}</h1>
            
            <button 
                className="btn-primary-custom-active" 
                onClick={increment}
            >
                Increment
            </button>

            <div className="invalid-class-name">
                Footer Info
            </div>
        </div>
    );
};

export default CounterComponent;
