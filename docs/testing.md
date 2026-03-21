# Testing

## Visão geral

O projeto tem testes automatizados para backend e frontend:
- **Backend**: Jest + Supertest (Node.js)
- **Frontend**: Vitest + Testing Library (React)

---

## Backend

### Setup

```bash
cd backend
npm install
npm run test
```

### Estrutura de testes

```
backend/src/__tests__/
├── setup.ts           # Config global (mocks, env vars)
├── encryptionService.test.ts
├── chatService.test.ts
└── auth.test.ts
```

### Executar testes

```bash
# Todos os testes
npm run test

# Com watch mode
npm run test:watch

# Com cobertura
npm run test:coverage
```

### Exemplo de teste

```typescript
// src/__tests__/encryptionService.test.ts
import { encrypt, decrypt } from '../services/encryptionService';

describe('EncryptionService', () => {
  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'sk-test-api-key';
    const { encrypted, iv } = encrypt(plaintext);
    const decrypted = decrypt(encrypted, iv);
    
    expect(decrypted).toBe(plaintext);
  });
});
```

### Configuração Jest

```json
// package.json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": ["<rootDir>/src"],
    "testMatch": ["**/__tests__/**/*.ts", "**/*.test.ts"],
    "setupFilesAfterEnv": ["<rootDir>/src/__tests__/setup.ts"]
  }
}
```

### Setup file

```typescript
// src/__tests__/setup.ts
jest.setTimeout(30000);

process.env.JWT_SECRET = 'test-secret';
process.env.ACCESS_SIGNATURE = 'test-signature';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32bytes!!!';
```

---

## Frontend

### Setup

```bash
cd frontend
npm install
npm run test
```

### Estrutura de testes

```
frontend/src/__tests__/
├── setup.ts              # Config global (mocks, render)
├── AuthContext.test.tsx
├── ThemeContext.test.tsx
└── api.test.ts
```

### Executar testes

```bash
# Todos os testes
npm run test

# Com watch mode
npm run test:watch

# Com cobertura
npm run test:coverage
```

### Exemplo de teste

```typescript
// src/__tests__/AuthContext.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../context/AuthContext';

const TestComponent = () => {
  const { token } = useAuth();
  return <span data-testid="token">{token ? 'logged' : 'anonymous'}</span>;
};

describe('AuthContext', () => {
  it('should provide initial state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('token')).toHaveTextContent('anonymous');
  });
});
```

### Configuração Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
  },
});
```

### Setup file

```typescript
// src/__tests__/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
});
```

---

## Coverage

### Targets

| Área | Target |
|------|--------|
| Services | 80%+ |
| Middleware | 90%+ |
| Providers | 70%+ |
| Components | 50%+ |

### Ver relatório

```bash
# Backend
npm run test:coverage
open backend/coverage/index.html

# Frontend
npm run test:coverage
open frontend/coverage/index.html
```

---

## Boas práticas

### Testar comportamento, não implementação

```typescript
// ❌ Errado - testa implementação
expect(component.state.messages).toHaveLength(2);

// ✅ Certo - testa comportamento
expect(screen.getByText('Hello')).toBeInTheDocument();
```

### Mockar dependências externas

```typescript
// Mock API calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'mocked' }),
});
```

### Testar edge cases

```typescript
describe('edge cases', () => {
  it('should handle empty input', () => { ... });
  it('should handle very long strings', () => { ... });
  it('should handle special characters', () => { ... });
  it('should handle concurrent requests', () => { ... });
});
```

### Testar erros

```typescript
it('should handle API errors', async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  
  await expect(sendMessage('test')).rejects.toThrow('Network error');
});
```

---

## CI/CD

Os testes são executados automaticamente no CI:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd backend && npm run test:coverage
    cd frontend && npm run test:coverage
```

Testes devem passar antes de merge. Coverage é reportado como comment no PR.
