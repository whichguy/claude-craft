import React, { useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  name: string;
}

// [TRAP] Correct useEffect with proper deps — not a bug
function useWindowWidth(): number {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

// [ISSUE: HOOK-1] Missing dependency in useEffect
function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser);
  }, []); // userId missing from deps

  return <div>{user?.name ?? 'Loading...'}</div>;
}

// [ISSUE: HOOK-2] Stale closure — count captured at render time
function Counter() {
  const [count, setCount] = useState(0);

  const incrementDelayed = useCallback(() => {
    setTimeout(() => {
      setCount(count + 1);
    }, 1000);
  }, []); // count missing — captures initial value

  return <button onClick={incrementDelayed}>{count}</button>;
}

// [ISSUE: HOOK-3] Object literal in dependency array causes infinite render loop
function DataFetcher({ filters }: { filters: { page: number } }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/data', { body: JSON.stringify(filters) })
      .then(r => r.json())
      .then(setData);
  }, [filters]); // filters is a new object each render

  return <ul>{data.map((d: any) => <li key={d.id}>{d.name}</li>)}</ul>;
}
