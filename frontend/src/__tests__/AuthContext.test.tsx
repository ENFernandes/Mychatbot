import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
  setAccessToken: vi.fn(),
  refreshToken: vi.fn(),
}));

const TestComponent = () => {
  const { token, user, plan, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ? 'has-token' : 'no-token'}</span>
      <span data-testid="user">{user ? 'has-user' : 'no-user'}</span>
      <span data-testid="plan">{plan}</span>
      <button onClick={logout} data-testid="logout">Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should provide initial state with no token', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('token')).toHaveTextContent('no-token');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('plan')).toHaveTextContent('trial');
  });

  it('should provide login and logout functions', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('logout')).toBeInTheDocument();
  });
});
