import React, { ComponentType, FC } from 'react';

export interface WithLoadingProps {
  isLoading: boolean;
}

/**
 * HOC that adds a loading spinner.
 * Trap: The generic P is not correctly constrained or passed through,
 * causing the wrapped component to lose its specific prop requirements in some contexts.
 * Specifically, it fails to preserve 'ref' or 'displayName'.
 */
export function withLoading<P extends object>(
  Component: ComponentType<P>
): FC<P & WithLoadingProps> {
  const Wrapped: FC<P & WithLoadingProps> = ({ isLoading, ...props }) => {
    if (isLoading) return <div>Loading...</div>;
    return <Component {...(props as P)} />;
  };
  
  return Wrapped;
}

interface UserProfileProps {
  username: string;
  theme: 'light' | 'dark';
}

const UserProfile: FC<UserProfileProps> = ({ username }) => <div>{username}</div>;

// Trap: EnhancedProfile might lose the requirement for 'theme' if P is inferred loosely
export const EnhancedProfile = withLoading(UserProfile);
